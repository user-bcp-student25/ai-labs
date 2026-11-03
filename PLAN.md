# Plan de corrección

## API

**Estado del plan:** Aprobado por el usuario (confirmación recibida el 2026-11-02).

### Selección de esta actualización

- `H-API-01`: riesgo alto de suplantación porque Base64 no verifica la integridad del token.
- `H-API-02`: riesgo alto de acceso o escritura de tareas bajo el `owner` que envía el cliente.
- `H-API-03`: riesgo alto de alterar consultas SQLite mediante valores concatenados.

Los tres IDs existen en `HALLAZGOS.md` y están `Pendiente`. Esta actualización desarrolla esos tres apartados; se conservan más abajo los apartados previos `H-API-04` a `H-API-07` como historial, fuera de la selección actual.

### Alcance y orden propuesto

`docs/ENDPOINTS.md` no existe; se usa el contrato observado que quedó registrado en `HALLAZGOS.md`. Se mantienen rutas, métodos, campos y formas de respuesta para las operaciones válidas de los usuarios autenticados. Cambiar el formato del token Base64 a JWT es un cambio explícito del contrato de autenticación observado, necesario para cumplir la verificación real; no se debe implementar hasta coordinarlo con su emisor. Los intentos de acceder o escribir bajo otro `owner` se rechazarán intencionalmente.

Antes de cambiar código de producción, añadir y ejecutar las caracterizaciones indicadas en cada apartado de `api/tests/test_api.py`. Para `H-API-01`, coordinar con el emisor el algoritmo permitido, `issuer`, `audience` y el mecanismo de configuración de la clave; no incluir valores secretos en el repositorio. La API no identificará ni modificará el emisor.

Orden sugerido: caracterizar primero los tres comportamientos válidos observados, implementar `H-API-01` tras la coordinación de JWT, luego `H-API-02` usando exclusivamente la identidad verificada y finalmente `H-API-03`. Mantener funciones con una sola responsabilidad, usar nombres descriptivos, no duplicar lógica, evitar anidamiento profundo y definir constantes con nombre para valores no triviales.

### H-API-01 — Token Base64 con secreto embebido y sin firma

- **Hallazgo y estado:** `H-API-01`, Vulnerabilidad, alta, `Pendiente` (`HALLAZGOS.md`). Evidencia actual: `api/app/main.py:14,17-25`.
- **Problema:** Base64 no autentica el contenido; el secreto está fijado en el código y los errores se exponen en la respuesta 401. El formato observado es distinto de un JWT firmado.
- **Cambio propuesto:** Verificar JWT mediante una biblioteca mantenida y evaluada por SCA, con algoritmo permitido explícitamente, firma, emisor, audiencia y expiración validados. Externalizar clave y valores de emisor/audiencia; devolver un error 401 genérico y conservar en `identity` los claims que usan las rutas. No aceptar el token Base64 como fallback, porque mantendría la suplantación. La incorporación de una biblioteca JWT se justifica si no hay una ya disponible: la biblioteca estándar no ofrece validación JWT segura lista para usar.
- **Archivos a tocar:** `api/app/main.py`; nuevo `api/app/security.py`; `api/requirements.txt` solo si se justifica y evalúa una biblioteca JWT (no aparece una en el manifiesto actual); `api/tests/test_api.py` o un módulo nuevo `api/tests/test_auth.py`.
- **Caracterización previa:** Antes de editar producción, probar con el formato válido actual los endpoints protegidos y registrar códigos y formas de respuesta; probar también que un token inválido recibe 401. Después de coordinar el emisor, añadir regresiones para firma alterada, expiración, emisor/audiencia incorrectos y configuración faltante. El paso a JWT cambia el formato interno del Bearer observado; la coordinación y aprobación de compatibilidad siguen pendientes.

### H-API-02 — Owner controlado por el cliente

- **Hallazgo y estado:** `H-API-02`, Vulnerabilidad, alta, `Pendiente` (`HALLAZGOS.md`). Evidencia actual: `api/app/main.py:67-70,77-83,90-93`.
- **Problema:** El query/body puede seleccionar un propietario diferente del usuario autenticado.
- **Cambio propuesto:** Derivar el propietario autorizado exclusivamente de `identity["username"]`. Para conservar la forma de las peticiones, mantener el parámetro/campo `owner` como opcional, pero rechazar con 403 una petición autenticada que solicite un propietario distinto. Consultar y crear siempre con la identidad verificada; preservar campos y formato de las respuestas para peticiones propias.
- **Archivos a tocar:** `api/app/main.py`; `api/tests/test_api.py`.
- **Caracterización previa:** Capturar respuestas y campos de lista, creación y resumen para el usuario autenticado, incluyendo el comportamiento con `owner` omitido y coincidente. Luego agregar regresiones para que una consulta o creación con otro owner sea denegada y no lea ni escriba datos de ese usuario.

### H-API-03 — Consultas SQLite construidas por concatenación

- **Hallazgo y estado:** `H-API-03`, Vulnerabilidad, alta, `Resuelto` (`HALLAZGOS.md`). Los filtros, la inserción y la lectura por `lastrowid` ahora usan parámetros SQLite.
- **Problema:** Los valores dinámicos se interpolan en SELECT e INSERT; una entrada puede cambiar la interpretación de la consulta.
- **Cambio propuesto:** Sustituir interpolación por parámetros `?` en todos los valores dinámicos, incluidos filtros por propietario, campos de creación y la lectura por `lastrowid`. No construir cláusulas SQL con entrada del cliente.
- **Archivos a tocar:** `api/app/main.py`; `api/tests/test_api.py`.
- **Caracterización previa:** Probar y guardar la respuesta de las consultas normales y la creación/lectura de una tarea con texto que contenga comillas, verificando que se almacena y recupera literalmente y que el resumen sigue contando los datos propios. Ejecutar estos casos antes de cambiar las consultas.

### H-API-04 — Nombre y contenido de archivos sin límites

- **Hallazgo y estado:** `H-API-04`, Vulnerabilidad, alta, `Pendiente` (`HALLAZGOS.md`). Evidencia actual: `api/app/main.py:107-112`.
- **Problema:** El nombre proporcionado se usa como ruta y el contenido completo se lee en memoria; esto permite destinos no previstos y consumo de almacenamiento/memoria sin límite.
- **Cambio propuesto:** Normalizar y validar el nombre, guardar bajo un nombre seguro dentro del directorio configurado, verificar una extensión permitida y limitar bytes durante la lectura antes de persistir. Limpiar cualquier archivo parcial ante rechazo/error. Mantener el endpoint y los campos `owner`, `fileName`, `storedAt` y `size` de la respuesta, sin exponer texto de excepciones. Los valores concretos de extensiones y tamaño son decisión pendiente; definirlos como constantes con nombre, sin valores mágicos.
- **Archivos candidatos:** `api/app/main.py`; posible módulo nuevo `api/app/file_storage.py`; `api/tests/test_api.py` o nuevo `api/tests/test_uploads.py`.
- **Caracterización previa:** Probar una carga válida `text/plain` y capturar código 201, claves de respuesta, tamaño y bytes persistidos. Tras acordar límites, cubrir extensión permitida/no permitida, tamaño máximo y máximo más uno, nombre normalizado y ausencia de archivo parcial al rechazar.

### H-API-05 — Dependencias fijadas pendientes de validación SCA

- **Hallazgo y estado:** `H-API-05`, Sugerencia, baja, `Pendiente` (`HALLAZGOS.md`). Evidencia actual: `api/requirements.txt:4-5`. La matriz confirma las versiones fijadas, no un CVE.
- **Problema:** No se ha registrado evidencia de advisories para `urllib3==2.5.0` ni `python-multipart==0.0.21`; no es correcto declarar que son vulnerables sin consultarla.
- **Cambio propuesto:** Consultar un scanner/advisory source mantenido para las versiones transitivas y directas. Si confirma una versión afectada, seleccionar una versión corregida compatible, documentar advisory y actualizar únicamente el pin necesario; si no confirma afectación, conservar el pin y registrar el resultado. No silenciar alertas ni añadir una excepción al scanner.
- **Archivos candidatos:** `api/requirements.txt` solo si el análisis evidencia una actualización necesaria; `api/tests/test_api.py` solo si la actualización cambia comportamiento; `docs/TESTING.md` para evidencia de ejecución cuando ese entregable se trabaje.
- **Caracterización previa:** Ejecutar y registrar la suite API existente antes de cualquier cambio de dependencia y usarla después como regresión de compatibilidad. La consulta SCA y sus resultados son evidencia separada; no se sustituye por una prueba de aplicación ni se afirma un resultado aún no obtenido.

### H-API-06 — Rutas, persistencia, reglas y serialización en un módulo

- **Hallazgo y estado:** `H-API-06`, Refactor, baja, `Pendiente` (`HALLAZGOS.md`). Evidencia actual: `api/app/main.py:28-47,56-120`.
- **Problema:** Inicialización de SQLite, rutas HTTP, reglas y mapeo de resultados están concentrados en `main.py`, haciendo más difícil aislar responsabilidades y probarlas.
- **Cambio propuesto:** Extraer gradualmente rutas, servicio y repositorio conforme a `docs/GOOD_PRACTICES.md`: rutas FastAPI → servicios de reglas → repositorio SQLite. Mantener en `main.py` la creación/configuración de la app y conservar `create_app(db_path, upload_dir)` y `app` para compatibilidad con el arranque y las pruebas actuales. El repositorio debe usar consultas parametrizadas.
- **Archivos candidatos:** `api/app/main.py`; nuevos `api/app/routes.py`, `api/app/services.py` y `api/app/repository.py`; `api/tests/test_api.py`. Los modelos tipados se planifican en `H-API-07`.
- **Caracterización previa:** Antes de mover código, probar las rutas y formas de respuesta registradas en `HALLAZGOS.md`, persistencia de tareas, resumen, carga válida, creación de app con paths temporales y cierre de conexión. Tras cada extracción, ejecutar los mismos casos y comparar resultado y status code.

### H-API-07 — Tipado crudo, excepciones amplias y lógica anidada

- **Hallazgo y estado:** `H-API-07`, Refactor, baja, `Pendiente` (`HALLAZGOS.md`). Evidencia actual: `api/app/main.py:17-25,56,78,94-105,117-121`.
- **Problema:** Requests/responses usan diccionarios sin modelos de dominio, algunos bloques capturan `Exception` y exponen su texto, y `summary` contiene condicionales anidados. El análisis actual no demuestra un bloque duplicado concreto; no se extraerá código solo para afirmar que se eliminó duplicación.
- **Cambio propuesto:** Crear modelos Pydantic de entrada/salida que preserven nombres, campos, valores predeterminados y serialización observados. Reducir cada función a una responsabilidad, reemplazar condicionales anidados por condiciones combinadas o retornos anticipados cuando mantenga la semántica, capturar errores esperados específicos y responder con mensajes genéricos; registrar detalles solo en logs controlados. Extraer helpers únicamente si se confirma duplicación real.
- **Archivos candidatos:** `api/app/main.py`; nuevo `api/app/models.py`; módulos de rutas/servicio indicados en `H-API-06`; `api/tests/test_api.py`.
- **Caracterización previa:** Probar esquemas JSON y códigos de éxito de tareas, resumen y carga; fijar valores de borde de `summary` para tareas DONE, ARCHIVED y abiertas de prioridad alta. Registrar la respuesta 401 actual sin hacer depender la regresión del texto interno de una excepción; después del cambio, validar mensaje genérico y que los detalles no se devuelvan al cliente.

## Decisiones y dependencias pendientes

- Confirmar con el emisor de identidad el algoritmo, clave, `issuer`, `audience` y despliegue de configuración JWT antes de dejar de aceptar el formato Base64 observado.
- `H-API-01` y `H-API-02` permanecen pendientes: el usuario confirmó el 2026-11-02 que el contrato JWT aún no está coordinado.
- Acordar extensiones permitidas y tamaño máximo de archivo antes de implementar límites.
- Completar la evaluación SCA antes de cambiar versiones o declarar un CVE.
- La aprobación general del plan por el usuario está registrada arriba; no implica que la coordinación del emisor JWT esté completa. Las ejecuciones de esta selección se registran en la sección siguiente. Los cambios intencionales de seguridad y sus resultados deberán revisarse y evidenciarse en sus pasos correspondientes.

## Ejecuciones de esta selección

| Fecha | Componente | IDs | Comando (cwd `api/`) | Resultado |
|---|---|---|---|---|
| 2026-11-02 | api | H-API-01, H-API-02, H-API-03 | `.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing` | Línea base: 4 pruebas pasaron; cobertura de `app` 91%. |
| 2026-11-02 | api | H-API-03 | `.\.venv\Scripts\python.exe -m pytest tests/test_api.py::test_preserves_apostrophes_in_task_data_and_owner_filters -q` | Antes del cambio, la caracterización falló como se esperaba: el POST respondió 500 en vez de 201. |
| 2026-11-02 | api | H-API-03 | `.\.venv\Scripts\python.exe -m pytest tests/test_api.py::test_preserves_apostrophes_in_task_data_and_owner_filters -q` | Después del cambio, pasó la prueba de regresión. |
| 2026-11-02 | api | H-API-03 | `.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing --cov-fail-under=85` | 5 pruebas pasaron; cobertura total 90.91%, supera el umbral de 85%. |
