import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getAccessToken } from '@/api/client';

interface RequireAuthProps {
  children: ReactNode;
}

export const RequireAuth = ({ children }: RequireAuthProps) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const status = useAuthStore((s) => s.status);
  const loadMe = useAuthStore((s) => s.loadMe);
  const location = useLocation();

  useEffect(() => {
    if (status === 'idle' && getAccessToken() !== null) {
      void loadMe();
    }
  }, [status, loadMe]);

  if (status === 'loading' || (status === 'idle' && getAccessToken() !== null)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sentry" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
