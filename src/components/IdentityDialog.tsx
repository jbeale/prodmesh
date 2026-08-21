import { useState } from 'react';
import { LockKeyhole, MonitorCog, X } from 'lucide-react';
import {
  loginUser,
  registerStation,
  type AuthStatus,
  type Station,
} from '../api';
import { useChurch } from '../layout/church';
import { SelectField } from './SelectField';
import { PasswordInput } from './PasswordInput';

export function IdentityDialog({
  stationRequired,
  campusId,
  status,
  denied,
  onStation,
  onLogin,
  onClose,
}: {
  stationRequired: boolean;
  campusId: string;
  status: AuthStatus | null;
  /** The permission a refused action wanted, when the dialog opened because of one. */
  denied?: { permission: string; label: string } | null;
  onStation: (station: Station) => void;
  onLogin: (status: AuthStatus) => void;
  onClose: () => void;
}) {
  const church = useChurch();
  const [name, setName] = useState('');
  const [stationCampus, setStationCampus] = useState(campusId === '*' ? '' : campusId);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const shortOfPermission = Boolean(denied && status?.authenticated);

  const createStation = async () => {
    setBusy(true); setError('');
    try {
      onStation(await registerStation({ name, campusId: stationCampus || null }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const login = async () => {
    setBusy(true); setError('');
    try {
      onLogin(await loginUser(username, pin));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="identity" role="dialog" aria-modal="true" aria-labelledby="identity-title">
      <div className="identity__card">
        {!stationRequired && (
          <button className="identity__close" onClick={onClose} aria-label="Close"><X size={17} /></button>
        )}
        {stationRequired ? (
          <>
            <div className="identity__mark"><MonitorCog size={22} /></div>
            <p className="eyebrow">Station registration</p>
            <h2 id="identity-title">Name this machine</h2>
            <p className="identity__hint">
              This identifies where actions happen. It does not grant access and can be changed by an administrator later.
            </p>
            <label className="identity__field">
              <span>Station name</span>
              <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="FOH – Producer" />
            </label>
            <label className="identity__field">
              <span>Campus</span>
              <SelectField value={stationCampus} onChange={(e) => setStationCampus(e.target.value)}>
                <option value="">No default campus</option>
                {church.sites.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
            </label>
            <button className="btn btn--primary identity__submit" disabled={busy || name.trim().length < 2} onClick={createStation}>
              Register station
            </button>
          </>
        ) : (
          <>
            <div className="identity__mark"><LockKeyhole size={22} /></div>
            {/* Someone already logged in is not short of a session — they are
                short of an authority, and the fix is a different account, not
                the same one again. Saying only "Log in" sent them round the
                loop they just failed. */}
            <p className="eyebrow">{shortOfPermission ? 'Not permitted' : 'Operator access'}</p>
            <h2 id="identity-title">{shortOfPermission ? 'Log in as someone else' : 'Log in'}</h2>
            <p className="identity__hint">
              {shortOfPermission ? (
                <>
                  <strong>{status?.user?.displayName}</strong> does not have “{denied?.label}”.
                  An administrator can grant it in Admin → Users.
                </>
              ) : denied ? (
                `Logging in is needed for “${denied.label}”.`
              ) : (
                `${status?.station?.name ?? 'This station'} stays available in read-only mode when nobody is logged in.`
              )}
            </p>
            <label className="identity__field">
              <span>Username</span>
              <input className="field" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="identity__field">
              <span>PIN</span>
              <PasswordInput className="field mono" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
            </label>
            <button className="btn btn--primary identity__submit" disabled={busy || !username || !pin} onClick={login}>
              Log in to this station
            </button>
          </>
        )}
        {error && <p className="identity__error">{error}</p>}
      </div>
    </div>
  );
}
