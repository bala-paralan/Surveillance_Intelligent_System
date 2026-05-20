// Defaults to the relative path `/api` which works in both:
//   • Vite dev server  (proxies /api → backend:3001 with rewrite stripping /api)
//   • Production nginx (proxies /api/ → backend:3001/ with trailing-slash strip)
// Override with VITE_API_URL=http://localhost:3001 (etc.) when calling a
// backend on a different origin without a proxy in front.
const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api';

const ACCESS_TOKEN_KEY = 'sos_access_token';
const REFRESH_TOKEN_KEY = 'sos_refresh_token';

export const storeTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (isRefreshing && refreshPromise !== null) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    return null;
  }

  isRefreshing = true;
  refreshPromise = (async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const data = (await res.json()) as { access_token: string; refresh_token: string };
      storeTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch {
      clearTokens();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const accessToken = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (accessToken !== null) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken === null) {
      throw new Error('Unauthorized: session expired');
    }

    headers['Authorization'] = `Bearer ${newToken}`;
    const retryResponse = await fetch(`${BASE_URL}${path}`, { ...init, headers });

    if (!retryResponse.ok) {
      const errorText = await retryResponse.text();
      throw new Error(`API error ${retryResponse.status}: ${errorText}`);
    }

    return retryResponse.json() as Promise<T>;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
};
