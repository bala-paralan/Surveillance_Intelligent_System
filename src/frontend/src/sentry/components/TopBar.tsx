import { Fragment, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { ThemeMode } from '../types';

interface TopBarProps {
  crumbs: string[];
  theme: ThemeMode;
  onTheme: () => void;
  onLogout: () => void;
}

export const TopBar = ({ crumbs, theme, onTheme, onLogout }: TopBarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    onLogout();
  };

  return (
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
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="userchip"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{ border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
        >
          <div className="avatar">MR</div>
          <div style={{ textAlign: 'left' }}>
            <div className="name">M. Rivera</div>
            <div className="role">Sector Lead · NW</div>
          </div>
          <Icon name="chev" size={12} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              minWidth: 200,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              padding: 6,
              zIndex: 50,
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                color: 'var(--ink)',
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon name="lock" size={14} />
              <span>Sign out · switch operator</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
