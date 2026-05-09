import type { CameraMode, CameraStatus } from '../data';

interface CameraTileProps {
  id: string;
  location: string;
  mode?: CameraMode;
  label?: string;
  alert?: boolean;
  warn?: boolean;
  status?: CameraStatus;
}

const formatClock = () =>
  new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export const CameraTile = ({
  id,
  location,
  mode = 'day',
  label,
  alert = false,
  warn = false,
  status = 'live',
}: CameraTileProps) => {
  const feedClass = alert ? 'alert' : mode === 'night' ? 'night' : '';

  return (
    <div className="cam">
      <div className={`feed ${feedClass}`} />
      {(alert || warn) && (
        <>
          <div className={`crosshair ${warn ? 'warn' : ''}`} />
          <div className="crosshair-label">
            {label ?? (alert ? 'PERSON · 0.92' : 'MOTION')}
          </div>
        </>
      )}
      <div className="ovl">
        <div className="ovl-top">
          <span className="tag">{id}</span>
          {status === 'live' && <span className="live">LIVE</span>}
          {status === 'rec' && (
            <span className="tag" style={{ background: 'rgba(220,38,38,0.85)', color: '#fff' }}>
              ● REC
            </span>
          )}
          {status === 'off' && (
            <span className="tag" style={{ background: 'rgba(0,0,0,0.7)', color: '#9ca3af' }}>
              OFFLINE
            </span>
          )}
        </div>
        <div className="ovl-bot">
          <span className="tag">{location}</span>
          <span className="tag">{formatClock()}</span>
        </div>
      </div>
    </div>
  );
};
