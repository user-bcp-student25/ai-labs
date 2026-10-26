export interface LoginRequest {
  username: string;
  password: string;
  client: string;
}

export interface AuthenticatedUser {
  username: string;
  displayName?: string;
  role?: string;
}

export interface LoginResponse {
  token?: string;
  user: AuthenticatedUser;
}

export interface UserPreferences {
  theme: string;
  showTips: boolean;
  compact: boolean;
}

export interface LoginMessage {
  title: string;
  detail?: string;
}