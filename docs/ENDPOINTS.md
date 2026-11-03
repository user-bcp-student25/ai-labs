# Contrato HTTP — API FastAPI

Base URL local documentada en `README.md`: `http://localhost:8000`.

## Estado del contrato

- **Observado:** las rutas, campos, valores predeterminados y ejemplos de abajo se comprobaron contra el código actual de `api/app/main.py`; los ejemplos de respuesta también se contrastaron con `TestClient`.
- **Acordado:** no se encontró un contrato API previo ni evidencia de un acuerdo externo distinto. Este documento registra el comportamiento actual, no una aprobación de cambios futuros.
- **Riesgos pendientes:** la autenticación usa un token Base64 modificable, el cliente puede seleccionar `owner` y la carga no limita ni normaliza el archivo. Véanse las notas de seguridad de cada ruta y `HALLAZGOS.md`.

## Autenticación común

Todas las rutas documentadas requieren este header:

```http
Authorization: Bearer c3R1ZGVudHxTVFVERU5UfDQxMDI0NDQ4MDB8V09SS1NIT1BfU0VDUkVUXzIwMjY=
```

El valor de ejemplo es Base64 de `student|STUDENT|4102444800|WORKSHOP_SECRET_2026`, válido hasta el timestamp indicado. Es una credencial ficticia del laboratorio, no un JWT ni un secreto para producción. El código reemplaza literalmente `Bearer ` y decodifica el resto; no verifica una firma, emisor o audiencia. En los ejemplos, la identidad resultante es `student`.

Las rutas no definen modelos Pydantic de respuesta. Los tipos descritos a continuación son los valores serializados por el código actual.

---

## `GET /api/tasks`

### 1. Qué hace

Lista las tareas del `owner` solicitado; si no se envía, usa el nombre de usuario extraído del token.

### 2. Autenticación

Requiere `Authorization: Bearer <token>` según la sección [Autenticación común](#autenticación-común).

### 3. Request

| Campo/parámetro | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `Authorization` (header) | string | Sí | Token Base64 legacy con prefijo `Bearer `. |
| `owner` (query) | string | No | Propietario usado como filtro; si falta o está vacío, se usa `username` del token. |

Ejemplo completo:

```http
GET /api/tasks?owner=student HTTP/1.1
Host: localhost:8000
Authorization: Bearer c3R1ZGVudHxTVFVERU5UfDQxMDI0NDQ4MDB8V09SS1NIT1BfU0VDUkVUXzIwMjY=
```

### 4. Response exitosa

**Estado:** `200 OK`. La respuesta es un array; puede estar vacío.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | integer | Identificador SQLite de la tarea. |
| `title` | string | Título. |
| `description` | string | Descripción. |
| `status` | string | Estado almacenado. |
| `owner` | string | Propietario almacenado. |
| `priority` | string | Prioridad almacenada. |
| `createdAt` | string | Fecha SQLite en formato `YYYY-MM-DD HH:MM:SS`, sin zona horaria. |

Ejemplo completo en una base recién inicializada:

```json
[
  {
    "id": 1,
    "title": "Refactor login",
    "description": "Separar responsabilidades en frontend",
    "status": "TODO",
    "owner": "student",
    "priority": "HIGH",
    "createdAt": "2026-11-02 22:12:49"
  },
  {
    "id": 2,
    "title": "Review API",
    "description": "Revisar seguridad de endpoints",
    "status": "IN_PROGRESS",
    "owner": "student",
    "priority": "MEDIUM",
    "createdAt": "2026-11-02 22:12:49"
  }
]
```

El contenido y los identificadores dependen de los datos existentes en SQLite; la aplicación inserta las tareas de ejemplo únicamente cuando la tabla está vacía.

### 5. Respuestas de error

| Estado | Cuándo ocurre | Ejemplo de cuerpo |
|---|---|---|
| `401 Unauthorized` | Header ausente o token que no puede decodificarse/validarse; el texto dentro de `detail` varía según el error. | `{"detail":"Invalid token: invalid token"}` |
| `500 Internal Server Error` | Error no manejado al consultar SQLite. FastAPI devuelve texto plano con su configuración actual. | `Internal Server Error` |

### 6. Notas de seguridad

- `owner` es un filtro controlado por el cliente y no se compara con la identidad. Un usuario con un token válido puede solicitar tareas de otro `owner` (`H-API-02`, pendiente).
- La identidad del filtro proviene de un token Base64 sin firma (`H-API-01`, pendiente).
- La consulta usa un parámetro SQLite para el valor del filtro; esto no corrige la autorización.

---

## `POST /api/tasks`

### 1. Qué hace

Crea una tarea y devuelve la fila guardada.

### 2. Autenticación

Requiere `Authorization: Bearer <token>` según la sección [Autenticación común](#autenticación-común).

### 3. Request

`Content-Type: application/json`. El cuerpo debe ser un objeto JSON; el objeto es obligatorio, pero todos sus campos son opcionales.

| Campo/parámetro | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `Authorization` (header) | string | Sí | Token Base64 legacy con prefijo `Bearer `. |
| `title` (body) | valor JSON | No | Se convierte a string; predeterminado `""`. |
| `description` (body) | valor JSON | No | Se convierte a string; predeterminado `""`. |
| `status` (body) | valor JSON | No | Se convierte a string; predeterminado `"TODO"`. |
| `priority` (body) | valor JSON | No | Se convierte a string; predeterminado `"MEDIUM"`. |
| `owner` (body) | valor JSON | No | Se convierte a string; predeterminado al `username` del token. Si se envía, se almacena tal cual tras la conversión. |

Ejemplo completo:

```http
POST /api/tasks HTTP/1.1
Host: localhost:8000
Authorization: Bearer c3R1ZGVudHxTVFVERU5UfDQxMDI0NDQ4MDB8V09SS1NIT1BfU0VDUkVUXzIwMjY=
Content-Type: application/json

{
  "title": "Review access",
  "description": "Check owner scope",
  "status": "TODO",
  "priority": "HIGH",
  "owner": "student"
}
```

### 4. Response exitosa

**Estado:** `201 Created`.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | integer | Identificador asignado por SQLite. |
| `title` | string | Título almacenado. |
| `description` | string | Descripción almacenada. |
| `status` | string | Estado almacenado. |
| `owner` | string | Propietario almacenado. |
| `priority` | string | Prioridad almacenada. |
| `createdAt` | string | Fecha SQLite en formato `YYYY-MM-DD HH:MM:SS`, sin zona horaria. |

Ejemplo completo:

```json
{
  "id": 4,
  "title": "Review access",
  "description": "Check owner scope",
  "status": "TODO",
  "owner": "student",
  "priority": "HIGH",
  "createdAt": "2026-11-02 22:12:49"
}
```

El `id` y `createdAt` varían según el estado y reloj de la base de datos. En el ejemplo se asume una base recién inicializada con las tres filas semilla.

### 5. Respuestas de error

| Estado | Cuándo ocurre | Ejemplo de cuerpo |
|---|---|---|
| `401 Unauthorized` | Header ausente o token que no puede decodificarse/validarse. | `{"detail":"Invalid token: invalid token"}` |
| `422 Unprocessable Entity` | Falta el objeto JSON requerido. | `{"detail":[{"type":"missing","loc":["body"],"msg":"Field required","input":null}]}` |
| `422 Unprocessable Entity` | El cuerpo no es un objeto JSON compatible con `dict`. El detalle identifica la validación del cuerpo. | La forma depende del valor JSON recibido; ejemplo del caso sin cuerpo: `{"detail":[{"type":"missing","loc":["body"],"msg":"Field required","input":null}]}` |
| `500 Internal Server Error` | Error no manejado al insertar o leer SQLite. | `Internal Server Error` (texto plano). |

### 6. Notas de seguridad

- `owner` puede ser proporcionado por el cliente y almacenarse para otra persona sin autorización (`H-API-02`, pendiente).
- La autenticación depende de un token Base64 modificable (`H-API-01`, pendiente).
- Los valores de SQL están parametrizados; no enviar datos sensibles en el token de ejemplo.

---

## `GET /api/summary`

### 1. Qué hace

Devuelve el total y los conteos de estado y tareas abiertas de prioridad alta para un `owner`.

### 2. Autenticación

Requiere `Authorization: Bearer <token>` según la sección [Autenticación común](#autenticación-común).

### 3. Request

| Campo/parámetro | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `Authorization` (header) | string | Sí | Token Base64 legacy con prefijo `Bearer `. |
| `owner` (query) | string | No | Propietario usado como filtro; si falta o está vacío, se usa `username` del token. |

Ejemplo completo:

```http
GET /api/summary?owner=student HTTP/1.1
Host: localhost:8000
Authorization: Bearer c3R1ZGVudHxTVFVERU5UfDQxMDI0NDQ4MDB8V09SS1NIT1BfU0VDUkVUXzIwMjY=
```

### 4. Response exitosa

**Estado:** `200 OK`.

| Campo | Tipo | Descripción |
|---|---|---|
| `owner` | string | Propietario consultado. |
| `total` | integer | Número total de tareas del propietario. |
| `byStatus` | object con valores integer | Mapa de estado a cantidad; los estados sin tareas no aparecen. |
| `highPriorityOpen` | integer | Tareas con prioridad `HIGH` cuyo estado no es `DONE` ni `ARCHIVED`. |

Ejemplo completo después de crear la tarea del ejemplo anterior:

```json
{
  "owner": "student",
  "total": 3,
  "byStatus": {
    "TODO": 2,
    "IN_PROGRESS": 1
  },
  "highPriorityOpen": 2
}
```

### 5. Respuestas de error

| Estado | Cuándo ocurre | Ejemplo de cuerpo |
|---|---|---|
| `401 Unauthorized` | Header ausente o token que no puede decodificarse/validarse. | `{"detail":"Invalid token: invalid token"}` |
| `500 Internal Server Error` | Error no manejado al consultar SQLite. | `Internal Server Error` (texto plano). |

### 6. Notas de seguridad

- `owner` es controlado por el cliente y puede usarse para consultar los conteos de otro propietario (`H-API-02`, pendiente).
- La identidad no se verifica mediante firma JWT (`H-API-01`, pendiente).
- El filtro SQLite está parametrizado.

---

## `POST /api/requirements`

### 1. Qué hace

Recibe y guarda un archivo de requerimientos en el directorio de cargas configurado.

### 2. Autenticación

Requiere `Authorization: Bearer <token>` según la sección [Autenticación común](#autenticación-común).

### 3. Request

`Content-Type: multipart/form-data`.

| Campo/parámetro | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `Authorization` (header) | string | Sí | Token Base64 legacy con prefijo `Bearer `. |
| `file` (form-data) | archivo binario | Sí | Archivo a guardar. Su nombre de cliente se usa como nombre de destino. |

Ejemplo completo:

```bash
curl -X POST "http://localhost:8000/api/requirements" \
  -H "Authorization: Bearer c3R1ZGVudHxTVFVERU5UfDQxMDI0NDQ4MDB8V09SS1NIT1BfU0VDUkVUXzIwMjY=" \
  -F "file=@requirements.txt;type=text/plain"
```

### 4. Response exitosa

**Estado:** `201 Created`.

| Campo | Tipo | Descripción |
|---|---|---|
| `owner` | string | `username` extraído del token. |
| `fileName` | string o null | Nombre recibido en el multipart. |
| `storedAt` | string | Ruta formada al combinar el directorio de cargas con el nombre recibido; depende de la configuración y del sistema operativo. |
| `size` | integer | Número de bytes leídos y escritos. |

Ejemplo completo, suponiendo que el directorio configurado es `C:\example\uploads` y el archivo contiene 24 bytes:

```json
{
  "owner": "student",
  "fileName": "requirements.txt",
  "storedAt": "C:\\example\\uploads\\requirements.txt",
  "size": 24
}
```

### 5. Respuestas de error

| Estado | Cuándo ocurre | Ejemplo de cuerpo |
|---|---|---|
| `401 Unauthorized` | Header ausente o token que no puede decodificarse/validarse. | `{"detail":"Invalid token: invalid token"}` |
| `422 Unprocessable Entity` | Falta el campo multipart obligatorio `file`. | `{"detail":[{"type":"missing","loc":["body","file"],"msg":"Field required","input":null}]}` |
| `500 Internal Server Error` | Error no manejado al escribir el archivo. | `Internal Server Error` (texto plano). |

### 6. Notas de seguridad

- El nombre de archivo recibido se combina directamente con el directorio de destino. No se normaliza ni valida extensión.
- Se lee el archivo completo en memoria antes de escribirlo y no existe límite de tamaño en esta ruta (`H-API-04`, pendiente).
- `storedAt` revela la ruta del servidor. La identidad procede del token Base64 legacy.

---

## `GET /api/backend-health`

### 1. Qué hace

Consulta el endpoint de salud de autenticación configurado por el servidor y devuelve su estado y cuerpo.

### 2. Autenticación

Requiere `Authorization: Bearer <token>` según la sección [Autenticación común](#autenticación-común).

### 3. Request

| Campo/parámetro | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `Authorization` (header) | string | Sí | Token Base64 legacy con prefijo `Bearer `. |
| Query/body | — | No | Esta ruta no define parámetros de query ni cuerpo. |

Ejemplo completo:

```http
GET /api/backend-health HTTP/1.1
Host: localhost:8000
Authorization: Bearer c3R1ZGVudHxTVFVERU5UfDQxMDI0NDQ4MDB8V09SS1NIT1BfU0VDUkVUXzIwMjY=
```

### 4. Response exitosa

**Estado HTTP de la API:** `200 OK`, incluso cuando la consulta upstream falla.

| Campo | Tipo | Descripción |
|---|---|---|
| `requestedBy` | string | `username` extraído del token. |
| `status` | integer | Status HTTP del upstream; `0` si la solicitud upstream lanza una excepción. |
| `body` | string | Cuerpo upstream decodificado como UTF-8, o texto de la excepción si falla la solicitud. |

Ejemplo completo si el upstream responde HTTP 200 con el cuerpo UTF-8 `healthy`:

```json
{
  "requestedBy": "student",
  "status": 200,
  "body": "healthy"
}
```

### 5. Respuestas de error

| Estado | Cuándo ocurre | Ejemplo de cuerpo |
|---|---|---|
| `401 Unauthorized` | Header ausente o token que no puede decodificarse/validarse. | `{"detail":"Invalid token: invalid token"}` |
| `200 OK` con error upstream | La solicitud upstream lanza una excepción; no se propaga como status HTTP de error de la API. | `{"requestedBy":"student","status":0,"body":"offline"}` |

La excepción concreta y el texto de `body` dependen del fallo upstream. El ejemplo `offline` se comprobó con una excepción simulada.

### 6. Notas de seguridad

- `AUTH_HEALTH_URL` se lee de la configuración del proceso; si no está definida, el código usa `http://localhost:8080/q/health`.
- El cuerpo upstream se devuelve sin filtrar. Si la solicitud falla, el texto de excepción también se devuelve al cliente.
- La autenticación sigue usando el token Base64 legacy; `role` no restringe esta operación.
