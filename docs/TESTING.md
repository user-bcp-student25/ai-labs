# Pruebas del flujo web

## Alcance y enfoque

Componente: `web`. IDs cubiertos: H-WEB-01, H-WEB-02, H-WEB-03, H-WEB-05, H-WEB-06 y H-WEB-08. El contrato de referencia es el comportamiento observado en `docs/ENDPOINTS.md`; no se infieren respuestas ni códigos HTTP del backend.

La suite usa Vitest en Node, mockea Axios y crea doubles locales para Router y `localStorage` (`web/vitest.config.ts:3-10`, `web/src/app/authentication-flow.spec.ts:15-54`). Ninguna prueba de esta corrida contacta los servicios externos. La prueba de login/HTTP valida URL, body, timeout y headers configurados; no es una prueba de transporte en red.

## Matriz de casos

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login | Credenciales validas; respuesta con token y usuario (`web/src/app/authentication-flow.spec.ts:59`) | Camino feliz | POST con `username`, `password`, `client` y timeout 5000 ms; guarda token/usuario/preferencias y navega a `/dashboard`. |
| Tareas | Respuesta con tareas visibles y una archivada (`web/src/app/authentication-flow.spec.ts:197`) | Camino feliz | GET con `owner` y bearer token; excluye `ARCHIVED`, calcula etiquetas y conserva el orden observado para las prioridades distintas del fixture. |
| Login | Username vacio (`web/src/app/authentication-flow.spec.ts:86`) | Borde | No hace POST; muestra `Ingrese un usuario.`. |
| Login | Password vacio (`web/src/app/authentication-flow.spec.ts:95`) | Borde | No hace POST; muestra `Ingrese una contraseña.`. |
| Login | Respuesta sin token (`web/src/app/authentication-flow.spec.ts:105`) | Borde | Muestra `El backend respondió sin token.`; no guarda token ni navega. |
| Tareas | No existe token local (`web/src/app/authentication-flow.spec.ts:221`) | Borde | No hace GET y navega a `/login`. |
| Login | Servicio de autenticacion no disponible (`Network Error`; `web/src/app/authentication-flow.spec.ts:151`) | Error | Muestra titulo de autenticacion y detalle `Network Error`; no navega, no guarda token y limpia `busy`. La indisponibilidad se simula con rechazo Axios. |
| Login | Timeout de login (`web/src/app/authentication-flow.spec.ts:168`) | Error | Verifica configuracion de 5000 ms; muestra el detalle del rechazo de timeout, no navega y limpia `busy`. El timeout se simula, no se espera 5 segundos ni se usa red. |
| Tareas | Token invalido; el servicio devuelve `detail` (`web/src/app/authentication-flow.spec.ts:242`) | Error | Muestra el detalle y termina loading. La prueba registra el comportamiento actual: no elimina token ni redirige automaticamente; no lo establece como politica deseada del servidor. |
| Login/tareas | Error sin detalle legible (`web/src/app/authentication-flow.spec.ts:256`) | Error/borde | Usa `Error.message` cuando existe y el fallback cuando el valor no es un `Error` con mensaje utilizable. |

## Codigo de pruebas

Los siguientes casos son extractos ejecutables de `web/src/app/authentication-flow.spec.ts:59-261`; los doubles Axios, Router y storage se configuran en `web/src/app/authentication-flow.spec.ts:15-54`.

### Login feliz y bordes

```ts
it('loads saved preferences and preserves the successful login contract', async () => {
  storedValues.set('workshop_preferences', JSON.stringify({ compact: true }));
  vi.mocked(axios.post).mockResolvedValue({
    data: {
      token: 'test-token',
      user: { username: 'student', displayName: 'Workshop Student' }
    }
  } as never);
  const login = createLoginComponent();
  login.username = 'student';
  login.password = 'Workshop123!';

  await login.login();

  expect(login.preferences).toEqual({ theme: 'light', showTips: true, compact: true });
  expect(axios.post).toHaveBeenCalledWith(
    'http://localhost:8080/auth/login',
    { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
    { timeout: 5000 }
  );
  expect(storedValues.get('workshop_token')).toBe('test-token');
  expect(storedValues.get('workshop_user')).toBe(JSON.stringify({ username: 'student', displayName: 'Workshop Student' }));
  expect(storedValues.get('workshop_preferences')).toBe(JSON.stringify(login.preferences));
  expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  expect(login.busy).toBe(false);
});

it('rejects an empty username without sending a request', async () => {
  const login = createLoginComponent();
  await login.login();
  expect(login.message).toEqual({ title: 'Ingrese un usuario.' });
  expect(axios.post).not.toHaveBeenCalled();
});

it('rejects an empty password without sending a request', async () => {
  const login = createLoginComponent();
  login.username = 'student';
  await login.login();
  expect(login.message).toEqual({ title: 'Ingrese una contraseña.' });
  expect(axios.post).not.toHaveBeenCalled();
});

it('shows the missing-token response without saving a session', async () => {
  vi.mocked(axios.post).mockResolvedValue({ data: { user: { username: 'student' } } } as never);
  const login = createLoginComponent();
  login.username = 'student';
  login.password = 'password';
  await login.login();
  expect(login.message).toEqual({ title: 'El backend respondió sin token.' });
  expect(storedValues.has('workshop_token')).toBe(false);
  expect(router.navigate).not.toHaveBeenCalled();
});
```

### Tareas feliz y errores requeridos

```ts
it('loads tasks with the stored bearer token and preserves filtering and ordering', async () => {
  storedValues.set('workshop_token', 'test-token');
  storedValues.set('workshop_user', JSON.stringify({ username: 'student' }));
  vi.mocked(axios.get).mockResolvedValue({
    data: [
      { id: 1, owner: 'student', priority: 'HIGH', status: 'TODO', title: 'High task' },
      { id: 2, owner: 'student', priority: 'LOW', status: 'DONE', title: 'Low task' },
      { id: 3, owner: 'student', priority: 'URGENT', status: 'ARCHIVED', title: 'Archived task' }
    ]
  } as never);
  const dashboard = createDashboardComponent();
  await dashboard.ngOnInit();
  expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
    headers: { Authorization: 'Bearer test-token' }
  });
  expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['Low task', 'High task']);
  expect(dashboard.loading).toBe(false);
  expect(dashboard.error).toBe('');
});

it('shows an authentication service unavailable error', async () => {
  vi.mocked(axios.post).mockRejectedValue(new Error('Network Error'));
  const login = createLoginComponent();
  login.username = 'student';
  login.password = 'password';
  await login.login();
  expect(login.message).toEqual({
    title: 'No se pudo autenticar a student.',
    detail: 'Network Error'
  });
  expect(router.navigate).not.toHaveBeenCalled();
  expect(storedValues.has('workshop_token')).toBe(false);
  expect(login.busy).toBe(false);
});

it('shows a login timeout error', async () => {
  vi.mocked(axios.post).mockRejectedValue(new Error('timeout of 5000ms exceeded'));
  const login = createLoginComponent();
  login.username = 'student';
  login.password = 'password';
  await login.login();
  expect(axios.post).toHaveBeenCalledWith(
    'http://localhost:8080/auth/login',
    { username: 'student', password: 'password', client: 'angular-workshop' },
    { timeout: 5000 }
  );
  expect(login.message).toEqual({
    title: 'No se pudo autenticar a student.',
    detail: 'timeout of 5000ms exceeded'
  });
  expect(router.navigate).not.toHaveBeenCalled();
  expect(login.busy).toBe(false);
});

it('shows an invalid-token task error without clearing the session', async () => {
  storedValues.set('workshop_token', 'invalid-token');
  storedValues.set('workshop_user', JSON.stringify({ username: 'student' }));
  vi.mocked(axios.get).mockRejectedValue({ response: { data: { detail: 'Invalid token' } } });
  const dashboard = createDashboardComponent();
  await dashboard.ngOnInit();
  expect(dashboard.error).toBe('Invalid token');
  expect(dashboard.loading).toBe(false);
  expect(storedValues.get('workshop_token')).toBe('invalid-token');
  expect(router.navigate).not.toHaveBeenCalled();
});
```

## Ejecuciones

Comandos ejecutados desde `web/` en Windows PowerShell. Ambos finalizaron con codigo de salida 0.

| fecha | componente | IDs | comando | directorio | codigo de salida | resultado |
|---|---|---|---|---|---:|---|
| 2026-10-26 | web | H-WEB-01, H-WEB-02, H-WEB-03, H-WEB-05, H-WEB-06, H-WEB-08 | `npm test` | `web/` | 0 | 2 archivos de prueba; 19/19 tests pasan. Vitest 3.2.4, Node. |
| 2026-10-26 | web | H-WEB-01, H-WEB-02, H-WEB-03, H-WEB-05, H-WEB-06, H-WEB-08 | `npm run test:coverage` | `web/` | 0 | 2 archivos de prueba; 19/19 tests pasan; reporte v8 emitido en texto, JSON summary y HTML. |

## Cobertura

Metodo: Vitest con provider V8, configurado en `web/vitest.config.ts:5-9`. Los numeradores y denominadores se obtuvieron de `web/coverage/coverage-summary.json`, generado por `npm run test:coverage`; para el conjunto funcional se sumaron los contadores de login, dashboard, `AuthService`, `TasksService`, `api-error` y `legacy-format`.

| Alcance | Metrica | Cubiertas / total | Porcentaje |
|---|---|---:|---:|
| Modulos de produccion del flujo login/tareas | Lineas | 221 / 221 | 100% |
| Modulos de produccion del flujo login/tareas | Sentencias | 221 / 221 | 100% |
| Modulos de produccion del flujo login/tareas | Branches | 62 / 65 | 95.38% |
| Global web | Lineas | 226 / 259 | 87.25% |
| Global web | Sentencias | 226 / 259 | 87.25% |
| Global web | Branches | 65 / 71 | 91.54% |

En esta tarea solo se modifico el archivo de pruebas; no se altero codigo de produccion. La cobertura del conjunto funcional documenta que el codigo ejecutable bajo prueba supera el 85%, mientras la cobertura global se registra por separado. Los modelos TypeScript son declaraciones y no generan lineas ejecutables equivalentes a comportamiento runtime.

## Fallos, pendientes y propuestas

### Fallos

Ninguno en las dos ejecuciones registradas. No se ejecuto el audit de dependencias como parte de esta tarea.

### Pendientes

- Las fallas de red, timeout y token invalido se representan con mocks Axios. No se verifico que los servicios reales respondan con esos mensajes o status.
- El GET de tareas no define timeout propio; no se simulo una demora real del servicio. La prueba de timeout cubre el timeout configurado para login.
- El caso de token invalido confirma el comportamiento actual de conservar el token y no redirigir. La politica de sesion ante 401/403 sigue sin estar acordada con el backend.
- H-WEB-01, H-WEB-03 y H-WEB-08 permanecen como riesgos funcionales/seguridad documentados en `HALLAZGOS.md`; los tests no los presentan como resueltos.

### Pruebas propuestas

- Cuando haya un contrato de backend disponible, agregar pruebas de integracion locales para status HTTP, esquema de errores, expiracion/token invalido y rechazo de credenciales; mantener fixtures ficticios.
- Acordar primero la politica de sesion para 401/403 antes de exigir limpieza de token o redireccion, y definir dominio/empates de `priority` antes de fijar una expectativa de orden adicional.
