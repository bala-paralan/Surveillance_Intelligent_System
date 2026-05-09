export type SectorStatus = 'Normal' | 'Heightened' | 'Active Incident';

export interface Sector {
  id: string;
  name: string;
  kind: string;
  km: number;
  status: SectorStatus;
  lat: number;
}

export type AlertStatus =
  | 'Open'
  | 'Acknowledged'
  | 'Investigating'
  | 'Escalated'
  | 'Dismissed'
  | 'Resolved';

export interface AlertRow {
  id: string;
  sev: 1 | 2 | 3 | 4 | 5;
  type: string;
  sector: string;
  cam: string;
  when: string;
  whenISO: string;
  status: AlertStatus;
  conf: number;
  persons: number;
}

export type CameraMode = 'day' | 'night';
export type CameraStatus = 'live' | 'rec' | 'off';

export interface Camera {
  id: string;
  sector: string;
  name: string;
  mode: CameraMode;
  status: CameraStatus;
  alert: boolean;
  warn?: boolean;
  label?: string;
}

export interface Incident {
  id: string;
  title: string;
  sev: 1 | 2 | 3 | 4 | 5;
  sector: string;
  opened: string;
  status: string;
  responder: string;
  alerts: number;
}

export interface UserRow {
  name: string;
  initials: string;
  role: string;
  area: string;
  status: 'Online' | 'Away' | 'Offline' | 'On Patrol';
  last: string;
}

export const SECTORS: Sector[] = [
  { id: 'NW-04', name: 'Pinegate Pass',  kind: 'Mountain', km: 28, status: 'Heightened',      lat: 41 },
  { id: 'N-12',  name: 'Riverbend',      kind: 'River',    km: 41, status: 'Normal',          lat: 42 },
  { id: 'NE-07', name: 'Saltflats',      kind: 'Desert',   km: 63, status: 'Normal',          lat: 39 },
  { id: 'E-22',  name: 'Cedar Crossing', kind: 'Forest',   km: 19, status: 'Active Incident', lat: 40 },
];

export const ALERTS: AlertRow[] = [
  { id: 'ALT-21408', sev: 5, type: 'Group crossing',     sector: 'E-22',  cam: 'CAM-22-09', when: '2 min ago',  whenISO: '14:38:12', status: 'Open',          conf: 0.94, persons: 6 },
  { id: 'ALT-21407', sev: 4, type: 'Person detected',    sector: 'NW-04', cam: 'CAM-04-12', when: '5 min ago',  whenISO: '14:35:01', status: 'Acknowledged',  conf: 0.92, persons: 1 },
  { id: 'ALT-21406', sev: 3, type: 'Vehicle near fence', sector: 'NW-04', cam: 'CAM-04-08', when: '11 min ago', whenISO: '14:29:44', status: 'Open',          conf: 0.81, persons: 0 },
  { id: 'ALT-21405', sev: 2, type: 'Motion - wildlife',  sector: 'N-12',  cam: 'CAM-12-03', when: '14 min ago', whenISO: '14:26:18', status: 'Dismissed',     conf: 0.76, persons: 0 },
  { id: 'ALT-21404', sev: 4, type: 'Drone signal',       sector: 'NE-07', cam: 'RF-07-A',   when: '22 min ago', whenISO: '14:18:09', status: 'Investigating', conf: 0.88, persons: 0 },
  { id: 'ALT-21403', sev: 3, type: 'Fence vibration',    sector: 'E-22',  cam: 'SNS-22-14', when: '34 min ago', whenISO: '14:06:21', status: 'Resolved',      conf: 0.71, persons: 0 },
  { id: 'ALT-21402', sev: 5, type: 'Tunnel acoustic',    sector: 'NW-04', cam: 'SNS-04-02', when: '47 min ago', whenISO: '13:53:50', status: 'Escalated',     conf: 0.95, persons: 0 },
  { id: 'ALT-21401', sev: 2, type: 'Boat detection',     sector: 'N-12',  cam: 'CAM-12-19', when: '1 h ago',    whenISO: '13:38:02', status: 'Resolved',      conf: 0.69, persons: 2 },
];

export const CAMERAS: Camera[] = [
  { id: 'CAM-04-01', sector: 'NW-04', name: 'Pinegate North Tower', mode: 'day',   status: 'live', alert: false, warn: false },
  { id: 'CAM-04-08', sector: 'NW-04', name: 'Service Road',         mode: 'day',   status: 'live', alert: false, warn: true,  label: 'VEHICLE' },
  { id: 'CAM-04-12', sector: 'NW-04', name: 'Ridge Trail',          mode: 'day',   status: 'live', alert: true,  label: 'PERSON · 0.92' },
  { id: 'CAM-04-15', sector: 'NW-04', name: 'Tunnel East',          mode: 'night', status: 'live', alert: false, warn: false },
  { id: 'CAM-12-03', sector: 'N-12',  name: 'Riverbend South',      mode: 'day',   status: 'live', alert: false, warn: false },
  { id: 'CAM-12-19', sector: 'N-12',  name: 'Dock 12',              mode: 'day',   status: 'live', alert: false, warn: false },
  { id: 'CAM-22-09', sector: 'E-22',  name: 'Cedar Crossing Gate',  mode: 'day',   status: 'live', alert: true,  label: '6 PERSONS' },
  { id: 'CAM-22-14', sector: 'E-22',  name: 'Forest Path',          mode: 'night', status: 'live', alert: false, warn: false },
  { id: 'CAM-07-A',  sector: 'NE-07', name: 'Saltflats West',       mode: 'day',   status: 'rec',  alert: false, warn: false },
  { id: 'CAM-07-B',  sector: 'NE-07', name: 'Saltflats East',       mode: 'day',   status: 'live', alert: false, warn: false },
  { id: 'CAM-07-C',  sector: 'NE-07', name: 'Old Quarry',           mode: 'day',   status: 'off',  alert: false, warn: false },
  { id: 'CAM-04-22', sector: 'NW-04', name: 'Watchtower 4B',        mode: 'day',   status: 'live', alert: false, warn: false },
];

export const INCIDENTS: Incident[] = [
  { id: 'INC-2026-0418', title: 'Group crossing — Cedar Crossing', sev: 5, sector: 'E-22',  opened: '14:38', status: 'In Progress',   responder: 'Patrol Bravo-2', alerts: 3 },
  { id: 'INC-2026-0417', title: 'Drone overflight — Saltflats',    sev: 4, sector: 'NE-07', opened: '14:18', status: 'Investigating', responder: 'Air Unit-1',     alerts: 2 },
  { id: 'INC-2026-0416', title: 'Tunnel acoustic — Pinegate',      sev: 5, sector: 'NW-04', opened: '13:53', status: 'Escalated',     responder: 'Eng. Crew-3',    alerts: 1 },
];

export const USERS: UserRow[] = [
  { name: 'Maria Rivera',   initials: 'MR', role: 'Sector Lead',   area: 'NW-04',        status: 'Online',    last: 'now' },
  { name: 'Daniel Cho',     initials: 'DC', role: 'Operator',      area: 'Control Room', status: 'Online',    last: '2m'  },
  { name: 'Aisha Patel',    initials: 'AP', role: 'Investigator',  area: 'HQ',           status: 'Away',      last: '24m' },
  { name: 'Tomás Vega',     initials: 'TV', role: 'Field Officer', area: 'E-22',         status: 'On Patrol', last: '1m'  },
  { name: 'Lena Kowalski',  initials: 'LK', role: 'Manager',       area: 'Region North', status: 'Online',    last: 'now' },
  { name: 'Jordan Reyes',   initials: 'JR', role: 'Analyst',       area: 'HQ',           status: 'Offline',   last: '3h'  },
];

export const SPARK_HOUR = [4, 6, 5, 8, 12, 9, 7, 14, 18, 11, 9, 13, 16, 14, 22, 28, 19, 15, 12, 14, 18, 21, 17, 24];
export const SPARK_DAY  = [12, 18, 14, 22, 28, 31, 26, 35, 42, 38, 44, 51, 47, 39, 33, 28, 36, 41, 38, 44];
