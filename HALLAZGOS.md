# Hallazgos

## API

| id | componente | hallazgo | tipo | explicacion | evidencia (archivo:linea) | severidad | estado |
|---|---|---|---|---|---|---|---|
| H-API-01 | api | Token Base64 con secreto embebido y sin firma | Vulnerabilidad | Base64 solo codifica el contenido; al no verificar una firma, un cliente puede alterar los datos de identidad. El secreto está en el código y los errores de validación se incorporan al mensaje HTTP. | api/app/main.py:14,17-25 | alta | Pendiente |
| H-API-02 | api | El cliente puede consultar y crear tareas para otro owner | Vulnerabilidad | `owner` se acepta desde query o body y prevalece sobre la identidad del token, permitiendo acceder o atribuir datos a otro usuario sin autorización ligada a la identidad. | api/app/main.py:67-70,77-83,90-93 | alta | Pendiente |
| H-API-03 | api | Consultas SQLite construidas por concatenación | Vulnerabilidad | Resuelto: filtros, inserciones y lectura por `lastrowid` usan parámetros SQLite; una prueba verifica que datos legítimos con apóstrofos se almacenan y consultan correctamente. | api/app/main.py:68-73,84-98,102-107 | alta | Resuelto |
| H-API-04 | api | Carga de archivos usa el nombre recibido y no limita el tamaño | Vulnerabilidad | El nombre del cliente se combina directamente con el directorio de cargas y el archivo completo se lee en memoria antes de escribirse; nombres manipulados o archivos grandes pueden causar escrituras fuera del destino previsto o consumo excesivo de recursos. | api/app/main.py:107-112 | alta | Pendiente |
| H-API-05 | api | Dependencias fijadas pendientes de validación SCA | Sugerencia | El manifiesto fija `urllib3` y `python-multipart` en las versiones indicadas por el reto. La presencia de esas versiones está confirmada, pero no se verificó aquí si tienen advisories aplicables; no se afirma un CVE. | api/requirements.txt:4-5 | baja | Pendiente |
| H-API-06 | api | Rutas, persistencia, reglas y serialización concentradas en un módulo | Refactor | La inicialización de SQLite, el mapeo de tareas y las rutas conviven en `main.py`, dificultando probar y modificar responsabilidades de forma aislada. | api/app/main.py:28-47,56-120 | baja | Pendiente |
| H-API-07 | api | Tipado crudo, excepciones amplias y lógica anidada; duplicación no encontrada | Refactor | Se usan diccionarios genéricos para requests/responses, se capturan excepciones amplias y `summary` contiene condicionales anidados. No se identificó un bloque duplicado concreto en el código consultado, por lo que esa parte del caso de Calidad queda como "No encontrado". | api/app/main.py:17-25,56,78,94-105,117-121 | baja | Pendiente |

## Contrato observado de la API

`docs/ENDPOINTS.md` no existe; lo siguiente se deriva del código y no representa un contrato acordado.

| Método y ruta | Entrada observada | Respuesta observada |
|---|---|---|
| `GET /api/tasks` | Token Bearer; `owner` opcional en query. | Lista de tareas con `id`, `title`, `description`, `status`, `owner`, `priority` y `createdAt`. |
| `POST /api/tasks` | Token Bearer; objeto JSON con `title`, `description`, `status`, `priority` y `owner` opcionales según los valores predeterminados del código. | HTTP 201 y una tarea con los campos de la lista anterior. |
| `GET /api/summary` | Token Bearer; `owner` opcional en query. | Objeto con `owner`, `total`, `byStatus` y `highPriorityOpen`. |
| `POST /api/requirements` | Token Bearer; archivo multipart en el campo `file`. | HTTP 201 y objeto con `owner`, `fileName`, `storedAt` y `size`. |
| `GET /api/backend-health` | Token Bearer. | Objeto con `requestedBy`, `status` y `body`; ante una excepción, `status` es `0` y `body` contiene su texto. |

El token observado se decodifica como Base64 y se interpreta como cuatro partes delimitadas por `|`; se comprueba un secreto y una expiración, pero no una firma, emisor o audiencia (`api/app/main.py:14-25`). En `/api/tasks` y `/api/summary`, `owner` de la petición puede prevalecer sobre el usuario del token (`api/app/main.py:67-70,90-93`). Estos comportamientos son riesgos pendientes, no contratos de autorización acordados.
