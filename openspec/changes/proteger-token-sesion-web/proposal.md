# Proposal

Issue de referencia: [#22 — HU-01: Proteger el token de autenticación frente al acceso desde JavaScript](https://github.com/user-bcp-student25/ai-labs/issues/22) (origen H-WEB-01).

## Why

El hallazgo H-WEB-01 señala que el token de sesión podía quedar expuesto a JavaScript del mismo origen. El estado actual de `main` (commit `b920590`) ya emite la sesión como cookie `workshop_session` con `HttpOnly`, y el cliente web guarda solo el usuario y las preferencias. Falta fijar ese comportamiento con pruebas de integración, cubrir el cierre de sesión del cliente y corregir la evidencia del Issue: las referencias `web/src/app/services/auth.service.ts:27` y `:32` apuntan a la persistencia del usuario, no a un token.

## What Changes

- Verificar y fijar, con pruebas de integración en `web/`, que tras un `POST /auth/login` exitoso el token no queda disponible para JavaScript mediante `localStorage`, `sessionStorage` ni `document.cookie`.
- Verificar que las solicitudes a `GET /api/tasks` siguen autenticadas por la cookie (`withCredentials: true`) sin que el cliente lea ni reenvíe el token.
- Cubrir el cierre de sesión del cliente: se elimina el usuario local (y la clave heredada `workshop_token`), se conservan las preferencias, se navega a `/login` y el dashboard deja de hacer solicitudes autenticadas sin sesión local.
- Corregir la documentación web (`docs/ENDPOINTS.md`, sección web) para eliminar contradicciones sobre el token en el cuerpo del login y en `localStorage`.
- Asegurar que pruebas y evidencia no impriman ni guarden valores de token, secretos o credenciales.
- **No** hay cambios funcionales en `auth/` ni en `api/`.

## Capabilities

### New Capabilities

- `web-auth-session`: comportamiento observable de la sesión autenticada en el cliente web: ausencia de token legible por JavaScript, autenticación de solicitudes mediante cookie `HttpOnly` y limpieza de la sesión local en el cierre de sesión.

### Modified Capabilities

- Ninguna. `openspec/specs/` no contiene especificaciones previas.

## Alcance

**Dentro del alcance (componente `web/`):**
- `web/src/app/services/auth.service.ts`, `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts` y `web/src/app/services/tasks.service.ts`, solo si las pruebas revelan un defecto.
- Pruebas de integración y de logout en `web/` (ampliando `web/src/app/authentication-flow.spec.ts`).
- `docs/ENDPOINTS.md`, sección web.

**Fuera del alcance:**
- Cambios en `auth/` o `api/`, incluida la invalidación de la cookie en el servidor al cerrar sesión.
- Nuevos endpoints de logout o cambios en el formato, expiración o claims del token.
- Migración a otro mecanismo de sesión (por ejemplo, tokens en memoria o refresh tokens).
- Validación de esquema en runtime de las respuestas de `/auth/login`.
- Dependencias nuevas.

## Comportamiento que debe preservarse

Basado en `docs/ENDPOINTS.md` (baseline del Dia 1) y en el código actual:

- `POST /auth/login` (relativo, same-origin) con cuerpo `{ username, password, client }`; respuesta 2xx con `user` (`username`, `displayName`, `role`) y cabecera `Set-Cookie: workshop_session=...; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict`.
- Mensajes de error de login existentes (400, 401 y 500 del backend) mostrados sin cambios.
- Tras login exitoso se navega a `/dashboard`; sin sesión local, `/dashboard` redirige a `/login` sin llamar a tareas.
- `GET /api/tasks?owner=<username>` con `withCredentials: true`; un error HTTP muestra el `detail` devuelto o el mensaje de respaldo y no borra la sesión local.
- Las preferencias del usuario se conservan tras cerrar sesión.

**Discrepancia documentada:** `docs/ENDPOINTS.md` línea 62 muestra un ejemplo de respuesta con `"token"` en el cuerpo, mientras que la línea 53 indica que el token ya no se envía en el cuerpo. La especificación sigue la línea 53 y el código del backend (sin campo `token`) y corrige el ejemplo.

## Limitación conocida: cierre de sesión en el servidor

La cookie `HttpOnly` no puede eliminarse desde JavaScript y el backend no expone endpoint de logout. Tras cerrar sesión en el cliente, la cookie sigue siendo enviada a `/api/tasks` hasta que expire (3600 s) o el servidor la invalide. Este cambio solo garantiza que el cliente deja de operar con la sesión local. La invalidación en servidor queda como requisito pendiente y bloqueado por un cambio posterior en `auth/` y `api/`, según lo decidido: alcance solo `web/`.

## Impact

- **Código:** `web/src/app/` (servicios, componentes y pruebas de sesión). Sin cambios en el contrato HTTP.
- **Documentación:** `docs/ENDPOINTS.md`, sección web.
- **APIs:** ninguna modificada; `auth/` y `api/` se consumen tal como están.
- **Dependencias:** ninguna nueva.
- **Riesgos:** el logout del cliente no invalida la cookie; la evidencia debe indicarlo explícitamente.
