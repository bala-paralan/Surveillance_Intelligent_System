import { useAuthStore } from '@/store/authStore';

export const useAuth = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasRole = useAuthStore((s) => s.hasRole);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const uiMode = user?.uiMode ?? 'operator';

  return { user, isAuthenticated, hasRole, uiMode, login, logout };
};
