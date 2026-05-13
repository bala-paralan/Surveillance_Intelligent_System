import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UiModeToggle } from '@/components/auth/UiModeToggle';

const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-700 text-red-100',
  ENGINEER: 'bg-amber-700 text-amber-100',
  OPERATOR: 'bg-blue-700 text-blue-100',
  VIEWER: 'bg-gray-600 text-gray-200',
};

const roleBadgeClass = (role: string): string =>
  ROLE_BADGE_COLORS[role.toUpperCase()] ?? 'bg-gray-600 text-gray-200';

export const NavBar = () => {
  const user = useAuthStore((s) => s.user);
  const hasRole = useAuthStore((s) => s.hasRole);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const showEngineering =
    (hasRole('ENGINEER') || hasRole('ADMIN')) && user?.uiMode === 'engineering';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gray-700 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  const handleLogout = (): void => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-700 sticky top-0 z-40">
      <div className="max-w-full mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <span className="text-white font-bold text-lg tracking-tight select-none">
              SurveillanceOS
            </span>

            {user !== null && (
              <div className="flex items-center gap-1">
                <NavLink to="/" end className={navLinkClass}>
                  Map
                </NavLink>
                <NavLink to="/aoi" className={navLinkClass}>
                  AOI
                </NavLink>
                <NavLink to="/cameras" className={navLinkClass}>
                  Cameras
                </NavLink>
                <NavLink to="/sentry" className={navLinkClass}>
                  SENTRY
                </NavLink>
                {showEngineering && (
                  <NavLink to="/engineering" className={navLinkClass}>
                    Engineering
                  </NavLink>
                )}
              </div>
            )}
          </div>

          {/* Right side */}
          {user !== null && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <span>{user.email}</span>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold uppercase ${roleBadgeClass(user.role)}`}
                >
                  {user.role}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-700">
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>

                  {(hasRole('ENGINEER') || hasRole('ADMIN')) && (
                    <div className="px-3 py-2 border-b border-gray-700">
                      <UiModeToggle />
                    </div>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
