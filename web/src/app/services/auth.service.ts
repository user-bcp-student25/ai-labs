import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import type { AuthenticatedUser, LoginRequest, LoginResponse, UserPreferences } from '../models/auth.models';
import { getApiErrorMessage } from '../utils/api-error';

const TOKEN_STORAGE_KEY = 'workshop_token';
const USER_STORAGE_KEY = 'workshop_user';
const PREFERENCES_STORAGE_KEY = 'workshop_preferences';
const LOGIN_TIMEOUT_MS = 5000;
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  showTips: true,
  compact: false
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await axios.post<LoginResponse>(environment.authLoginUrl, request, {
      timeout: LOGIN_TIMEOUT_MS
    });
    return response.data;
  }

  saveSession(token: string, user: AuthenticatedUser): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  getUser(): AuthenticatedUser | null {
    const serializedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!serializedUser) {
      return null;
    }

    try {
      return JSON.parse(serializedUser) as AuthenticatedUser;
    } catch {
      return null;
    }
  }

  getPreferences(): UserPreferences {
    try {
      const serializedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (!serializedPreferences) {
        return { ...DEFAULT_PREFERENCES };
      }

      const savedPreferences = JSON.parse(serializedPreferences) as Partial<UserPreferences>;
      return { ...DEFAULT_PREFERENCES, ...savedPreferences };
    } catch (error) {
      console.log('Preferences could not be loaded', error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  savePreferences(preferences: UserPreferences): void {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  getLoginErrorMessage(error: unknown): string {
    return getApiErrorMessage(error, 'message', 'Error desconocido');
  }
}