export type PageKey =
  | 'dashboard'
  | 'live'
  | 'map'
  | 'alerts'
  | 'incidents'
  | 'incident'
  | 'search'
  | 'timeline'
  | 'reports'
  | 'devices'
  | 'users'
  | 'settings';

export type ThemeMode = 'light' | 'dark';
export type AccentName = 'indigo' | 'emerald' | 'amber' | 'slate';

export type Role =
  | 'manager'
  | 'sector_lead'
  | 'operator'
  | 'investigator'
  | 'field'
  | 'analyst';

export interface RoleProfile {
  name: string;
  initials: string;
  role: string;
  area: string;
}
