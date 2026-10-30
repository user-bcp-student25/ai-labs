# Tasks

Componente: `web/`. Issue de referencia: [#22 — HU-01](https://github.com/user-bcp-student25/ai-labs/issues/22) (H-WEB-01).
Comandos de prueba: desde `web/` con `npm test` o `npm run test:coverage`.

## 1. Línea base

- [x] 1.1 Ejecutar `npm test` en `web/` sin cambios y registrar que la suite actual pasa (línea base). Verificación: salida con 0 fallos.
- [ ] 1.2 Confirmar con `git status` desde la raíz que no hay cambios en `auth/` ni `api/`. Verificación: ningún archivo fuera de `web/` y `docs/` aparece modificado por este cambio.

## 2. Entorno de pruebas para DOM real

- [ ] 2.1 Añadir `jsdom` como devDependency en `web/package.json` y actualizar el lockfile. Verificación: `npm ls jsdom` en `web/` muestra la versión instalada.
- [ ] 2.2 Activar el entorno `jsdom` solo en `web/src/app/authentication-flow.spec.ts` mediante la directiva `// @vitest-environment jsdom`, sin cambiar `environment` global en `vitest.config.ts`. Verificación: `npm test` en `web/` sigue pasando todas las pruebas existentes.

## 3. Pruebas de caracterización previas al cambio

Estas pruebas se escriben y deben pasar contra el código actual, antes de cualquier modificación de comportamiento.

- [x] 3.1 Ampliar la prueba de login (línea 104) para instrumentar `sessionStorage` y `document.cookie` con spies y afirmar que no se escribe nada en ellos tras login exitoso. Verificación: `npx vitest run src/app/authentication-flow.spec.ts` en `web/` pasa.
- [x] 3.2 Añadir prueba: la respuesta de `POST /auth/login` sin campo `token` no produce escrituras en storage con valores del cuerpo. Usar un valor de prueba aislado (`test-only-value`). Verificación: la prueba pasa y no imprime el valor.
- [x] 3.3 Ampliar la prueba de tareas (línea 197) para afirmar que `axios.get` recibe exactamente `{ withCredentials: true }` como configuración y que no se envía cabecera `Authorization`. Verificación: la prueba pasa.
- [x] 3.4 Añadir prueba de logout que verifica que `clearSession` elimina `workshop_user` y `workshop_token`, conserva `workshop_preferences` y navega a `/login`, sin tocar `document.cookie`. Verificación: la prueba pasa.
- [x] 3.5 Añadir prueba de que `console.log` y `console.error` no reciben el valor del token mockeado durante login, tareas y logout. Verificación: la prueba pasa y el valor de prueba no aparece en la salida.
- [ ] 3.6 Añadir prueba de que `document.cookie` no expone `workshop_session` tras login, usando jsdom. Verificación: la prueba pasa en el entorno jsdom.

## 4. Verificación de no cambio funcional

- [ ] 4.1 Confirmar que todas las pruebas de la sección 3 pasan sin modificar `web/src/app/services/auth.service.ts`, `login.component.ts`, `dashboard.component.ts` ni `tasks.service.ts`. Verificación: `git diff --stat -- web/src/app/services` no muestra cambios.
- [ ] 4.2 Si alguna prueba de la sección 3 falla por un defecto real, detener el trabajo y registrar el hallazgo antes de cambiar código, para revisarlo con el usuario. Verificación: nota de hallazgo añadida a la evidencia del change; sin cambios de código no aprobados.

## 5. Documentación

- [ ] 5.1 Corregir en `docs/ENDPOINTS.md` el ejemplo de respuesta de `POST /auth/login` (línea 62) para quitar el campo `"token"`. Verificación: `Select-String -Path docs/ENDPOINTS.md -Pattern '"token"'` no devuelve coincidencias en el bloque de respuesta de login.
- [ ] 5.2 Corregir en `docs/ENDPOINTS.md` la afirmación de que el token es accesible desde `localStorage` (línea 171) para reflejar la cookie `HttpOnly`. Verificación: la línea ya no afirma acceso desde `localStorage`.
- [ ] 5.3 Revisar `docs/ENDPOINTS.md` línea 91 y ajustarla si contradice el contrato de cookie. Verificación: la sección de sesión es coherente con `AuthResource.java` (`workshop_session`, `HttpOnly`, `Max-Age=3600`).

## 6. Cobertura y validación final

- [ ] 6.1 Ejecutar `npm run test:coverage` en `web/` y verificar que el código modificado o añadido alcanza 85% o más de cobertura. Verificación: reporte de cobertura con el umbral cumplido.
- [ ] 6.2 Buscar en las pruebas, logs y evidencia valores reales de tokens o secretos. Verificación: no hay coincidencias con valores reales; solo `test-only-value`.
- [ ] 6.3 Ejecutar `openspec validate proteger-token-sesion-web --strict` desde la raíz. Verificación: el change es válido.

## Evidencia de caracterización (2026-10-29)

- Línea base, antes de editar pruebas: desde `web/`, `npm test` terminó con código 0; 2 archivos y 19/19 pruebas pasaron.
- Validación focalizada, desde `web/`, `npx vitest run src/app/authentication-flow.spec.ts` terminó con código 0; 19/19 pruebas pasaron.
- Validación completa, desde `web/`, `npm test` terminó con código 0; 2 archivos y 20/20 pruebas pasaron.
- La verificación de alcance desde la raíz no reportó cambios en `auth/`, `api/` ni en servicios/componentes de producción de `web/`.
- La tarea 3.6 queda pendiente de revisión: requiere `jsdom`, pero `design.md` rechaza esa dependencia. Además, una respuesta Axios simulada no demuestra que un navegador real oculte una cookie `HttpOnly` de `document.cookie`.

## Workflow follow-up

- Registrar en la evidencia que el criterio de logout del Issue #22 (el cliente deja de poder hacer solicitudes autenticadas) queda parcialmente cubierto: el alcance elegido es `web_only` y la cookie `workshop_session` sigue válida en el servidor hasta 3600 s.
- Crear un cambio OpenSpec separado para invalidar la sesión en el servidor. Ese cambio toca `auth/` y `api/` y queda fuera de este alcance.
- Archivar el cambio `proteger-token-sesion-web` cuando la revisión humana y las pruebas reales estén completas.
