import { create } from 'zustand';
import { loginApi, meApi, updatePreferences } from '@/api/auth';
import { storeTokens, clearTokens } from '@/api/client';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  roles: string[];
  uiMode: 'operator' | 'engineering';
  bopScope: string[];
}

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
  setUiMode: (mode: 'operator' | 'engineering') => Promise<void>;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,
  isAuthenticated: false,

  login: async (email: string, password: string): Promise<void> => {
    set({ status: 'loading', error: null });
    try {
      const tokens = await loginApi(email, password);
      storeTokens(tokens.access_token, tokens.refresh_token);
      await get().loadMe();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ status: 'error', error: message, isAuthenticated: false });
      throw err;
    }
  },

  logout: (): void => {
    clearTokens();
    set({ user: null, status: 'idle', isAuthenticated: false, error: null });
  },

  loadMe: async (): Promise<void> => {
    set({ status: 'loading' });
    try {
      const me = await meApi();
      const user: AuthUser = {
        id: me.id,
        email: me.email,
        role: me.role,
        roles: me.roles,
        uiMode: (me.uiMode as 'operator' | 'engineering' | undefined) ?? 'operator',
        bopScope: me.bopScope,
      };
      set({ user, status: 'authenticated', isAuthenticated: true, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load user';
      set({ status: 'error', error: message, isAuthenticated: false, user: null });
    }
  },

  setUiMode: async (mode: 'operator' | 'engineering'): Promise<void> => {
    try {
      await updatePreferences({ uiMode: mode });
      set((state) => ({
        user: state.user !== null ? { ...state.user, uiMode: mode } : null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update UI mode';
      throw new Error(message);
    }
  },

  hasRole: (role: string): boolean => {
    const { user } = get();
    if (user === null) return false;
    return user.roles.includes(role) || user.role === role;
  },
}));
