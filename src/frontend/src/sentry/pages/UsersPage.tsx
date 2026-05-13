import { Icon } from '../components/Icon';
import { USERS } from '../data';

const ROLES: { name: string; count: number; perms: string; color: '' | 'danger' | 'accent' | 'info' | 'warn' | 'ok' }[] = [
  { name: 'Administrator', count: 2,  perms: 'Full access',           color: 'danger' },
  { name: 'Sector Lead',   count: 4,  perms: 'Sector ops + reports',  color: 'accent' },
  { name: 'Operator',      count: 12, perms: 'Live + alerts',         color: 'info' },
  { name: 'Investigator',  count: 6,  perms: 'Search + timeline',     color: 'warn' },
  { name: 'Field Officer', count: 18, perms: 'Mobile · view only',    color: '' },
  { name: 'Auditor',       count: 3,  perms: 'Read-only logs',        color: 'ok' },
];

const statusPill = (status: string) =>
  status === 'Online'
    ? 'ok'
    : status === 'On Patrol'
    ? 'info'
    : status === 'Away'
    ? 'warn'
    : '';

export const UsersPage = () => (
  <div className="page">
    <div className="page-head">
      <div>
        <h1>Users & permissions</h1>
        <div className="sub">{USERS.length} users · 6 roles · last sync 2 min ago</div>
      </div>
      <div className="actions">
        <button className="btn"><Icon name="dl" /> Audit log</button>
        <button className="btn accent"><Icon name="plus" /> Invite user</button>
      </div>
    </div>

    <div className="grid g-3" style={{ marginBottom: 16 }}>
      {ROLES.map((r) => (
        <div key={r.name} className="card" style={{ padding: 16 }}>
          <div className="row gap-8" style={{ marginBottom: 6 }}>
            <span className={`pill ${r.color}`}>{r.name}</span>
            <div className="grow" />
            <span className="bold tnum">{r.count}</span>
          </div>
          <div className="small muted">{r.perms}</div>
        </div>
      ))}
    </div>

    <div className="card">
      <div className="card-head">
        <h3>Members</h3>
        <div className="grow" />
        <select className="select sm" style={{ width: 'auto' }}>
          <option>All roles</option>
        </select>
        <div className="search" style={{ width: 200, padding: '4px 10px' }}>
          <Icon name="srch" size={12} />
          <input placeholder="Search…" />
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Area</th>
            <th>Status</th>
            <th>Last active</th>
            <th>2FA</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {USERS.map((u) => (
            <tr key={u.name}>
              <td>
                <div className="row gap-12">
                  <div className="avatar">{u.initials}</div>
                  <div>
                    <div className="bold">{u.name}</div>
                    <div className="tiny muted">
                      {u.name.toLowerCase().replace(' ', '.')}@sentry.gov
                    </div>
                  </div>
                </div>
              </td>
              <td><span className="pill accent">{u.role}</span></td>
              <td className="mono small">{u.area}</td>
              <td>
                <span className={`pill ${statusPill(u.status)}`}>
                  <span className="ldot" />
                  {u.status}
                </span>
              </td>
              <td className="muted small">{u.last}</td>
              <td>
                <span className="pill ok">
                  <Icon name="check" size={10} /> Hardware
                </span>
              </td>
              <td>
                <button className="btn ghost sm">Manage</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
