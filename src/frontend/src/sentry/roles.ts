import type { IconName } from './components/Icon';
import type { PageKey, Role, RoleProfile } from './types';

export const ROLE_PROFILES: Record<Role, RoleProfile> = {
  manager:      { name: 'Lena Kowalski', initials: 'LK', role: 'Manager',       area: 'Region North' },
  sector_lead:  { name: 'Maria Rivera',  initials: 'MR', role: 'Sector Lead',   area: 'Sector NW-04' },
  operator:     { name: 'Daniel Cho',    initials: 'DC', role: 'Operator',      area: 'Control Room' },
  investigator: { name: 'Aisha Patel',   initials: 'AP', role: 'Investigator',  area: 'HQ' },
  field:        { name: 'Tomás Vega',    initials: 'TV', role: 'Field Officer', area: 'Sector E-22' },
  analyst:      { name: 'Jordan Reyes',  initials: 'JR', role: 'Analyst',       area: 'HQ' },
};

export const ROLE_NAV: Record<Role, PageKey[]> = {
  manager:      ['dashboard', 'map', 'alerts', 'incidents', 'reports', 'users', 'settings'],
  sector_lead:  ['dashboard', 'live', 'map', 'alerts', 'incidents', 'search', 'reports', 'devices', 'users', 'settings'],
  operator:     ['dashboard', 'live', 'map', 'alerts', 'incidents', 'devices'],
  investigator: ['dashboard', 'search', 'timeline', 'alerts', 'incidents', 'reports'],
  field:        ['dashboard', 'map', 'alerts', 'incidents'],
  analyst:      ['dashboard', 'reports', 'search', 'timeline', 'alerts'],
};

export interface RoleOption {
  id: Role;
  name: string;
  who: string;
  area: string;
  icon: IconName;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'manager',      name: 'Manager',       who: 'Lena Kowalski', area: 'Region North',  icon: 'rep' },
  { id: 'sector_lead',  name: 'Sector Lead',   who: 'Maria Rivera',  area: 'Sector NW-04',  icon: 'pin' },
  { id: 'operator',     name: 'Operator',      who: 'Daniel Cho',    area: 'Control Room',  icon: 'cam' },
  { id: 'investigator', name: 'Investigator',  who: 'Aisha Patel',   area: 'HQ',            icon: 'srch' },
  { id: 'field',        name: 'Field Officer', who: 'Tomás Vega',    area: 'Sector E-22',   icon: 'flag' },
  { id: 'analyst',      name: 'Analyst',       who: 'Jordan Reyes',  area: 'HQ',            icon: 'rep' },
];
