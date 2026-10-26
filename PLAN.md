# Plan de correccion web

### APROBACION HUMANA
- SEBASTIAN
- 2026/10/26
- APROBACION DE TODOS LOS HALLAZGOS REALIZADO.

## Alcance y contrato observado

Se seleccionaron los IDs de componente `web` H-WEB-01 a H-WEB-06; la aprobacion humana de Sebastian para esos hallazgos consta al inicio de este documento. La revision local posterior registro H-WEB-07 y H-WEB-08, que no forman parte de esa aprobacion. La decision sobre cambiar `localStorage` por `sessionStorage` no consta, por lo que ese cambio no se implemento.

`docs/ENDPOINTS.md` registra el comportamiento observado por el frontend: login por `POST http://localhost:8080/auth/login` con `username`, `password` y `client`; uso de `data.token` y `data.user`; almacenamiento local y navegacion a `/dashboard`; consulta `GET http://localhost:8000/api/tasks?owner=<username>` con bearer token; exclusion de `ARCHIVED`; redireccion a `/login` sin token; logout que elimina token/usuario y vuelve a `/login`. No confirma un contrato acordado con los backends ni inventa su comportamiento.

Convenciones de destino: HTTP en servicios, estado de sesion centralizado, URLs por entorno, tipos explicitos para requests/responses, datos dinamicos como texto, errores consistentes, responsabilidades separadas y funciones pequenas. No agregar dependencias sin necesidad justificada. Mantener Vitest y no cambiar los payloads/endpoints.

## H-WEB-01 - Token en localStorage

**Hallazgo:** H-WEB-01 de `HALLAZGOS.md`, Pendiente. El token se almacena y lee en `localStorage`.

**Problema:** cualquier script del mismo origen puede leerlo; centralizar el acceso reduce acoplamiento, pero no protege el token de JavaScript.

**Cambio propuesto:** centralizar login, lectura/escritura de sesion y logout en `AuthService`. Evaluar `sessionStorage` como alternativa acotada: sobrevive a recargas de la pestana, pero no al cierre de esta y sigue siendo accesible a JavaScript. Esto cambia la persistencia actual; requiere decision humana explicita antes de implementarse. Sin esa decision, encapsular `localStorage` puede atender H-WEB-03, pero H-WEB-01 queda sin resolver. No mover secretos al frontend ni proponer un secreto cliente; una cookie `HttpOnly` requiere soporte de servidor y queda fuera del alcance.

**Archivos previstos:** `web/src/app/services/auth.service.ts` (nuevo), `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`; specs de servicio/componentes.

**Caracterizacion antes de cambios de produccion:** en Vitest con storage y Router simulados, verificar login exitoso que guarda token/usuario y navega a `/dashboard`, carga de sesion al recrear dashboard, redirect sin token y logout que limpia token/usuario y navega a `/login`. Fijar expresamente el comportamiento de preferencias, que actualmente se conservan en logout. Si se aprueba `sessionStorage`, probar su ciclo de vida y registrar la diferencia de persistencia antes de implementarlo.

**Contrato conservado:** URLs, metodos, cuerpo, respuesta y navegacion observados. La unica diferencia potencial requiere aprobacion previa y se limita a duracion/ubicacion de la sesion.

## H-WEB-02 - Mensaje enlazado con innerHTML

**Hallazgo:** H-WEB-02 de `HALLAZGOS.md`, Pendiente. Se usa `[innerHTML]` para un mensaje que combina datos dinamicos; no se comprobo bypass de sanitizacion ni XSS.

**Problema:** los valores de usuario/backend se interpretan en un sink HTML aunque el mensaje solo necesita texto y formato fijo.

**Cambio propuesto:** representar el mensaje como campos tipados y renderizar etiquetas estructurales estaticas en el template; interpolar nombre y detalle de backend como texto. Mantener las mismas palabras, estados de validacion y saltos/jerarquia visual mediante markup fijo.

**Archivos previstos:** `web/src/app/login/login.component.ts`, `web/src/app/login/login.component.html`, `web/src/app/login/login.component.spec.ts` (nuevo).

**Caracterizacion antes de cambios de produccion:** simular validacion vacia de usuario/contrasena, respuesta sin token y error de backend; fijar los textos mostrados y que el flujo no navega al fallar. Despues, verificar con prueba de template/browser local que una cadena que contiene etiquetas se presenta como texto literal. Vitest actualmente corre en Node; si no puede comprobar el DOM, documentar esa limitacion y coordinar cualquier dependencia antes de agregarla.

**Contrato conservado:** request/response HTTP, estados, mensajes y navegacion. No se ejecutara HTML recibido como datos.

## H-WEB-03 - Responsabilidades mezcladas en componentes

**Hallazgo:** H-WEB-03 de `HALLAZGOS.md`, Pendiente. Login y dashboard combinan HTTP, URLs, sesion y navegacion.

**Problema:** el acoplamiento hace mas dificil cambiar o probar una responsabilidad sin alterar las otras.

**Cambio propuesto:** `AuthService` posee login y sesion; `TasksService` consulta tareas; componentes orquestan la vista y navegacion. Mantener Axios para no introducir una migracion de transporte. Mover URLs a `environment.ts` y configurar Angular CLI para desarrollo/produccion solo si hace falta. Los servicios devolveran resultados tipados y errores normalizados sin filtrar detalles internos al usuario.

**Archivos previstos:** `web/src/app/services/auth.service.ts` y `tasks.service.ts` (nuevos), `web/src/environments/environment.ts` y `environment.production.ts` (nuevos), `web/angular.json`, componentes login/dashboard y specs de servicios/componentes.

**Caracterizacion antes de cambios de produccion:** mockear Axios y fijar URL, metodo, cuerpo, timeout y cabeceras actuales; comprobar login correcto/sin token, consulta con owner y bearer token, filtro de `ARCHIVED`, orden/etiquetas, errores visibles, redirect y logout. Usar datos ficticios y sin contactar servicios.

**Contrato conservado:** no cambiar endpoints, query, campos, token bearer, respuestas visibles, filtro, orden ni transiciones observadas.

## H-WEB-04 - Auditoria de Axios y Lodash

**Hallazgo:** H-WEB-04 de `HALLAZGOS.md`, Pendiente. `package.json` contiene Axios `0.31.0` y Lodash `4.17.21`; no hay resultado de advisory.

**Problema:** si una auditoria encuentra una vulnerabilidad aplicable, mantener una version afectada deja riesgo; la version declarada por si sola no prueba CVE.

**Cambio propuesto:** ejecutar la auditoria ya configurada (`npm run audit:workshop`) y revisar advisories/compatibilidad. Solo actualizar a una version corregida comprobada o eliminar Lodash si la prueba de caracterizacion confirma que una alternativa mantiene el merge de preferencias. No editar dependencias ni agregar paquetes antes de esa evidencia; coordinar acceso externo al registro dentro del alcance.

**Archivos previstos si la auditoria justifica cambios:** `web/package.json`, `web/package-lock.json` y, solo si se retira Lodash, `web/src/app/login/login.component.ts`.

**Caracterizacion antes de tocar dependencias:** probar que preferencias guardadas parciales se combinan con los valores por defecto, y fijar los contratos HTTP de login/tareas con Axios simulado. Registrar baseline de `npm test` y `npm run build` desde `web/` antes y repetirlos despues de cualquier actualizacion.

**Contrato conservado:** mismo merge observable y mismos requests/responses. Versiones corregidas y resultado de auditoria quedan pendientes hasta verificarse; no se presume CVE.

## H-WEB-05 - any y validacion anidada

**Hallazgo:** H-WEB-05 de `HALLAZGOS.md`, Pendiente. Se observaron `any` y validaciones anidadas; la duplicacion adicional de RETO.md no se confirmo.

**Problema:** `any` elimina comprobaciones estaticas sobre login/tareas y el anidamiento oculta casos de salida; afirmar o refactorizar duplicacion no observada ampliaria el alcance.

**Cambio propuesto:** definir tipos/interfaces de login, usuario, error y tarea; tipar los estados y `formatTaskLabel`; usar guard clauses para validaciones y errores. Extraer solo logica con una responsabilidad clara y nombrar constantes para valores repetidos nuevos, sin reescritura amplia.

**Archivos previstos:** `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`, `web/src/app/utils/legacy-format.ts`; `web/src/app/models/` solo si se necesita un tipo compartido; specs correspondientes.

**Caracterizacion antes de cambios de produccion:** cubrir campos vacios sin peticion, login exitoso con campos existentes, errores y dashboard con tareas de ejemplo. Fijar resultado de etiquetas, exclusion de `ARCHIVED`, orden y transiciones de carga/error; ejecutar baseline `npm test` y `npm run build` desde `web/`.

**Contrato conservado:** los tipos no cambian los payloads, respuestas, mensajes ni el orden/filtrado observado.

## H-WEB-06 - Falta de pruebas del flujo

**Hallazgo:** H-WEB-06 de `HALLAZGOS.md`, Pendiente. Solo se encontro una prueba de `formatTaskLabel`.

**Problema:** login, sesion, consulta y logout no tienen caracterizacion automatizada observada.

**Cambio propuesto:** ampliar Vitest con pruebas de servicios/componentes usando dobles de Axios, Router y almacenamiento. Mantener entorno Node y no agregar TestBed/DOM/dependencias salvo necesidad demostrada y coordinada. Reutilizar los casos de caracterizacion de H-WEB-01 a H-WEB-05 para evitar duplicar fixtures y expectativas.

**Archivos previstos:** `web/src/app/login/login.component.spec.ts` y `dashboard.component.spec.ts` (nuevos), specs de AuthService/TasksService cuando existan; `web/vitest.config.ts` solo si una limitacion probada exige modificarlo. Conservar el spec actual de utilidad.

**Caracterizacion antes de cambios de produccion:** escribir primero los tests de login valido/invalido, falta de token, almacenamiento, peticion con bearer, filtrado/orden, error de carga y logout; correr `npm test` desde `web/` y registrar la salida real antes de refactorizar.

**Contrato conservado:** las expectativas reflejan el comportamiento observado en `HALLAZGOS.md`; no afirman que los backends esten disponibles.

## Secuencia y evidencia

1. Crear primero las pruebas de caracterizacion en `web/` y ejecutar `npm test`; guardar resultado real asociado a componente `web` e IDs `H-WEB-01` a `H-WEB-06` en el registro de ejecuciones de este plan.
2. Resolver y registrar la decision humana sobre persistencia de H-WEB-01 antes de cambiar almacenamiento. Sin decision, no declarar ese hallazgo resuelto.
3. Obtener evidencia de auditoria para H-WEB-04 antes de cambiar versiones; si depende de red, registrar el bloqueo/resultado sin inventarlo.
4. Implementar las correcciones por ID en cambios revisables y ejecutar pruebas de regresion; ejecutar tambien `npm run build` y `npm run test:coverage` desde `web/` cuando corresponda. Medir la cobertura del codigo modificado y no declarar cumplida la meta de 85% sin resultado verificable.
5. Estados actualizados en `HALLAZGOS.md` con evidencia real. H-WEB-01 y H-WEB-03 permanecen pendientes; H-WEB-07 y H-WEB-08 se agregaron durante la revision local y requieren decision humana antes de implementarse.

## Resultado por hallazgo

| ID | cambio implementado | caracterizacion y correccion | estado |
|---|---|---|---|
| H-WEB-01 | Login/sesion ahora se encapsulan en `AuthService`; se conserva `localStorage`, sin mover credenciales ni introducir storage nuevo. | La prueba cubre login, lectura en dashboard y logout. El riesgo de acceso por JavaScript permanece y el cambio de storage carece de decision especifica. | Pendiente |
| H-WEB-02 | Mensajes tipados y markup estructural estatico; se retiro `[innerHTML]`. | La caracterizacion confirma los textos y un test inspecciona que el template no contiene `[innerHTML]` y usa interpolacion. | Resuelto |
| H-WEB-03 | `AuthService`/`TasksService` separan HTTP/sesion; URLs pasan a environments; componentes conservan presentacion y navegacion. | La caracterizacion verifica metodo, URL, payload, bearer token, filtro/orden, redirect y logout. Sin embargo, el helper retorna literalmente `message`/`detail` del backend, que se muestra al usuario; no cumple el manejo de errores sin detalles internos descrito en el plan. | Pendiente |
| H-WEB-04 | Axios paso a `1.20.0`; Lodash y sus tipos se retiraron; merge de preferencias reemplazado por una copia tipada de defaults. | Audit posterior ya no lista Axios/Lodash. Persisten 23 advisories transitivos y no se aplico `npm audit fix --force`. | Resuelto para las dependencias directas del hallazgo; residuales anotados |
| H-WEB-05 | Tipos explicitos en login, sesion y tareas; guard clauses y errores normalizados; sin `any` en los componentes/helper de produccion modificados. | La suite cubre entradas vacias, errores, estados, labels, filtro y orden; build pasa. | Resuelto |
| H-WEB-06 | Se amplio `authentication-flow.spec.ts` con indisponibilidad de auth, timeout y token invalido. | Resultado actual: 19 tests pasan. El conjunto de seis modulos productivos de login/tareas cubre 221/221 lineas, 221/221 sentencias y 62/65 branches; global web 226/259 lineas (87.25%). | Resuelto |
| H-WEB-07 | Hallazgo nuevo de la revision: advisories transitivos en el arbol de dependencias. | El `npm run audit:workshop` ejecutado en la revision falla con 23 advisories (10 moderados, 7 altos, 6 criticos). Parte del arbol es de desarrollo/build; se requiere triage y no se aplico `--force`. No forma parte de la aprobacion de implementacion anterior. | Pendiente |
| H-WEB-08 | Hallazgo nuevo de la revision: comparador de tareas asume prioridad y no devuelve igualdad. | `Task.priority` es opcional; el comparador usa `!` y retorna `1` en empate/no comparable. La prueba cubre solo dos prioridades distintas. No forma parte de la aprobacion de implementacion anterior. | Pendiente |

## Registro de ejecuciones

| fecha | componente | IDs | comando | resultado |
|---|---|---|---|---|
| 2026-10-26 | web | H-WEB-01 a H-WEB-06 | `npm test` antes de refactor | Primera corrida falla por JIT Angular no inicializado; tras importar `@angular/compiler`, 2 archivos y 7 tests pasan. |
| 2026-10-26 | web | H-WEB-04 | `npm run audit:workshop` antes de actualizar | Exit 1; 25 advisories: 10 moderados, 9 altos, 6 criticos. Axios `0.31.0` y Lodash `4.17.21` aparecen afectados; tambien dependencias transitivas. |
| 2026-10-26 | web | H-WEB-04 | `npm view axios version`; `npm view lodash version` | Registry reporta Axios `1.20.0` y Lodash `4.18.1`. |
| 2026-10-26 | web | H-WEB-04 | `npm uninstall lodash` | Fallo en npm 11.19.1/Arborist: `Cannot read properties of null (reading 'children')`; manifiesto/lock sin cambio por este intento. |
| 2026-10-26 | web | H-WEB-04 | `npm install --package-lock-only --ignore-scripts --legacy-peer-deps --no-audit` | Exito; lockfile sincronizado con las dependencias directas editadas. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-06 | `npm test` tras dependencias directas | 2 archivos, 7 tests pasan. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-06 | `npm test` tras cambio de constructores; repeticion tras ajustar expectativas | Primera corrida falla en seis fixtures obsoletos; siguiente deja 2 expectativas de mensaje HTML obsoletas; tras adaptar a modelo tipado, 2 archivos y 7 tests pasan. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-06 | `npm run build` | Exito. La corrida previa a sincronizar deps emitio advertencia CommonJS de Axios; la compilacion final pasa sin esa advertencia. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-06 | `npm run test:coverage` | Evolucion del reporte global: 77.07% inicial; 84.58% con 12 tests; 86.95% con 15 tests; final 87.25% con 16 tests. En el reporte final, login, dashboard, servicios y utilidades modificadas quedan al 100%. |
| 2026-10-26 | web | H-WEB-04 | `npm run audit:workshop` despues de actualizar | Exit 1; 23 advisories: 10 moderados, 7 altos, 6 criticos. No lista Axios/Lodash; persisten issues transitivos Angular CLI/core, Vitest y build. No se aplico `npm audit fix --force`. |
| 2026-10-26 | web | H-WEB-04 | `npm install --legacy-peer-deps --no-audit` | Exito: 2 paquetes agregados, 7 retirados y 2 cambiados; npm advirtio que scripts de 4 paquetes nativos no fueron aprobados. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-06 | `npm test` despues de sincronizar node_modules | 2 archivos, 15 tests pasan; prueba final posterior al manejo de sesion corrupta: 2 archivos, 16 tests pasan. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-06 | `npm run build`; `npm run test:coverage` finales | Build exitoso; 16 tests pasan; cobertura global 87.25%. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-08 | `npm test` durante revision local | Exito: 2 archivos, 16 tests pasan. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-08 | `npm run build` durante revision local | Exito: build Angular de produccion; bundle inicial 252.28 kB. |
| 2026-10-26 | web | H-WEB-01 a H-WEB-08 | `npm run test:coverage` durante revision local | Exito: 16 tests; cobertura global 87.25% de lineas y 91.04% de branches. Dashboard 100% lineas, 85% branches; login/servicios/utilidades 100%. |
| 2026-10-26 | web | H-WEB-07 | `npm run audit:workshop` durante revision local | Exit 1: 23 advisories (10 moderados, 7 altos, 6 criticos); la correccion sugerida por npm requiere `--force` y cambios fuera de las versiones fijadas. No se modificaron dependencias ni se redujo el gate. |
| 2026-10-26 | web | H-WEB-01, H-WEB-02, H-WEB-03, H-WEB-05, H-WEB-06, H-WEB-08 | `npm test` al completar pruebas de errores | Exit 0; 2 archivos de prueba, 19/19 tests aprobados. |
| 2026-10-26 | web | H-WEB-01, H-WEB-02, H-WEB-03, H-WEB-05, H-WEB-06, H-WEB-08 | `npm run test:coverage` al completar pruebas de errores | Exit 0; 19/19 tests. Flujo productivo: 221/221 lineas y sentencias, 62/65 branches. Global: 226/259 lineas y sentencias (87.25%), 65/71 branches (91.54%). Medicion Vitest V8 via `coverage/coverage-summary.json`. |
