import { Icon, type IconName } from '../components/Icon';
import { CAMERAS } from '../data';

type DeviceKind = 'Camera' | 'Sensor' | 'RF' | 'Barrier';

interface Device {
  id: string;
  sector: string;
  name: string;
  kind: DeviceKind;
  model: string;
  status: 'live' | 'rec' | 'off';
  uptime: string;
  firmware: string;
}

const allDevices: Device[] = [
  ...CAMERAS.map<Device>((c) => ({
    id: c.id,
    sector: c.sector,
    name: c.name,
    kind: 'Camera',
    model: 'Aegis Pro 4K',
    status: c.status,
    uptime: c.status === 'off' ? '—' : '99.4%',
    firmware: '4.12.0',
  })),
  { id: 'SNS-04-02',  sector: 'NW-04', name: 'Tunnel acoustic',  kind: 'Sensor',  model: 'GeoListen v2',  status: 'live', uptime: '100%',  firmware: '2.1.4' },
  { id: 'RF-07-A',    sector: 'NE-07', name: 'RF/drone detector', kind: 'RF',      model: 'SkyGuard X',    status: 'live', uptime: '98.2%', firmware: '1.9.1' },
  { id: 'GATE-22-01', sector: 'E-22',  name: 'Cedar gate barrier', kind: 'Barrier', model: 'GateLink Pro', status: 'live', uptime: '100%',  firmware: '3.0.2' },
];

const KIND_ICON: Record<DeviceKind, IconName> = {
  Camera: 'cam',
  Sensor: 'eye',
  RF: 'bell',
  Barrier: 'lock',
};

const statusLabel = (status: Device['status']) =>
  status === 'off' ? 'Offline' : status === 'rec' ? 'Recording' : 'Live';

const statusPill = (status: Device['status']) =>
  status === 'off' ? 'danger' : status === 'rec' ? 'warn' : 'ok';

export const DevicesPage = () => {
  const offlineCount = allDevices.filter((d) => d.status === 'off').length;
  const cameraOk = CAMERAS.filter((c) => c.status !== 'off').length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Devices</h1>
          <div className="sub">
            {allDevices.length} devices · {offlineCount} offline
          </div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="refresh" /> Sync</button>
          <button className="btn accent"><Icon name="plus" /> Add device</button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        {[
          { k: 'Cameras',     v: CAMERAS.length, ok: cameraOk },
          { k: 'Sensors',     v: 38,             ok: 37 },
          { k: 'Barriers',    v: 6,              ok: 6 },
          { k: 'Avg uptime',  v: '99.1%',        ok: null },
        ].map((s) => (
          <div key={s.k} className="card kpi">
            <div className="label">{s.k}</div>
            <div className="val">{s.v}</div>
            {s.ok !== null && (
              <div className="delta up">
                <Icon name="check" size={12} /> {s.ok} healthy
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>All devices</h3>
          <div className="grow" />
          <div className="search" style={{ width: 240, padding: '4px 10px' }}>
            <Icon name="srch" size={12} />
            <input placeholder="Filter…" />
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Device</th>
              <th>Type</th>
              <th>Sector</th>
              <th>Status</th>
              <th>Uptime (7d)</th>
              <th>Firmware</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {allDevices.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="row gap-12">
                    <div
                      style={{
                        width: 36,
                        height: 28,
                        borderRadius: 4,
                        background: '#0a0c10',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      <Icon name={KIND_ICON[d.kind]} size={12} />
                    </div>
                    <div>
                      <div className="bold">{d.name}</div>
                      <div className="tiny muted mono">{d.id} · {d.model}</div>
                    </div>
                  </div>
                </td>
                <td>{d.kind}</td>
                <td className="mono">{d.sector}</td>
                <td>
                  <span className={`pill ${statusPill(d.status)}`}>
                    <span className="ldot" />
                    {statusLabel(d.status)}
                  </span>
                </td>
                <td>
                  <div className="row gap-8">
                    <div
                      style={{
                        width: 60,
                        height: 5,
                        background: 'var(--bg-sunk)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: d.status === 'off' ? '0%' : d.uptime,
                          background: d.status === 'off' ? 'var(--danger)' : 'var(--ok)',
                        }}
                      />
                    </div>
                    <span className="tnum tiny">{d.uptime}</span>
                  </div>
                </td>
                <td className="mono small">{d.firmware}</td>
                <td>
                  <button className="btn ghost sm">
                    Configure <Icon name="chevr" size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
