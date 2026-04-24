import { apiFetch } from '@/api/client';

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

export interface MeResponse {
  id: string;
  email: string;
  role: string;
  roles: string[];
  uiMode?: string;
  bopScope: string[];
}

export const loginApi = (email: string, password: string): Promise<LoginResponse> =>
  apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const meApi = (): Promise<MeResponse> => apiFetch<MeResponse>('/auth/me');

export const updatePreferences = (prefs: { uiMode: 'operator' | 'engineering' }): Promise<void> =>
  apiFetch<void>('/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
