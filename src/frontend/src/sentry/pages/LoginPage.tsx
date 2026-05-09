import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ROLE_OPTIONS } from '../roles';
import type { Role } from '../types';

interface LoginPageProps {
  onLogin: (role: Role) => void;
}

const operatorIdFor = (who: string): string =>
  who.toLowerCase().split(' ')[0] + '.' + who.toLowerCase().split(' ')[1];

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [role, setRole] = useState<Role>('manager');
  const selected = ROLE_OPTIONS.find((r) => r.id === role) ?? ROLE_OPTIONS[0];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          padding: '40px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'auto',
        }}
      >
        <div className="row gap-12">
          <div className="brand-mark" style={{ width: 32, height: 32 }}>S</div>
          <div className="brand-name" style={{ fontSize: 16 }}>
            SENTRY <span>/ Border Control System</span>
          </div>
        </div>

        <div style={{ maxWidth: 460, width: '100%', padding: '24px 0' }}>
          <div className="pill accent" style={{ marginBottom: 16 }}>
            <span className="ldot" /> Restricted Access · TLS 1.3
          </div>
          <h1 style={{ fontSize: 32, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Welcome back.
          </h1>
          <p className="muted" style={{ margin: '0 0 28px' }}>
            Sign in with your operator credentials. Your dashboard will adapt to your role.
          </p>

          <div className="col gap-16">
            <div className="field">
              <label>Operator ID</label>
              <input className="input" defaultValue={operatorIdFor(selected.who)} key={role} />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" defaultValue="••••••••••••" />
            </div>
            <div className="field">
              <label>Sign in as</label>
              <div className="grid g-2" style={{ gap: 8 }}>
                {ROLE_OPTIONS.map((r) => {
                  const isActive = role === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className="card"
                      style={{
                        padding: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderColor: isActive ? 'var(--accent)' : 'var(--line)',
                        background: isActive ? 'var(--accent-soft)' : 'var(--bg-elev)',
                        boxShadow: isActive ? '0 0 0 3px var(--accent-ring)' : 'none',
                        transition: 'all .12s',
                      }}
                    >
                      <div className="row gap-8" style={{ marginBottom: 4 }}>
                        <Icon name={r.icon} size={14} />
                        <span
                          className="bold small"
                          style={{ color: isActive ? 'var(--accent-ink)' : 'var(--ink)' }}
                        >
                          {r.name}
                        </span>
                      </div>
                      <div className="tiny muted">{r.who} · {r.area}</div>
                    </button>
                  );
                })}
              </div>
              <span className="hint">
                Each role sees a tailored dashboard with only the data they need.
              </span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <label className="row gap-8 small muted">
                <input type="checkbox" /> Remember this terminal
              </label>
              <a className="small" style={{ color: 'var(--accent)' }} href="#">
                Forgot password?
              </a>
            </div>
            <button
              className="btn accent"
              style={{ padding: '10px 14px', justifyContent: 'center' }}
              onClick={() => onLogin(role)}
            >
              Sign in as {selected.name} <Icon name="chevr" />
            </button>
          </div>
        </div>

        <div className="tiny muted">© 2026 Sentry Systems · v4.2.1</div>
      </div>

      <div style={{ background: '#0a0c10', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse at 30% 20%, rgba(79,70,229,0.25), transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(34,197,94,0.12), transparent 50%),
              repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 14px)
            `,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: 48,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#cbd5e1',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
            <span
              style={{
                background: 'rgba(220,38,38,0.85)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 3,
                fontWeight: 700,
              }}
            >
              ● LIVE
            </span>
            <span>SECTOR NW-04 · 14:42:09 UTC</span>
          </div>
          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 13, letterSpacing: '0.3em', marginBottom: 8 }}>
              NETWORK STATUS
            </div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', fontSize: 11 }}>
              <span><span style={{ color: '#34d399' }}>●</span> 142 cameras</span>
              <span><span style={{ color: '#34d399' }}>●</span> 38 sensors</span>
              <span><span style={{ color: '#fbbf24' }}>●</span> 2 alerts</span>
              <span><span style={{ color: '#34d399' }}>●</span> 4 sectors</span>
            </div>
          </div>
          <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
            <span>LAT 42.8121° N · LON 113.5644° W</span>
            <span>WIND 14 KT · CLR · 4°C</span>
          </div>
        </div>
      </div>
    </div>
  );
};
