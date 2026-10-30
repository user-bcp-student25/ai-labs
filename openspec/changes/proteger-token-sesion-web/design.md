# Design: proteger-token-sesion-web

Issue de referencia: [#22 — HU-01](https://github.com/user-bcp-student25/ai-labs/issues/22) (H-WEB-01).
Artefactos aprobados: [proposal.md](./proposal.md) y [specs/web-auth-session/spec.md](./specs/web-auth-session/spec.md).

## Contexto técnico

- **Estado actual en `main`** (commit `b920590`): `POST /auth/login` (`auth/src/main/java/com/bcp/workshop/auth/AuthResource.java`) responde `200` con `expiresIn`, `user` (`username`, `displayName`, `role`) y `debug`, sin campo `token` en el cuerpo. La sesión viaja en `Set-Cookie: workshop_session=<token>; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict`.
- **Cliente web** (`web/src/app/`):
  - `AuthService.saveSession` elimina la clave heredada `workshop_token` y guarda solo `workshop_user` en `localStorage`.
  - `TasksService.getTasks` llama `axios.get('/api/tasks?owner=<username>', { withCredentials: true })`, sin cabecera `Authorization`.
  - `DashboardComponent.logout` llama `clearSession()` (elimina `workshop_token` y `workshop_user`) y navega a `/login`.
- **Backend de tareas** (`api/app/main.py`): `legacy_identity` lee `Authorization` o, si no existe, la cookie `workshop_session`. El cliente web depende de ese fallback por cookie.
- **Entorno de pruebas**: Vitest 3.2.4 con `environment: 'node'` (sin DOM), `include: src/**/*.spec.ts`. La suite existente, `web/src/app/authentication-flow.spec.ts`, mockea `axios` y `localStorage` con `vi.stubGlobal`.
- **Proxy**: en desarrollo, `web/proxy.conf.json` y, en contenedor, `web/nginx.conf` reenvían `/auth` y `/api` al mismo origen. La cookie no requiere configuración cross-origin.

## Goals

1. Mantener verificable que, tras login exitoso, el token no queda en `localStorage`, `sessionStorage` ni `document.cookie`.
2. Mantener verificable que `/api/tasks` se consulta con `withCredentials: true` y sin cabecera `Authorization` ni lectura de token en el cliente.
3. Mantener verificable que el logout del cliente elimina usuario y clave heredada, conserva preferencias y navega a `/login`.
4. Completar las pruebas de caracterización faltantes para las specs de `web-auth-session`.
5. Corregir `docs/ENDPOINTS.md` (sección web) donde contradice el código.
6. Alcanzar 85% o más de cobertura en el código modificado.

## Non-goals

- No modificar `auth/` ni `api/`, incluida la invalidación de la cookie al cerrar sesión (requisito pendiente en la spec).
- No cambiar el mecanismo de sesión: no migrar a tokens en memoria, `sessionStorage` ni refresh tokens.
- No añadir atributos de cookie (`Secure`) desde el cliente; la cookie la emite el backend.
- No añadir dependencias (por ejemplo `jsdom` o Playwright) sin aprobación.
- No rediseñar el dashboard, el formulario de login ni `TasksService`.
- No corregir de paso `owner` sin codificar en `TasksService` (defecto ajeno al Issue; se registra como hallazgo aparte).

## Contratos protegidos

| Contrato | Fuente | Qué protege |
|---|---|---|
| `POST /auth/login` con `{username, password, client}` | `auth.service.ts`, `login.component.ts` | Cuerpo de la petición y mensajes de error sin cambios |
| Respuesta 2xx con `user` y `Set-Cookie` `HttpOnly` | `AuthResource.java` | Lectura de solo `user` por el cliente; el token no se lee |
| `GET /api/tasks?owner=<username>` con `withCredentials: true` | `tasks.service.ts` | Autenticación por cookie, sin `Authorization` desde web |
| Claves `workshop_user`, `workshop_preferences`, `workshop_token` (heredada) | `auth.service.ts` | Persistencia local y limpieza de la clave heredada |
| Rutas `/login`, `/dashboard` | `login.component.ts`, `dashboard.component.ts` | Redirecciones tras login, logout y sin sesión |
| Mensajes `No se pudo autenticar a <usuario>.` y `detail` de error | `login.component.ts`, `tasks.service.ts` | Textos mostrados al usuario |

## Componentes afectados

Se prevé **ningún cambio de código funcional**. Los componentes se verifican, no se modifican:

- `web/src/app/services/auth.service.ts`: sin cambios esperados. Solo cambia si una prueba de caracterización revela un defecto.
- `web/src/app/login/login.component.ts`: sin cambios esperados.
- `web/src/app/dashboard/dashboard.component.ts`: sin cambios esperados.
- `web/src/app/services/tasks.service.ts`: sin cambios esperados.
- `web/src/app/authentication-flow.spec.ts`: se amplía con pruebas nuevas.
- `docs/ENDPOINTS.md`: sección web. Se corrige el ejemplo de la línea 62 (`"token"` en el cuerpo), la línea 171 (token accesible en `localStorage`) y la línea 91 si queda desactualizada.

## Decisiones técnicas y alternativas

### D1. Mantener la cookie `HttpOnly` emitida por el backend como única credencial de sesión

- **Elegida:** el cliente no almacena ni lee el token; `withCredentials: true` deja que el navegador adjunte la cookie.
- **Alternativa A: `sessionStorage` en lugar de `localStorage`.** Rechazada: sigue siendo legible por JavaScript del mismo origen; no resuelve H-WEB-01 (lo indica el propio Issue).
- **Alternativa B: token en memoria del cliente, recibido en el cuerpo.** Rechazada: requiere que el backend devuelva el token en el cuerpo, lo que contradice el contrato actual y exige cambios en `auth/`.
- **Alternativa C: BFF o proxy que gestione la sesión.** Rechazada: rediseño de la aplicación, fuera de alcance.

### D2. Verificación de no exposición por contrato, no por DOM

- **Elegida:** en la suite existente (entorno `node`), instrumentar `globalThis.sessionStorage` y `globalThis.document` con spies. Se afirma que no se escribe nada en ellos y que el cuerpo de respuesta no contiene el token.
- **Alternativa A: añadir `jsdom` y entorno DOM.** Rechazada por ahora: nueva dependencia sin necesidad; los spies bastan para el contrato observable.
- **Alternativa B: Playwright contra el stack completo.** Válida como verificación posterior; no se incluye en este cambio para evitar levantar Java y Python en la suite unitaria. Ver estrategia.

### D3. Logout solo del cliente (decisión ya tomada: `web_only`)

- La cookie `HttpOnly` no puede borrarse desde JavaScript y el backend no expone logout. Este cambio no lo resuelve; se documenta como limitación en la evidencia.

## Estrategia incremental

1. **Caracterización primero (sin cambios de código):** añadir pruebas nuevas a `authentication-flow.spec.ts` y ejecutarlas contra el código actual. Se espera que pasen; si alguna falla, se trata como hallazgo antes de cambiar código.
2. **Documentación:** corregir las líneas de `docs/ENDPOINTS.md` (sección web) que contradicen el código.
3. **Cobertura:** ejecutar `npm run test:coverage` en `web/` y verificar que el código tocado llega al 85% o más.
4. **Verificación manual opcional (fuera de la suite):** levantar `compose.yaml` y comprobar en el navegador que `document.cookie` no muestra `workshop_session` y que el dashboard carga tareas. Se registra como evidencia manual, no como prueba automatizada.

Cada paso es revisable por separado y no altera el contrato HTTP.

## Pruebas de caracterización necesarias

Antes de modificar cualquier comportamiento crítico, deben existir y pasar las siguientes pruebas. Las marcadas como **existente** ya están en la suite; las **nueva** deben añadirse.

| Requisito de la spec | Prueba | Estado |
|---|---|---|
| Login no persiste el token | "saves only the user after login..." (línea 104) | existente; ampliar con spies de `sessionStorage` y `document.cookie` (**nueva**) |
| Login elimina `workshop_token` | comprobaciones en líneas 78, 113, 164 | existente |
| Login no escribe `sessionStorage` ni `document.cookie` | — | **nueva** |
| Respuesta sin campo `token` | — | **nueva**: el cuerpo mockeado sin token no produce escrituras con valores del cuerpo |
| `GET /api/tasks` con `withCredentials: true` y sin cabecera `Authorization` | "loads tasks with the session cookie..." (línea 197) | existente; ampliar para afirmar que el segundo argumento es exactamente `{ withCredentials: true }` (**nueva** aserción) |
| Error HTTP conserva sesión local | línea 240 | existente |
| Logout limpia usuario y `workshop_token`, conserva preferencias y navega a `/login` | línea 260 | existente |
| Sin sesión local no hay solicitud a `/api/tasks` | línea 219 | existente |
| Login 401 muestra mensaje del backend y no navega | línea 134 | existente |
| Pruebas sin valores sensibles | — | **nueva**: `console.log` y `console.error` no reciben el valor del token mockeado en login ni logout |

Notas de implementación de las pruebas nuevas: usar un valor de prueba aislado (por ejemplo `test-only-value`), nunca un token real.

## Riesgos y trade-offs

- **R1. Logout no invalida la cookie.** Tras cerrar sesión en el cliente, `/api/tasks` aún acepta `workshop_session` hasta 3600 s. Mitigación: documentarlo en la evidencia; cambio posterior en `auth/` y `api/`.
- **R2. Sin `Secure` en la cookie.** El backend emite la cookie sin `Secure`, lo que permite que viaje por HTTP. Aceptable en el laboratorio local; en producción debe revisarse. Fuera de alcance.
- **R3. Verificación limitada a contrato mockeado.** Las pruebas unitarias no comprueban que el navegador real oculte la cookie a `document.cookie`. Mitigación: verificación manual opcional (paso 4) y evidencia que lo indique.
- **R4. Falsos positivos por instrumentación.** Los spies sobre `document` en entorno `node` pueden ocultar lecturas no previstas. Mitigación: instrumentar también `document.cookie` como getter que falla si se lee.
- **R5. Sin validación de esquema.** Si el backend cambia el formato de `user`, el cliente falla en tiempo de uso. Fuera de alcance según la propuesta.
- **Trade-off:** no añadir `jsdom` mantiene el cambio pequeño, a costa de no probar el comportamiento real del navegador.

## Rollback

- Como no se prevén cambios funcionales, el rollback consiste en revertir los commits de pruebas y documentación, o eliminar las pruebas añadidas. No hay migración de datos ni cambio de almacenamiento que deshacer.
- Si una prueba de caracterización falla y se decide cambiar `auth.service.ts`, el rollback será revertir ese commit; las claves `workshop_user` y `workshop_preferences` no cambian de nombre, por lo que los usuarios con sesión activa no se ven afectados.
- Si se detecta un defecto en producción, el procedimiento es el mismo: revertir el commit correspondiente. La cookie del backend no cambia en este cambio, así que no hay rollback del lado de `auth/`.
