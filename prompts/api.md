Voy a adaptar el prompt al componente `api` y al contrato real de esta API, manteniendo la estructura y el enfoque de solo lectura. Revisaré únicamente la documentación general permitida y el punto de entrada Python para ajustar objetivo, ruta y comandos.

Searched for files matching `**/docs/**`, 1 match

Read memory

Read 

Read 

Read 

El punto de entrada confirma que la API Python no expone `/auth/login`: las entradas relevantes llegan por `/api/tasks` y `/api/summary`, y las consultas SQL están en `main.py`. Voy a comprobar el contrato local de pruebas para que el prompt pida casos apropiados a esta API, no a la autenticación Java.

Searched for files matching `**/api/docs/ENDPOINTS.md`, no matches

Read 

Read 

```text
AMBITO
Workspace ai-labs abierto en su raíz. Lee código solo en api/.
Todas las rutas parten de la raíz. Lee README.md, RETO.md y
docs/GOOD_PRACTICES.md. Lee docs/ENDPOINTS.md si existe. Este pedido es
de solo lectura; no escribas archivos ni ejecutes pruebas. Git se ejecuta
desde la raíz; las pruebas propuestas usan cwd api/. No leas ni modifiques
código de auth/ ni web/. Usa IDs H-API-NN y componente api.

CONTEXTO
ai-labs tiene una API Python con FastAPI y SQLite. No asumas que existe
POST /auth/login en este componente: identifica cómo se autentican las
rutas de la API y qué datos vienen de la identidad frente a los parámetros
y cuerpos enviados por el cliente. Localiza el recorrido desde las rutas
de /api/tasks y /api/summary hasta las consultas SQLite, incluyendo la
creación de tareas. Revisa api/tests/test_api.py para conocer el contrato
observado. No des por cierta la lista de RETO.md.

OBJETIVO
Determinar si entradas controladas por el cliente llegan concatenadas a
consultas SQL de la API. Examina, como mínimo, el filtro owner de las
consultas de tareas y resumen, y los campos usados al insertar una tarea.
Distingue esos valores de los derivados de la identidad autenticada.

RESTRICCIONES
No edites código ni ejecutes ataques contra servicios remotos. Usa solo
código y datos ficticios locales al proponer comprobaciones. No ejecutes
pruebas; propónlas únicamente. Si falta un archivo o no puedes comprobar
una ruta, dilo. No cambies contratos ni leas otros componentes. No uses
payloads de explotación; basta con proponer entradas benignas, como un
valor que contenga una comilla.

CRITERIOS DE ACEPTACION
Identifica el recorrido de cada entrada relevante hasta la consulta, con
archivo y línea. Distingue concatenación, parametrización y cualquier caso
no comprobado; no infieras que toda consulta tiene el mismo comportamiento.
Propón pruebas locales con token válido, token inválido y entradas con
comilla en los parámetros o campos pertinentes. Indica el resultado
esperado según el contrato observado, incluyendo códigos HTTP y efectos
sobre los datos cuando se puedan determinar. No afirmes que una prueba
pasó si solo la propusiste.

FORMATO DE RESPUESTA
Tabla: afirmación | evidencia archivo:línea | comprobado o hipótesis |
prueba propuesta. Termina con preguntas abiertas y comandos no ejecutados.
```