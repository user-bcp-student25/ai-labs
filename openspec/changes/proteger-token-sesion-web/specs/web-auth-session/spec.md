# Spec Delta

## Purpose

Define el comportamiento observable de la sesión autenticada del cliente web: el token de sesión no debe ser legible por JavaScript del mismo origen, las solicitudes autenticadas dependen de la cookie `HttpOnly` y el cierre de sesión limpia el estado local.

## ADDED Requirements

### Requirement: Token de sesión no legible por JavaScript tras el login
Tras una respuesta exitosa de `POST /auth/login`, el cliente web SHALL NOT dejar el token de sesión disponible para JavaScript mediante `localStorage`, `sessionStorage` ni `document.cookie`.

#### Scenario: Login exitoso no persiste el token en el almacenamiento
- **WHEN** el backend responde 2xx a `POST /auth/login` con `user` y la cabecera `Set-Cookie` de `workshop_session` marcada como `HttpOnly`
- **THEN** `localStorage`, `sessionStorage` y `document.cookie` no contienen el valor del token
- **AND** `localStorage` contiene únicamente el usuario y las preferencias

#### Scenario: Login exitoso elimina la clave heredada de token
- **WHEN** existe la clave heredada `workshop_token` en `localStorage` y el login termina con éxito
- **THEN** la clave `workshop_token` ya no existe en `localStorage`

### Requirement: Solicitudes autenticadas sin exposición del token
Después de un login exitoso, el cliente web SHALL completar las solicitudes autenticadas a `GET /api/tasks` enviando la cookie de sesión (`withCredentials: true`) sin leer ni reenviar el token en código JavaScript.

#### Scenario: Consulta de tareas tras login
- **WHEN** existe sesión local de usuario y el dashboard solicita tareas
- **THEN** la solicitud se envía a `/api/tasks?owner=<username>` con `withCredentials` habilitado
- **AND** las tareas devueltas se muestran sin que el cliente haya accedido al token

#### Scenario: Error HTTP al consultar tareas conserva la sesión local
- **WHEN** `GET /api/tasks` responde con un error HTTP que incluye `detail` en el cuerpo
- **THEN** el dashboard muestra el `detail` como mensaje de error
- **AND** la sesión local de usuario no se elimina

### Requirement: Cierre de sesión limpia el estado local del cliente
Al cerrar sesión, el cliente web MUST eliminar el usuario y la clave heredada `workshop_token` del almacenamiento local, conservar las preferencias del usuario y navegar a `/login`.

#### Scenario: Logout limpia usuario y conserva preferencias
- **WHEN** el usuario cierra sesión desde el dashboard
- **THEN** `localStorage` ya no contiene el usuario ni la clave `workshop_token`
- **AND** las preferencias guardadas siguen disponibles
- **AND** la aplicación navega a `/login`

#### Scenario: Sin sesión local no se realizan solicitudes autenticadas
- **WHEN** el usuario entra a `/dashboard` sin sesión local de usuario
- **THEN** la aplicación navega a `/login`
- **AND** no se envía ninguna solicitud a `/api/tasks`

### Requirement: Contrato de login preservado
El cliente web MUST enviar `POST /auth/login` con `username`, `password` y `client` en el cuerpo, y MUST mostrar los mensajes de error existentes sin modificar su texto ni su orden.

#### Scenario: Login con credenciales inválidas muestra el mensaje del backend
- **WHEN** el backend responde 401 con un `message` en el cuerpo
- **THEN** el formulario de login muestra el título `No se pudo autenticar a <usuario>.` y el `message` del backend como detalle
- **AND** no se guarda sesión local ni se navega a `/dashboard`

### Requirement: Pruebas sin valores sensibles
Las pruebas y la evidencia de esta capacidad MUST NOT imprimir ni almacenar valores reales de token, secretos o credenciales, y MUST usar valores de prueba aislados.

#### Scenario: Evidencia de no exposición sin valores de token
- **WHEN** se ejecutan las pruebas de login, acceso autenticado y logout
- **THEN** los resultados verifican la ausencia del token en `localStorage`, `sessionStorage` y `document.cookie`
- **AND** la salida de las pruebas no contiene el valor del token ni de credenciales

### Requirement: Invalidación de la cookie en el servidor (pendiente)
Al cerrar sesión, la cookie `workshop_session` SHALL dejar de ser aceptada por `/api/tasks`. Este requisito queda fuera del alcance de este cambio y depende de un cambio posterior en `auth/` y `api/`.

#### Scenario: Cookie válida tras logout en el cliente (limitación conocida)
- **WHEN** el usuario cierra sesión en el cliente web y la cookie `workshop_session` aún no ha expirado
- **THEN** este cambio no garantiza que `/api/tasks` rechace la cookie
- **AND** la limitación queda registrada en la evidencia del cambio como pendiente de backend
