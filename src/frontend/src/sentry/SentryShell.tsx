import { useMemo, useState } from 'react';
import { SideNav } from './components/SideNav';
import { TopBar } from './components/TopBar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LivePage } from './pages/LivePage';
import { MapPage } from './pages/MapPage';
import { AlertsPage } from './pages/AlertsPage';
import { IncidentPage } from './pages/IncidentPage';
import { SearchPage } from './pages/SearchPage';
import { TimelinePage } from './pages/TimelinePage';
import { ReportsPage } from './pages/ReportsPage';
import { DevicesPage } from './pages/DevicesPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ROLE_NAV, ROLE_PROFILES } from './roles';
import type { AccentName, PageKey, Role, ThemeMode } from './types';
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

const buildCrumbs = (page: PageKey, profile: { role: string }): string[] => {
  switch (page) {
    case 'dashboard': return ['Home', `${profile.role} dashboard`];
    case 'live':      return ['Operations', 'Live Feeds'];
    case 'map':       return ['Operations', 'Sector Map'];
    case 'alerts':    return ['Operations', 'Alerts'];
    case 'incidents': return ['Operations', 'Incidents'];
    case 'incident':  return ['Operations', 'Incidents', 'INC-2026-0418'];
    case 'search':    return ['Investigate', 'Search'];
    case 'timeline':  return ['Investigate', 'Timeline'];
    case 'reports':   return ['Investigate', 'Reports'];
    case 'devices':   return ['Manage', 'Devices'];
    case 'users':     return ['Manage', 'Users'];
    case 'settings':  return ['Manage', 'Settings'];
  }
};

interface TweaksState {
  theme: ThemeMode;
  accent: AccentName;
  role: Role;
}

const DEFAULTS: TweaksState = {
  theme: 'light',
  accent: 'indigo',
  role: 'manager',
};

export const SentryShell = () => {
  const [tweaks, setTweaks] = useState<TweaksState>(DEFAULTS);
  const [page, setPage] = useState<PageKey | 'login'>('login');

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
        <LoginPage
          onLogin={(role) => {
            setTweaks((prev) => ({ ...prev, role }));
            setPage('dashboard');
          }}
        />
      </div>
    );
  }

  const profile = ROLE_PROFILES[tweaks.role];
  const visible = ROLE_NAV[tweaks.role];
  const navKey: PageKey = page === 'incident' ? 'incidents' : page;
  const toggleTheme = () =>
    setTweaks((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage role={tweaks.role} onNav={setPage} />;
      case 'live':      return <LivePage />;
      case 'map':       return <MapPage />;
      case 'alerts':    return <AlertsPage onNav={setPage} />;
      case 'incidents': return <AlertsPage onNav={setPage} />;
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
        <SideNav current={navKey} onNav={setPage} visible={visible} profile={profile} />
        <TopBar
          crumbs={buildCrumbs(page, profile)}
          theme={tweaks.theme}
          onTheme={toggleTheme}
          profile={profile}
        />
        <main className="main">{renderPage()}</main>
      </div>
    </div>
  );
};
