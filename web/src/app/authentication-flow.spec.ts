import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { readFileSync } from 'node:fs';
import type { Router } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { AuthService } from './services/auth.service';
import { TasksService } from './services/tasks.service';
import { getApiErrorMessage } from './utils/api-error';
import { formatTaskLabel } from './utils/legacy-format';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('authentication flow characterization', () => {
  const storedValues = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => storedValues.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storedValues.set(key, value)),
    removeItem: vi.fn((key: string) => storedValues.delete(key))
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    storedValues.clear();
    storage.getItem.mockClear();
    storage.setItem.mockClear();
    storage.removeItem.mockClear();
    vi.stubGlobal('localStorage', storage);
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    router = { navigate: vi.fn().mockResolvedValue(true) };
  });

  function createLoginComponent(): LoginComponent {
    return new LoginComponent(router as unknown as Router, new AuthService());
  }

  function createDashboardComponent(): DashboardComponent {
    return new DashboardComponent(
      router as unknown as Router,
      { detectChanges: vi.fn() } as never,
      { run: (callback: () => void) => callback() } as never,
      new AuthService(),
      new TasksService()
    );
  }

  function stubDocumentCookie() {
    const readCookie = vi.fn(() => '');
    const writeCookie = vi.fn();
    const documentStub = {};
    Object.defineProperty(documentStub, 'cookie', { get: readCookie, set: writeCookie });
    vi.stubGlobal('document', documentStub);
    return { readCookie, writeCookie };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads saved preferences and preserves the successful login contract', async () => {
    storedValues.set('workshop_preferences', JSON.stringify({ compact: true }));
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        user: { username: 'student', displayName: 'Workshop Student' }
      }
    } as never);
    const login = createLoginComponent();
    login.username = 'student';
    login.password = 'Workshop123!';

    await login.login();

    expect(login.preferences).toEqual({ theme: 'light', showTips: true, compact: true });
    expect(axios.post).toHaveBeenCalledWith(
      '/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    expect(storedValues.has('workshop_token')).toBe(false);
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

  it('saves only the user after login because the session credential is an HttpOnly cookie', async () => {
    const sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    vi.stubGlobal('sessionStorage', sessionStorage);
    const cookie = stubDocumentCookie();
    vi.mocked(axios.post).mockResolvedValue({ data: { user: { username: 'student' } } } as never);
    const login = createLoginComponent();
    login.username = 'student';
    login.password = 'password';

    await login.login();

    expect(login.message).toBeNull();
    expect(storedValues.has('workshop_token')).toBe(false);
    expect(storedValues.get('workshop_user')).toBe(JSON.stringify({ username: 'student' }));
    expect([...storedValues.keys()].sort()).toEqual(['workshop_preferences', 'workshop_user']);
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    expect(cookie.readCookie).not.toHaveBeenCalled();
    expect(cookie.writeCookie).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('uses default preferences when saved preferences are invalid JSON', () => {
    storedValues.set('workshop_preferences', '{invalid');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const login = createLoginComponent();

    expect(login.preferences).toEqual({ theme: 'light', showTips: true, compact: false });
    expect(console.log).toHaveBeenCalledOnce();
  });

  it('ignores invalid stored user data instead of throwing', () => {
    storedValues.set('workshop_user', '{invalid');

    expect(new AuthService().getUser()).toBeNull();
  });

  it('shows the backend login error and does not navigate', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const login = createLoginComponent();
    login.username = 'student';
    login.password = 'invalid';

    await login.login();

    expect(login.message).toEqual({
      title: 'No se pudo autenticar a student.',
      detail: 'Invalid credentials'
    });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(login.busy).toBe(false);
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
      '/auth/login',
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

  it('renders dynamic login messages as text instead of HTML', () => {
    const template = readFileSync(new URL('./login/login.component.html', import.meta.url), 'utf8');

    expect(template).not.toContain('[innerHTML]');
    expect(template).toContain('{{ message.title }}');
    expect(template).toContain('{{ message.detail }}');
  });

  it('loads tasks with the session cookie and preserves filtering and ordering', async () => {
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

    expect(axios.get).toHaveBeenCalledWith('/api/tasks?owner=student', { withCredentials: true });
  expect(storedValues.has('workshop_token')).toBe(false);
    expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['Low task', 'High task']);
    expect(dashboard.visibleTasks.map((task) => task.label)).toEqual(['LOW · STUDENT', 'HIGH · STUDENT']);
    expect(dashboard.loading).toBe(false);
    expect(dashboard.error).toBe('');
    expect(dashboard.loading).toBe(false);
  });

  it('redirects to login without requesting tasks when no session exists', async () => {
    const dashboard = createDashboardComponent();

    await dashboard.ngOnInit();

    expect(axios.get).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows a normalized task error and clears loading state', async () => {
    storedValues.set('workshop_token', 'test-token');
    storedValues.set('workshop_user', JSON.stringify({ username: 'student' }));
    vi.mocked(axios.get).mockRejectedValue({ response: { data: { detail: 'Tasks unavailable' } } });
    const dashboard = createDashboardComponent();

    await dashboard.ngOnInit();

    expect(dashboard.error).toBe('Tasks unavailable');
    expect(dashboard.loading).toBe(false);
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

  it('uses the fallback message when an API error has no readable detail', () => {
    expect(getApiErrorMessage(new Error('Network unavailable'), 'detail', 'Safe fallback'))
      .toBe('Network unavailable');
    expect(getApiErrorMessage(null, 'detail', 'Safe fallback')).toBe('Safe fallback');
  });

  it('clears token and user on logout while retaining preferences', async () => {
    const cookie = stubDocumentCookie();
    storedValues.set('workshop_token', 'test-token');
    storedValues.set('workshop_user', JSON.stringify({ username: 'student' }));
    storedValues.set('workshop_preferences', JSON.stringify({ compact: true }));
    const dashboard = createDashboardComponent();

    await dashboard.logout();

    expect(storedValues.has('workshop_token')).toBe(false);
    expect(storedValues.has('workshop_user')).toBe(false);
    expect(storedValues.get('workshop_preferences')).toBe(JSON.stringify({ compact: true }));
    expect(cookie.readCookie).not.toHaveBeenCalled();
    expect(cookie.writeCookie).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not log or persist the session cookie value during login, task loading, or logout', async () => {
    const cookieValue = 'test-only-value';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(axios.post).mockResolvedValue({
      data: { user: { username: 'student' } },
      headers: { 'set-cookie': `workshop_session=${cookieValue}; HttpOnly; Path=/` }
    } as never);
    const login = createLoginComponent();
    login.username = 'student';
    login.password = 'password';

    await login.login();

    vi.mocked(axios.get).mockResolvedValue({ data: [] } as never);
    const dashboard = createDashboardComponent();
    await dashboard.ngOnInit();
    await dashboard.logout();

    const loggedOutput = JSON.stringify([...log.mock.calls, ...error.mock.calls], (_key, value) =>
      value instanceof Error ? value.message : value
    );
    expect(loggedOutput).not.toContain(cookieValue);
    expect([...storedValues.values()].some((value) => value.includes(cookieValue))).toBe(false);
  });

  it('formats missing task data with the observed defaults', () => {
    expect(formatTaskLabel(null)).toBe('SIN-DATOS');
    expect(formatTaskLabel({})).toBe('NORMAL · SIN-ASIGNAR');
  });

  it('maps known and unknown task statuses consistently', () => {
    const dashboard = createDashboardComponent();

    expect(dashboard.statusLabel('done')).toBe('Completado');
    expect(dashboard.statusLabel('custom')).toBe('custom');
    expect(dashboard.statusLabel()).toBe('');
  });
});
