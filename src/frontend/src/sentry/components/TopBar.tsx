import { Fragment } from 'react';
import { Icon } from './Icon';
import type { ThemeMode } from '../types';

interface TopBarProps {
  crumbs: string[];
  theme: ThemeMode;
  onTheme: () => void;
}

export const TopBar = ({ crumbs, theme, onTheme }: TopBarProps) => (
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
      <div className="avatar">MR</div>
      <div>
        <div className="name">M. Rivera</div>
        <div className="role">Sector Lead · NW</div>
      </div>
    </div>
  </header>
);
