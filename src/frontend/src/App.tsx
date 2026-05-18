import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { RequireAuth } from '@/components/auth/RequireAuth';

const LoginPage = lazy(() =>
  import('@/components/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const OperatorDashboard = lazy(() =>
  import('@/pages/OperatorDashboard').then((m) => ({ default: m.OperatorDashboard })),
);
const AoiPage = lazy(() =>
  import('@/pages/AoiPage').then((m) => ({ default: m.AoiPage })),
);
const EngineeringPage = lazy(() =>
  import('@/pages/EngineeringPage').then((m) => ({ default: m.EngineeringPage })),
);
const SentryShell = lazy(() =>
  import('@/sentry/SentryShell').then((m) => ({ default: m.SentryShell })),
);

const RouteFallback = () => (
  <div className="min-h-[calc(100vh-56px)] bg-gray-900 flex items-center justify-center">
    <div className="text-gray-400 text-sm">Loading…</div>
  </div>
);

const NotFound = () => (
  <div className="min-h-[calc(100vh-56px)] bg-gray-900 flex items-center justify-center px-4">
    <div className="text-center">
      <p className="text-6xl font-bold text-gray-700 mb-4">404</p>
      <h1 className="text-2xl font-semibold text-white mb-2">Page Not Found</h1>
      <p className="text-gray-400">The page you are looking for does not exist.</p>
    </div>
  </div>
);

const CamerasPlaceholder = () => (
  <div className="min-h-[calc(100vh-56px)] bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-white mb-2">Camera Grid</h1>
      <p className="text-gray-400">Coming in Phase 0C.</p>
    </div>
  </div>
);

export const App = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isSentryRoute = location.pathname.startsWith('/sentry');

  if (isSentryRoute) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/sentry/*" element={<SentryShell />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {!isLoginPage && <NavBar />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={<Navigate to="/sentry" replace />} />

          <Route
            path="/operator"
            element={
              <RequireAuth>
                <OperatorDashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/aoi"
            element={
              <RequireAuth>
                <AoiPage />
              </RequireAuth>
            }
          />

          <Route
            path="/cameras"
            element={
              <RequireAuth>
                <CamerasPlaceholder />
              </RequireAuth>
            }
          />

          <Route path="/engineering" element={<EngineeringPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
};
