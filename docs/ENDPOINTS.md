# Contratos consumidos por web

## Estado de la evidencia

Este documento describe el contrato observado en el cliente Angular de `web/`; no confirma un contrato acordado con los servicios. No se encontro una especificacion del backend y no se contactaron servicios externos. Las interfaces TypeScript no validan el JSON en runtime. Para ambos requests, el exito observado es que Axios resuelva (2xx por defecto); el frontend no exige un codigo especifico.

| Estado | Evidencia |
|---|---|
| Observado en frontend | Requests, tipos estaticos, manejo de errores y transiciones de UI descritos abajo; caracterizacion local en `web/src/app/authentication-flow.spec.ts`. |
| Acordado con backend | No verificado. No hay especificacion backend disponible en este workspace y no se probaron servicios. |
| Riesgos pendientes | Token en `localStorage` (H-WEB-01), mensajes de error que pueden exponer texto del backend (H-WEB-03), y dominio/orden de prioridades sin confirmar (H-WEB-08). |

Las URLs del cliente son relativas y same-origin: `/auth/login` y `/api/tasks`. En desarrollo `ng serve` las reenvia mediante `web/proxy.conf.json` a `localhost:8080` y `localhost:8000`; en nginx las reenvia `web/nginx.conf`. Antes: `http://localhost:8080/auth/login` y `http://localhost:8000/api/tasks` (`web/src/environments/environment.ts:3`, `web/src/environments/environment.ts:4`, `web/src/environments/environment.production.ts:3`, `web/src/environments/environment.production.ts:4`). Confirmar los destinos antes de desplegar fuera del laboratorio local.

# Login: `POST /auth/login`

## 1. Quien lo llama

`LoginComponent.login()` valida los campos y llama a `AuthService.login()`. El servicio ejecuta `axios.post` con `environment.authLoginUrl` y timeout de 5000 ms (`web/src/app/login/login.component.ts:28`, `web/src/app/services/auth.service.ts:19`, `web/src/app/services/auth.service.ts:20`, `web/src/app/services/auth.service.ts:21`).

## 2. Que envia

| Parte | Campo | Valor observado | Evidencia |
|---|---|---|---|
| Metodo/URL | `POST` | `/auth/login` (relativa, same-origin) | `web/src/environments/environment.ts` |
| Header | `Authorization` | No se configura para login | `web/src/app/services/auth.service.ts:19`, `web/src/app/services/auth.service.ts:20` |
| Headers | Otros | No se indican headers en la configuracion de esta llamada. Axios serializa el objeto; el codigo no verifica los headers efectivos en el cable. | `web/src/app/services/auth.service.ts:19`, `web/src/app/services/auth.service.ts:20` |
| Body | `username` | Valor escrito por el usuario; se recorta para validar que no este vacio, pero se envia el valor original | `web/src/app/login/login.component.ts:30`, `web/src/app/login/login.component.ts:42`, `web/src/app/models/auth.models.ts:2` |
| Body | `password` | Valor escrito por el usuario; se recorta para validar que no este vacio, pero se envia el valor original | `web/src/app/login/login.component.ts:34`, `web/src/app/login/login.component.ts:43`, `web/src/app/models/auth.models.ts:3` |
| Body | `client` | Constante `angular-workshop` | `web/src/app/login/login.component.ts:8`, `web/src/app/login/login.component.ts:44` |
| Configuracion Axios | `timeout` | 5000 ms | `web/src/app/services/auth.service.ts:10`, `web/src/app/services/auth.service.ts:21` |

Ejemplo representativo con las credenciales ficticias de laboratorio usadas en la caracterizacion:

```json
{
  "username": "student",
  "password": "Workshop123!",
  "client": "angular-workshop"
}
```

El body se verifica en la llamada simulada de la prueba (`web/src/app/authentication-flow.spec.ts:74`, `web/src/app/authentication-flow.spec.ts:76`).

La aplicacion no configura bearer token para login.

## 3. Que espera recibir en exito

Axios debe resolver la peticion. `AuthService` devuelve `response.data` como `LoginResponse` (`web/src/app/services/auth.service.ts:20`, `web/src/app/services/auth.service.ts:23`). La interfaz declara `token` opcional en la linea 14 y `user` requerido en la 15; `user.username` es requerido, mientras `displayName` y `role` son opcionales (`web/src/app/models/auth.models.ts:7-10`, `web/src/app/models/auth.models.ts:13-15`). El cliente no valida este esquema en runtime: el componente solo comprueba que exista `token` (`web/src/app/login/login.component.ts:46`).

| Campo | Tipo declarado | Uso observado |
|---|---|---|
| `token` | Ya no se envia en el cuerpo (H-WEB-01). | La sesion viaja en la cookie `workshop_session` (`HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=3600`), emitida en el header `Set-Cookie`. El cliente no puede leerla. |
| `user.username` | `string`, requerido por el modelo | Se conserva en sesion y se envia luego como `owner`. |
| `user.displayName` | `string`, opcional | Se muestra en dashboard si existe; si no, se muestra `username`. |
| `user.role` | `string`, opcional | No se observa uso en la UI. |

Ejemplo exitoso de la caracterizacion:

```json
{
  "token": "test-token",
  "user": {
    "username": "student",
    "displayName": "Workshop Student"
  }
}
```

La respuesta de ejemplo proviene del fixture de test (`web/src/app/authentication-flow.spec.ts:61`, `web/src/app/authentication-flow.spec.ts:63-64`); no se presenta como una captura de un backend real.

Si la respuesta incluye `user`, el cliente guarda solo el usuario y preferencias (sin token en `localStorage`) y navega a `/dashboard` (`web/src/app/login/login.component.ts:51`, `web/src/app/login/login.component.ts:52`). El formato, expiracion y claims del token no se especifican en el frontend.

## 4. Como reacciona ante errores

| Caso | Reaccion de la UI |
|---|---|
| Usuario vacio | No hace request y muestra `Ingrese un usuario.` (`web/src/app/login/login.component.ts:30`, `web/src/app/login/login.component.ts:31`). |
| Contrasena vacia | No hace request y muestra `Ingrese una contraseña.` (`web/src/app/login/login.component.ts:34`, `web/src/app/login/login.component.ts:35`). |
| Respuesta 2xx sin token | No guarda una nueva sesion ni navega; muestra `El backend respondió sin token.` (`web/src/app/login/login.component.ts:46`, `web/src/app/login/login.component.ts:47`). |
| Error HTTP, incluidas credenciales rechazadas | Axios rechaza respuestas fuera de 2xx. La UI presenta `No se pudo autenticar a <username>.` y como detalle `response.data.message` si es string; en su defecto usa `Error.message` y despues `Error desconocido` (`web/src/app/login/login.component.ts:55`, `web/src/app/services/auth.service.ts:73`, `web/src/app/utils/api-error.ts:6`, `web/src/app/utils/api-error.ts:8`). No hay rama por codigo HTTP. |
| Timeout | La llamada tiene timeout de 5000 ms. Su rechazo usa el mismo `catch` que otros errores; se muestra el titulo anterior y el detalle elegido por el helper. No existe mensaje especial para timeout (`web/src/app/services/auth.service.ts:21`, `web/src/app/login/login.component.ts:54`, `web/src/app/login/login.component.ts:57`). |
| Red o servicio inaccesible | Se procesa como rechazo; se muestra el mismo titulo y el detalle extraido o fallback. |
| Respuesta inesperada | No hay validacion de esquema. Sin token, muestra el mensaje de respuesta sin token. Si no se puede leer `response.token`, la excepcion cae en el mismo `catch`. Si hay token pero falta `user`, el componente no lo rechaza y sigue el flujo; el resultado de esa sesion no esta garantizado por el codigo. |

El detalle se interpola como texto, no con `[innerHTML]` (`web/src/app/login/login.component.html:40`, `web/src/app/login/login.component.html:41`). Sin embargo, el backend puede proporcionar el `message` que la UI muestra; no hay transformacion que garantice que sea generico (H-WEB-03 en `HALLAZGOS.md`).

## 5. Notas de seguridad

- La contrasena se envia por HTTP a localhost en la configuracion actual. Es un entorno local de laboratorio; no se debe asumir que es seguro para redes externas. Confirmar HTTPS y URLs de despliegue.
- `AuthService` guarda solo el usuario en `localStorage`; el token vive en la cookie `HttpOnly` y no es accesible desde JavaScript. H-WEB-01 se atiende con este cambio (pendiente de revision humana) (`web/src/app/services/auth.service.ts:26`, `web/src/app/services/auth.service.ts:27`, `web/src/app/services/auth.service.ts:31`).
- `client` es un identificador fijo publico, no un secreto cliente.
- No se observa HTML dinamico en el mensaje de login; Angular interpola el titulo y detalle como texto.

# Tareas: `GET /api/tasks`

## 1. Quien lo llama

`DashboardComponent.ngOnInit()` lee token y usuario desde `AuthService`; si no hay token navega a `/login` y no llama a tareas. Con token, invoca `TasksService.getTasks(username, token)`, que ejecuta `axios.get` (`web/src/app/dashboard/dashboard.component.ts:44`, `web/src/app/dashboard/dashboard.component.ts:45`, `web/src/app/dashboard/dashboard.component.ts:48`, `web/src/app/dashboard/dashboard.component.ts:53`, `web/src/app/services/tasks.service.ts:11`).

## 2. Que envia

| Parte | Campo | Valor observado | Evidencia |
|---|---|---|---|
| Metodo/URL | `GET` | `http://localhost:8000/api/tasks` | `web/src/environments/environment.ts:4` |
| Query | `owner` | `username` guardado; si falta, el dashboard pasa cadena vacia | `web/src/app/dashboard/dashboard.component.ts:46`, `web/src/app/dashboard/dashboard.component.ts:53` |
| Header | `Authorization` | `Bearer <token>` leido por `AuthService` | `web/src/app/services/tasks.service.ts:13`, `web/src/app/services/tasks.service.ts:14` |
| Body | ninguno | No se configura body en esta llamada GET | `web/src/app/services/tasks.service.ts:13`, `web/src/app/services/tasks.service.ts:14` |
| Configuracion Axios | timeout | No se configura timeout especifico para esta llamada | `web/src/app/services/tasks.service.ts:13`, `web/src/app/services/tasks.service.ts:14` |

Ejemplo representativo de la caracterizacion (`web/src/app/authentication-flow.spec.ts:162`, `web/src/app/authentication-flow.spec.ts:164-165`):

```http
GET http://localhost:8000/api/tasks?owner=student
Authorization: Bearer test-token
```

El username se concatena directamente en la URL, sin codificacion explicita. Confirmar si los usernames permitidos requieren restricciones/codificacion adicional.

## 3. Que espera recibir en exito

Axios debe resolver la peticion. `TasksService` retorna `response.data` con tipo estatico `Task[]`, sin validar el JSON en runtime (`web/src/app/services/tasks.service.ts:13`, `web/src/app/services/tasks.service.ts:16`). Todos los campos del modelo son opcionales (`web/src/app/models/task.model.ts:1-8`).

| Campo de tarea | Tipo declarado | Uso observado |
|---|---|---|
| `id` | `number` o `string`, opcional | No se usa en la logica del dashboard. |
| `owner` | `string`, opcional | Se usa en la etiqueta calculada para la tarea. |
| `priority` | `string` o `number`, opcional | Se usa en la etiqueta y comparacion de orden. |
| `status` | `string`, opcional | Se excluye si es exactamente `ARCHIVED`; en otro caso se presenta. |
| `label` | `string`, opcional | Se calcula localmente y se asigna antes de mostrar. |
| `title` | `string`, opcional | Se muestra como titulo de la tarea. |
| `description` | `string`, opcional | Se muestra como descripcion. |

Ejemplo representativo de la caracterizacion; el dashboard calcula `label`:

```json
[
  {
    "id": 1,
    "owner": "student",
    "priority": "HIGH",
    "status": "TODO",
    "title": "High task"
  },
  {
    "id": 2,
    "owner": "student",
    "priority": "LOW",
    "status": "DONE",
    "title": "Low task"
  }
]
```

El dashboard filtra `ARCHIVED`, calcula etiquetas y ordena con el operador `>` (`web/src/app/dashboard/dashboard.component.ts:54`, `web/src/app/dashboard/dashboard.component.ts:55`, `web/src/app/dashboard/dashboard.component.ts:58`, `web/src/app/utils/legacy-format.ts:3`). El frontend no define el conjunto/orden de prioridades del backend; empates o prioridades ausentes siguen pendientes (H-WEB-08).

## 4. Como reacciona ante errores

| Caso | Reaccion de la UI |
|---|---|
| No hay token local | No hace GET; navega a `/login` (`web/src/app/dashboard/dashboard.component.ts:47`, `web/src/app/dashboard/dashboard.component.ts:48`). |
| Token invalido/HTTP no exitoso | Si Axios rechaza la llamada, el helper usa `response.data.detail` si es string, luego `Error.message` y finalmente `No se pudo cargar el dashboard`. Dashboard muestra el mensaje y termina la carga. No borra el token ni redirige automaticamente ante 401/403; esos status son ejemplos posibles, no contrato confirmado (`web/src/app/services/tasks.service.ts:18`, `web/src/app/dashboard/dashboard.component.ts:71`, `web/src/app/dashboard/dashboard.component.ts:72`). |
| Timeout | No se configura timeout propio para tareas y no hay reaccion especial a timeout. Si la promesa rechaza, se usa el mismo manejo general. |
| Red o servicio inaccesible | Si produce rechazo, se muestra el detalle seleccionado por el helper y termina la carga. |
| Respuesta 2xx inesperada | No hay validacion runtime. Si `data` no permite el `.filter` esperado, la excepcion ocurre dentro del `try`; el `catch` termina la carga y muestra `Error.message` (o el fallback para un valor que no sea `Error`) (`web/src/app/dashboard/dashboard.component.ts:53`, `web/src/app/dashboard/dashboard.component.ts:71`, `web/src/app/dashboard/dashboard.component.ts:72`). No se reintenta. |

El helper extrae el campo de error en `web/src/app/utils/api-error.ts:6`; el servicio crea el error en `web/src/app/services/tasks.service.ts:18`; el dashboard lo presenta en `web/src/app/dashboard/dashboard.component.html:18`. Un `detail` textual del backend puede mostrarse sin filtrar (H-WEB-03).

## 5. Notas de seguridad

- El token se envia como bearer desde `AuthService`; el token guardado en `localStorage` es accesible a JavaScript del mismo origen (H-WEB-01).
- `owner` procede del usuario guardado en el cliente; no es prueba de identidad ni autorizacion. El servidor debe validar el token y autorizar la identidad. El comportamiento del backend no se confirma desde `web/`.
- La URL actual usa HTTP y localhost. Confirmar TLS y URLs de despliegue antes de usar redes externas.
- Titulo, descripcion y error se muestran por interpolacion Angular; no se usa `[innerHTML]` en la vista de tareas (`web/src/app/dashboard/dashboard.component.html:18`, `web/src/app/dashboard/dashboard.component.html:21`).
- No se observa endpoint de logout. `logout()` elimina token/usuario y navega a `/login` (`web/src/app/dashboard/dashboard.component.ts:79`, `web/src/app/dashboard/dashboard.component.ts:80`, `web/src/app/dashboard/dashboard.component.ts:81`).

## Preguntas abiertas para acordar con los servicios

1. Que codigos HTTP y esquema de error garantizan los endpoints para credenciales invalidas, token expirado/invalido y errores internos?
2. Es obligatorio `user` junto a `token` en login? Que otros campos de usuario pueden devolverse?
3. Que tipos y valores son validos para `priority` y `status`? Como se ordenan prioridades iguales o ausentes?
4. La API deriva `owner` de la identidad autenticada o valida que coincida con `owner` solicitado?
5. Cuales son las URLs HTTPS de despliegue y se espera un endpoint remoto para invalidar la sesion?
