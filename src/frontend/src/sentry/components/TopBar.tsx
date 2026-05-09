import { Fragment } from 'react';
import { Icon } from './Icon';
import type { RoleProfile, ThemeMode } from '../types';

interface TopBarProps {
  crumbs: string[];
  theme: ThemeMode;
  onTheme: () => void;
  profile?: RoleProfile;
}

export const TopBar = ({ crumbs, theme, onTheme, profile }: TopBarProps) => (
  <header className="topbar">
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <Fragment key={`${i}-${c}`}>
          {i > 0 && <span className="sep">/</span>}
          {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
        </Fragment>
      ))}
    </div>
    <div className="grow" />
    <div className="search">
      <Icon name="srch" size={14} />
      <input placeholder="Search incidents, plates, faces, sectors…" />
      <kbd>⌘K</kbd>
    </div>
    <button className="iconbtn" title="Toggle theme" onClick={onTheme}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
    <button className="iconbtn" title="Notifications">
      <Icon name="bell" />
      <span className="dot" />
    </button>
    <div className="userchip">
      <div className="avatar">{profile ? profile.initials : 'MR'}</div>
      <div>
        <div className="name">{profile ? profile.name : 'M. Rivera'}</div>
        <div className="role">
          {profile ? `${profile.role} · ${profile.area}` : 'Sector Lead · NW'}
        </div>
      </div>
    </div>
  </header>
);
