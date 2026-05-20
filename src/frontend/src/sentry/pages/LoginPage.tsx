import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { loginApi, meApi, type MeResponse } from '@/api/auth';
import { storeTokens } from '@/api/client';

export interface AuthenticatedUser {
  id:          string;
  email:       string;
  displayName: string | null;
  role:        string;
}

interface LoginPageProps {
  onLogin: (user: AuthenticatedUser) => void;
}

// The seed creates an OPERATOR with operator@surveillance.local. Showing that
// as a placeholder helps the demo-day workflow without forcing the user to
// remember the convention.
const PLACEHOLDER_EMAIL = 'operator@surveillance.local';

const deriveDisplayName = (me: MeResponse): string | null => {
  // /auth/me currently returns id/email/role/roles/uiMode/bopScope — no
  // displayName yet. Fall back to the local-part of the email so the TopBar
  // has something human to show ("operator" → "operator").
  const localPart = me.email.split('@')[0];
  return localPart ?? null;
};

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const { access_token, refresh_token } = await loginApi(email.trim(), password);
      storeTokens(access_token, refresh_token);

      let user: AuthenticatedUser;
      try {
        const me = await meApi();
        user = {
          id:          me.id,
          email:       me.email,
          role:        me.role,
          displayName: deriveDisplayName(me),
        };
      } catch {
        // /auth/me failed but login succeeded — proceed with what we have.
        user = { id: '', email: email.trim(), role: 'OPERATOR', displayName: null };
      }

      onLogin(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      // Backend returns 401 with { error: '...' }. apiFetch surfaces these
      // as Error('HTTP 401: <body>'). Strip the prefix for a cleaner UI.
      const cleaned = message
        .replace(/^HTTP \d+:\s*/, '')
        .replace(/^\{.*"error":\s*"([^"]+)".*\}$/, '$1');
      setError(cleaned || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: 'var(--bg)',
      }}
    >
      <div style={{ padding: '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div className="row gap-12">
          <div className="brand-mark" style={{ width: 32, height: 32 }}>S</div>
          <div className="brand-name" style={{ fontSize: 16 }}>
            SENTRY <span>/ Border Control System</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 380, width: '100%' }}>
          <div className="pill accent" style={{ marginBottom: 16 }}>
            <span className="ldot" /> Restricted Access · TLS 1.3
          </div>
          <h1 style={{ fontSize: 32, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Welcome back.</h1>
          <p className="muted" style={{ margin: '0 0 28px' }}>
            Sign in with your operator credentials and a hardware key.
          </p>

          <div className="col gap-16">
            <div className="field">
              <label htmlFor="login-email">Operator email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="username"
                placeholder={`e.g. ${PLACEHOLDER_EMAIL}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="field">
              <label>Hardware key</label>
              <div className="row gap-8">
                <input
                  className="input"
                  placeholder="Tap your YubiKey…"
                  disabled
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn" disabled>
                  <Icon name="lock" /> Tap
                </button>
              </div>
              <span className="hint">Hardware key not enforced in staging.</span>
            </div>

            {error && (
              <div
                role="alert"
                className="small"
                style={{
                  color: 'var(--danger, #dc2626)',
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  padding: '8px 10px',
                  borderRadius: 6,
                }}
              >
                {error}
              </div>
            )}

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <label className="row gap-8 small muted">
                <input type="checkbox" /> Remember this terminal
              </label>
              <a className="small" style={{ color: 'var(--accent)' }} href="#">
                Forgot password?
              </a>
            </div>
            <button
              type="submit"
              className="btn accent"
              style={{ padding: '10px 14px', justifyContent: 'center' }}
              disabled={submitting || !email || !password}
            >
              {submitting ? 'Signing in…' : <>Sign in to Sector NW-04 <Icon name="chevr" /></>}
            </button>
            <div className="divider" />
            <div className="small muted" style={{ textAlign: 'center' }}>
              Need access? Contact{' '}
              <span style={{ color: 'var(--ink)' }}>sec-admin@sentry.gov</span>
            </div>
          </div>
        </form>

        <div className="tiny muted">
          © 2026 Sentry Systems · v4.2.1 · <a href="#">Terms</a> · <a href="#">Privacy</a>
        </div>
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
            <span>SECTOR NW-04 · PINEGATE PASS · 14:42:09 UTC</span>
          </div>
          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 13, letterSpacing: '0.3em', marginBottom: 8 }}>NETWORK STATUS</div>
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
