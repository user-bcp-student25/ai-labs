# Evidencia de pruebas — API

## Alcance y fuente del contrato

Esta evidencia cubre los cinco endpoints de API descritos en [ENDPOINTS.md](./ENDPOINTS.md). Los casos se implementan en `api/tests/test_api.py`; no se modificó código de producción. Las respuestas esperadas se limitan al contrato observado, incluidos los errores que este documenta.

## Matriz de casos

| endpoint | caso | tipo | resultado esperado |
|---|---|---|---|
| `GET /api/tasks` | Listar tareas iniciales del usuario autenticado | Camino feliz | `200`; array de tareas del owner autenticado |
| `GET /api/tasks` | Consultar un owner sin tareas | Borde | `200`; array vacío |
| `GET /api/tasks` | Header de autenticación ausente | Error | `401`; cuerpo `detail` identifica token inválido |
| `GET /api/tasks` | SQLite no disponible | Error | `500`; cuerpo `Internal Server Error` |
| `GET /api/tasks` | Usuario solicita tareas de otro owner | Seguridad / regresión | No devolver tareas ajenas; el test debe fallar mientras exista el comportamiento IDOR |
| `POST /api/tasks` | Crear una tarea con campos válidos | Camino feliz | `201`; fila creada con los campos y valores enviados |
| `POST /api/tasks` | Crear con objeto vacío | Borde | `201`; defaults `title=""`, `description=""`, `status="TODO"`, `priority="MEDIUM"` y owner del token |
| `POST /api/tasks` | Header de autenticación ausente | Error | `401`; cuerpo `detail` identifica token inválido |
| `POST /api/tasks` | Falta el objeto JSON | Error | `422`; detalle señala el body requerido |
| `POST /api/tasks` | JSON no es un objeto (array o string) | Error | `422`; error de validación del body |
| `POST /api/tasks` | SQLite no disponible | Error | `500`; cuerpo `Internal Server Error` |
| `GET /api/summary` | Obtener resumen de tareas del usuario | Camino feliz | `200`; owner, total, conteo por estado y `highPriorityOpen` |
| `GET /api/summary` | Owner vacío | Borde | `200`; se usa la identidad del token |
| `GET /api/summary` | Header de autenticación ausente | Error | `401`; cuerpo `detail` identifica token inválido |
| `GET /api/summary` | SQLite no disponible | Error | `500`; cuerpo `Internal Server Error` |
| `POST /api/requirements` | Guardar archivo de texto válido | Camino feliz | `201`; metadatos de archivo y bytes persistidos |
| `POST /api/requirements` | Archivo vacío y sin extensión | Borde | `201`; tamaño `0` y archivo vacío persistido |
| `POST /api/requirements` | Header de autenticación ausente | Error | `401`; cuerpo `detail` identifica token inválido |
| `POST /api/requirements` | Falta el campo `file` | Error | `422`; detalle señala `body.file` |
| `POST /api/requirements` | Falla la escritura del archivo | Error | `500`; cuerpo `Internal Server Error` |
| `GET /api/backend-health` | Upstream responde `200` con `healthy` | Camino feliz | `200`; `requestedBy`, status `200` y body `healthy` |
| `GET /api/backend-health` | Upstream responde `204` sin cuerpo | Borde | `200`; status `204` y body vacío |
| `GET /api/backend-health` | Header de autenticación ausente | Error | `401`; cuerpo `detail` identifica token inválido |
| `GET /api/backend-health` | Falla la llamada upstream | Error documentado como respuesta `200` | `200`; status `0` y texto de excepción en `body` |

La autenticación ausente se verifica con una prueba parametrizada en los cinco endpoints. La prueba existente `test_rejects_invalid_token` también cubre un token inválido en `GET /api/tasks`. Los caminos felices de tareas, resumen y carga incluyen las pruebas existentes `test_lists_seeded_tasks`, `test_creates_task_and_summary` y `test_uploads_requirement`.

## Código de las pruebas añadidas

Las siguientes pruebas se añadieron a `api/tests/test_api.py`. Reutilizan `create_app`, `headers` y la fixture `tmp_path` del módulo existente.

```python
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/tasks"),
        ("POST", "/api/tasks"),
        ("GET", "/api/summary"),
        ("POST", "/api/requirements"),
        ("GET", "/api/backend-health"),
    ],
)
def test_all_endpoints_reject_missing_authentication(
    tmp_path: Path, method: str, path: str
) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.request(method, path)
    assert response.status_code == 401
    assert response.json()["detail"].startswith("Invalid token:")


def test_lists_no_tasks_for_unknown_owner(tmp_path: Path) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.get("/api/tasks?owner=unknown", headers=headers())
    assert response.status_code == 200
    assert response.json() == []


def test_empty_task_object_uses_documented_defaults(tmp_path: Path) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.post("/api/tasks", headers=headers(), json={})
    assert response.status_code == 201
    assert response.json()["title"] == ""
    assert response.json()["description"] == ""
    assert response.json()["status"] == "TODO"
    assert response.json()["priority"] == "MEDIUM"
    assert response.json()["owner"] == "student"


def test_empty_summary_owner_uses_authenticated_identity(tmp_path: Path) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.get("/api/summary?owner=", headers=headers())
    assert response.status_code == 200
    assert response.json()["owner"] == "student"
    assert response.json()["total"] == 2


def test_uploads_empty_file_without_extension(tmp_path: Path) -> None:
    upload_dir = tmp_path / "uploads"
    app = create_app(str(tmp_path / "workshop.db"), str(upload_dir))
    with TestClient(app) as client:
        response = client.post(
            "/api/requirements",
            headers=headers(),
            files={"file": ("requirements", b"", "application/octet-stream")},
        )
    assert response.status_code == 201
    assert response.json()["fileName"] == "requirements"
    assert response.json()["size"] == 0
    assert (upload_dir / "requirements").read_bytes() == b""


def test_backend_health_returns_upstream_health(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    pool_manager = Mock()
    pool_manager.request.return_value = SimpleNamespace(status=200, data=b"healthy")
    monkeypatch.setattr(api_main.urllib3, "PoolManager", lambda: pool_manager)

    with TestClient(app) as client:
        response = client.get("/api/backend-health", headers=headers())

    assert response.status_code == 200
    assert response.json() == {"requestedBy": "student", "status": 200, "body": "healthy"}


def test_backend_health_accepts_empty_upstream_response(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    pool_manager = Mock()
    pool_manager.request.return_value = SimpleNamespace(status=204, data=b"")
    monkeypatch.setattr(api_main.urllib3, "PoolManager", lambda: pool_manager)

    with TestClient(app) as client:
        response = client.get("/api/backend-health", headers=headers())

    assert response.status_code == 200
    assert response.json() == {"requestedBy": "student", "status": 204, "body": ""}
    pool_manager.request.assert_called_once()


def test_backend_health_returns_upstream_failure_in_body(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    pool_manager = Mock()
    pool_manager.request.side_effect = OSError("offline")
    monkeypatch.setattr(api_main.urllib3, "PoolManager", lambda: pool_manager)

    with TestClient(app) as client:
        response = client.get("/api/backend-health", headers=headers())

    assert response.status_code == 200
    assert response.json() == {"requestedBy": "student", "status": 0, "body": "offline"}


def test_create_task_requires_json_body(tmp_path: Path) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.post("/api/tasks", headers=headers())
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body"]


@pytest.mark.parametrize("payload", [[], "not-an-object"])
def test_create_task_rejects_non_object_json(tmp_path: Path, payload: object) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.post("/api/tasks", headers=headers(), json=payload)
    assert response.status_code == 422


def test_upload_requirement_requires_file(tmp_path: Path) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.post("/api/requirements", headers=headers())
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "file"]


@pytest.mark.parametrize(
    ("method", "path", "request_kwargs"),
    [
        ("GET", "/api/tasks", {}),
        ("POST", "/api/tasks", {"json": {"title": "db failure"}}),
        ("GET", "/api/summary", {}),
    ],
)
def test_task_database_errors_return_generic_internal_error(
    tmp_path: Path, method: str, path: str, request_kwargs: dict[str, object]
) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    app.state.connection.close()
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.request(method, path, headers=headers(), **request_kwargs)
    assert response.status_code == 500
    assert response.text == "Internal Server Error"


def test_upload_write_error_returns_generic_internal_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))

    def fail_write(_path: Path, _content: bytes) -> int:
        raise OSError("disk unavailable")

    monkeypatch.setattr(Path, "write_bytes", fail_write)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/requirements",
            headers=headers(),
            files={"file": ("requirements.txt", b"requirement", "text/plain")},
        )
    assert response.status_code == 500
    assert response.text == "Internal Server Error"


def test_user_cannot_read_tasks_owned_by_another_user(tmp_path: Path) -> None:
    app = create_app(str(tmp_path / "workshop.db"), str(tmp_path / "uploads"))
    with TestClient(app) as client:
        response = client.get("/api/tasks?owner=trainer", headers=headers(username="student"))
    assert response.status_code == 200
    assert all(task["owner"] == "student" for task in response.json())
```

## Ejecuciones y cobertura

Python de entorno virtual disponible: `api/.venv`. Comandos ejecutados con directorio de trabajo `api/`.

| comando | directorio | código de salida | resultado |
|---|---|---:|---|
| `.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing --cov-fail-under=85` | `api/` | `1` | `25 passed`, `1 failed`; falla la regresión IDOR descrita abajo. La cobertura total reportada es `98.18%`. |
| `.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing --cov-fail-under=85 -k 'not test_user_cannot_read_tasks_owned_by_another_user'` | `api/` | `0` | `25 passed`, `1 deselected`; todas las demás pruebas pasan. La cobertura total reportada es `98.18%`. |

**Método y valores:** `pytest-cov`/Coverage.py, con `branch = true` y `source = ["app"]` según `api/pyproject.toml`. Para `api/app/main.py`, el reporte cuenta 94/94 statements cubiertos (100%) y 14/16 branch outcomes cubiertos; cobertura combinada `(94 + 14) / (94 + 16) = 108/110 = 98.18%`. El comando usa el gate configurado de 85%. No se modificó código de producción, por lo que la cobertura específica de líneas de producción modificadas es N/A; el reporte global configurado para la aplicación API queda separado arriba.

## Fallos

- **H-API-02 — aislamiento de owner sin corregir.** `test_user_cannot_read_tasks_owned_by_another_user` falla: el token de `student` puede enviar `owner=trainer` y la API devuelve la tarea seed de `trainer`. La implementación toma el owner de la query (`api/app/main.py:69`) y lo aplica directamente al filtro (`api/app/main.py:72`) sin compararlo con la identidad. El contrato de [ENDPOINTS.md](./ENDPOINTS.md) también registra este riesgo. Se conserva como fallo visible; no se adaptó ni se ocultó el test. H-API-02 queda pendiente de corrección fuera del alcance de este paso.

## Pendientes

- Resolver H-API-02 y volver a ejecutar la suite completa; hasta entonces el comando completo tiene código de salida 1.
- Los comandos reportaron warnings deprecados de Starlette/FastAPI relacionados con `on_event`; no se modificó código de producción para abordarlos.

## Pruebas propuestas

- Añadir casos de límite de tamaño y validación de nombres/extensiones cuando se acuerden e implementen límites para la carga (H-API-04); el contrato observado actual no define límite ni extensión permitida.
- Ampliar la regresión H-API-02 para `GET /api/summary` cuando se implemente autorización ligada a la identidad.
