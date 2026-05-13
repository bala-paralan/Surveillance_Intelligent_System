import { Icon, type IconName } from './Icon';
import type { PageKey } from '../types';

interface NavItem {
  id: PageKey;
  label: string;
  icon: IconName;
  badge?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Operations',
    items: [
      { id: 'dashboard', label: 'Dashboard',  icon: 'dash' },
      { id: 'live',      label: 'Live Feeds', icon: 'cam' },
      { id: 'map',       label: 'Sector Map', icon: 'map' },
      { id: 'alerts',    label: 'Alerts',     icon: 'bell', badge: 12 },
      { id: 'incidents', label: 'Incidents',  icon: 'inc',  badge: 3 },
    ],
  },
  {
    group: 'Investigate',
    items: [
      { id: 'search',   label: 'Search',   icon: 'srch' },
      { id: 'timeline', label: 'Timeline', icon: 'tl' },
      { id: 'reports',  label: 'Reports',  icon: 'rep' },
    ],
  },
  {
    group: 'Manage',
    items: [
      { id: 'devices',  label: 'Devices',  icon: 'dev' },
      { id: 'users',    label: 'Users',    icon: 'user' },
      { id: 'settings', label: 'Settings', icon: 'set' },
    ],
  },
];

interface SideNavProps {
  current: PageKey;
  onNav: (page: PageKey) => void;
}

export const SideNav = ({ current, onNav }: SideNavProps) => (
  <aside className="nav">
    <div className="brand">
      <div className="brand-mark">S</div>
      <div className="brand-name">
        SENTRY <span>/ BCS</span>
      </div>
    </div>
    <div className="sections">
      {NAV_GROUPS.map((g) => (
        <div key={g.group}>
          <div className="section-label">{g.group}</div>
          {g.items.map((it) => (
            <button
              key={it.id}
              className={`navitem ${current === it.id ? 'active' : ''}`}
              onClick={() => onNav(it.id)}
            >
              <Icon name={it.icon} />
              <span>{it.label}</span>
              {it.badge !== undefined && <span className="badge">{it.badge}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
    <div className="footer">
      <span className="status-dot" />
      <div>
        <div className="bold" style={{ color: 'var(--ink)' }}>
          All systems operational
        </div>
        <div className="tiny">142 cameras · 38 sensors · 4 sectors</div>
      </div>
    </div>
  </aside>
);
