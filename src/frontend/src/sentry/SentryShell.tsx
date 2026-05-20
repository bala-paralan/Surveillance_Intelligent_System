import { useMemo, useState } from 'react';
import { SideNav } from './components/SideNav';
import { TopBar } from './components/TopBar';
import { LoginPage, type AuthenticatedUser } from './pages/LoginPage';
import { clearTokens } from '@/api/client';
import { DashboardPage } from './pages/DashboardPage';
import { LivePage } from './pages/LivePage';
import { MapPage } from './pages/MapPage';
import { AlertsPage } from './pages/AlertsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentPage } from './pages/IncidentPage';
import { SearchPage } from './pages/SearchPage';
import { TimelinePage } from './pages/TimelinePage';
import { ReportsPage } from './pages/ReportsPage';
import { DevicesPage } from './pages/DevicesPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import type { AccentName, DashboardVariant, PageKey, ThemeMode } from './types';
import './sentry.css';

interface AccentTokens {
  a: string;
  soft: string;
  ink: string;
  ring: string;
  dA: string;
  dSoft: string;
  dInk: string;
  dRing: string;
}

const ACCENTS: Record<AccentName, AccentTokens> = {
  indigo:  { a: '#4f46e5', soft: '#eef2ff', ink: '#3730a3', ring: 'rgba(79,70,229,0.18)',  dA: '#818cf8', dSoft: '#1e1f3b', dInk: '#c7d2fe', dRing: 'rgba(129,140,248,0.25)' },
  emerald: { a: '#059669', soft: '#ecfdf5', ink: '#065f46', ring: 'rgba(5,150,105,0.18)',  dA: '#34d399', dSoft: '#0d2520', dInk: '#a7f3d0', dRing: 'rgba(52,211,153,0.25)' },
  amber:   { a: '#d97706', soft: '#fffbeb', ink: '#92400e', ring: 'rgba(217,119,6,0.18)',  dA: '#fbbf24', dSoft: '#2a1f0a', dInk: '#fde68a', dRing: 'rgba(251,191,36,0.25)' },
  slate:   { a: '#334155', soft: '#f1f5f9', ink: '#0f172a', ring: 'rgba(51,65,85,0.18)',   dA: '#cbd5e1', dSoft: '#1e293b', dInk: '#f1f5f9', dRing: 'rgba(203,213,225,0.25)' },
};

const CRUMBS: Record<PageKey, string[]> = {
  dashboard: ['Operations', 'Dashboard'],
  live:      ['Operations', 'Live Feeds'],
  map:       ['Operations', 'Sector Map'],
  alerts:    ['Operations', 'Alerts'],
  incidents: ['Operations', 'Incidents'],
  incident:  ['Operations', 'Incidents', 'INC-2026-0418'],
  search:    ['Investigate', 'Search'],
  timeline:  ['Investigate', 'Timeline'],
  reports:   ['Investigate', 'Reports'],
  devices:   ['Manage', 'Devices'],
  users:     ['Manage', 'Users'],
  settings:  ['Manage', 'Settings'],
};

interface TweaksState {
  theme: ThemeMode;
  accent: AccentName;
  dashboardVariant: DashboardVariant;
}

const DEFAULTS: TweaksState = {
  theme: 'light',
  accent: 'indigo',
  dashboardVariant: 'ops',
};

export const SentryShell = () => {
  const [tweaks, setTweaks] = useState<TweaksState>(DEFAULTS);
  const [page, setPage] = useState<PageKey | 'login'>('login');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const handleLogin = (next: AuthenticatedUser): void => {
    setUser(next);
    setPage('dashboard');
  };

  const handleLogout = (): void => {
    clearTokens();
    setUser(null);
    setPage('login');
  };

  const accentVars = useMemo(() => {
    const a = ACCENTS[tweaks.accent];
    const isDark = tweaks.theme === 'dark';
    return {
      '--accent': isDark ? a.dA : a.a,
      '--accent-soft': isDark ? a.dSoft : a.soft,
      '--accent-ink': isDark ? a.dInk : a.ink,
      '--accent-ring': isDark ? a.dRing : a.ring,
    } as React.CSSProperties;
  }, [tweaks.accent, tweaks.theme]);

  if (page === 'login') {
    return (
      <div className="sentry-app" data-theme={tweaks.theme} style={accentVars}>
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  const navKey: PageKey = page === 'incident' ? 'incidents' : page;
  const toggleTheme = () =>
    setTweaks((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage variant={tweaks.dashboardVariant} onNav={setPage} />;
      case 'live':      return <LivePage />;
      case 'map':       return <MapPage />;
      case 'alerts':    return <AlertsPage onNav={setPage} />;
      case 'incidents': return <IncidentsPage onNav={setPage} />;
      case 'incident':  return <IncidentPage />;
      case 'search':    return <SearchPage />;
      case 'timeline':  return <TimelinePage />;
      case 'reports':   return <ReportsPage />;
      case 'devices':   return <DevicesPage />;
      case 'users':     return <UsersPage />;
      case 'settings':  return <SettingsPage />;
    }
  };

  return (
    <div className="sentry-app" data-theme={tweaks.theme} style={accentVars}>
      <div className="app">
        <SideNav current={navKey} onNav={setPage} />
        <TopBar
          crumbs={CRUMBS[page]}
          theme={tweaks.theme}
          onTheme={toggleTheme}
          onLogout={handleLogout}
          user={user}
        />
        <main className="main">{renderPage()}</main>
      </div>
    </div>
  );
};
