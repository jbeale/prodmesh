import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CircleUser, MonitorCog, RefreshCw, Trash2 } from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import { HelpTip } from '../components/HelpTip';
import { PersonPicker } from '../components/PersonPicker';
import { PasswordInput } from '../components/PasswordInput';
import { SelectField } from '../components/SelectField';
import { ColorInput } from '../components/form/ColorInput';
import { EditorSection } from '../components/form/EditorSection';
import { IntegrationBrand, IntegrationTitle, integrationInfo, type IntegrationId } from '../components/IntegrationBrand';
import { Field } from '../components/form/Field';
import { FormRow } from '../components/form/FormRow';
import { useDraft } from '../components/form/useDraft';
import { useChurch } from '../layout/church';
import { useQuery } from '../lib/useQuery';
import { viewsKey } from '../lib/keys';
import { allIds, slugId } from '../lib/topology';
import {
  getAuthStatus,
  loginAdmin,
  setPins,
  getSettings,
  saveSchedules,
  getRooms,
  getViews,
  getVersion,
  triggerUpdate,
  getChecklistTemplates,
  saveChecklistTemplate,
  deleteChecklistTemplate,
  getUserDirectory,
  createUser,
  createGroup,
  setUserGroups,
  getStations,
  updateStation,
  revokeStation,
  getServerLog,
  getAuditLog,
  getConfig,
  saveConfig,
  getRoomConnectivity,
  getRoomConnectivityStatus,
  savePcServiceTypes,
  saveAnalysis,
  testAnalysisConnection,
  saveYouTube,
  saveCaptions,
  downloadBackup,
  PermissionError,
  saveProPresenter,
  saveCompanion,
  type PcServiceType,
  type AnalysisConfig,
  type CaptionsConfig,
  type YouTubeConfig,
  type ProPresenterConfig,
  type CompanionConfig,
  type ModeConfig,
  type RoomConnectivity,
  type RoomConnectivityStatus,
  type IntegrationStatus,
  type ServerLogTail,
  type AuditEntry,
  type RoomMeta,
  type ScheduleWindow,
  type ChecklistTemplatesInfo,
  type TemplateItem,
  type UserDirectory,
  type ManagedStation,
  logoSrc,
  uploadLogo,
  clearLogo,
  getSecrets,
  saveSecrets,
  checkIntegrations,
  connectRestream,
  getRestreamConfig,
  checkResiConnection,
  getEnabledIntegrations,
  setIntegrationEnabled,
  type SecretGroup,
  type Version,
} from '../api';
import type { Church, Site, Tile } from '../types';
import logoUrl from '../assets/prodmesh-logo.svg';
type Phase = 'loading' | 'setup' | 'login' | 'admin';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type AdminSection = 'general' | 'integrations' | 'campuses' | 'room' | 'users' | 'stations' | 'checklists' | 'logs';

export function Settings({ section = 'general' }: { section?: AdminSection }) {
  const [phase, setPhase] = useState<Phase>('loading');

  const refreshStatus = useCallback(async () => {
    const s = await getAuthStatus();
    setPhase(s.admin ? 'admin' : s.setupNeeded ? 'setup' : 'login');
  }, []);

  useEffect(() => {
    refreshStatus();
    window.addEventListener('prodmesh:auth-changed', refreshStatus);
    return () => window.removeEventListener('prodmesh:auth-changed', refreshStatus);
  }, [refreshStatus]);

  const titles = {
    general: 'General',
    integrations: 'Integrations',
    users: 'Users & access',
    stations: 'Stations',
    campuses: 'Campuses',
    room: 'Room configuration',
    checklists: 'Checklists',
    logs: 'Logs',
  } as const;

  return (
    <div className="settings">
      <div className="pagehead">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="pagehead__title">{titles[section]}</h1>
        </div>
      </div>

      {phase === 'loading' && <p className="settings__muted">Loading…</p>}
      {phase === 'setup' && <SetupForm onDone={refreshStatus} />}
      {phase === 'login' && <LoginForm onDone={refreshStatus} />}
      {phase === 'admin' && <AdminPanels section={section} />}
    </div>
  );
}

// ── First-run: create the Admin PIN ───────────────────────────────────────────
function SetupForm({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    // First-run sets the ADMIN PIN, which gates a full permission bypass.
    if (pin.length < 6) return setErr('Use at least 6 characters.');
    if (pin !== confirm) return setErr('PINs do not match.');
    await setPins({ admin: pin });
    await loginAdmin(pin);
    onDone();
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Create Admin PIN</h2>
      <p className="settings__muted">This protects Settings and system updates.</p>
      <PasswordInput className="field" inputMode="numeric" placeholder="New admin PIN"
        value={pin} onChange={(e) => setPin(e.target.value)} />
      <PasswordInput className="field" inputMode="numeric" placeholder="Confirm PIN"
        value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {err && <p className="settings__error">{err}</p>}
      <button className="btn btn--primary" onClick={submit}>Create PIN</button>
    </section>
  );
}

// ── Login with Admin PIN ───────────────────────────────────────────────────────
function LoginForm({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (await loginAdmin(pin)) onDone();
    else setErr('Incorrect PIN.');
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Enter Admin PIN</h2>
      <PasswordInput className="field" inputMode="numeric" placeholder="Admin PIN"
        value={pin} onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
      {err && <p className="settings__error">{err}</p>}
      <button className="btn btn--primary" onClick={submit}>Unlock</button>
    </section>
  );
}

// ── Admin panels ───────────────────────────────────────────────────────────────
function AdminPanels({ section }: { section: AdminSection }) {
  return (
    <>
      {section === 'general' && <><BrandingPanel /><SecurityPanel /><SystemPanel /><SchedulesPanel /></>}
      {section === 'integrations' && <><IntegrationEnablePanel /><SecretsPanel /></>}
      {section === 'campuses' && <CampusesPanel />}
      {section === 'room' && <RoomConfigPanel />}
      {section === 'users' && <UserManagementPanel />}
      {section === 'stations' && <StationsPanel />}
      {section === 'checklists' && <ChecklistsPanel />}
      {section === 'logs' && <LogsPanel />}
    </>
  );
}

// ── Save/action feedback ─────────────────────────────────────────────────────
//  Success is green, errors are red — a panel must never announce a failure in
//  the success color, so panels carry the kind alongside the text.
type Feedback = { kind: 'ok' | 'err'; text: string } | null;
const ok = (text: string): Feedback => ({ kind: 'ok', text });
const fail = (err: unknown): Feedback => ({
  kind: 'err',
  text: err instanceof Error ? err.message : String(err),
});
function Msg({ msg, inline = false }: { msg: Feedback; inline?: boolean }) {
  if (!msg) return null;
  const cls = msg.kind === 'ok' ? 'settings__ok' : 'settings__error';
  return inline ? <span className={cls}>{msg.text}</span> : <p className={cls}>{msg.text}</p>;
}

// ── Users, permission groups, and ACLs ───────────────────────────────────────
export function UserManagementPanel() {
  const [directory, setDirectory] = useState<UserDirectory | null>(null);
  const [user, setUser] = useState({ displayName: '', username: '', pin: '', planningCenterPersonId: '' });
  const [userGroups, setUserGroupsDraft] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupPermissions, setGroupPermissions] = useState<string[]>([]);
  const [msg, setMsg] = useState<Feedback>(null);

  const refresh = () => getUserDirectory().then(setDirectory).catch((err) => setMsg(fail(err)));
  useEffect(() => { refresh(); }, []);

  if (!directory) return null;

  const addUser = async () => {
    setMsg(null);
    try {
      await createUser({
        ...user,
        planningCenterPersonId: user.planningCenterPersonId || null,
        groupIds: userGroups,
      });
      setUser({ displayName: '', username: '', pin: '', planningCenterPersonId: '' });
      setUserGroupsDraft([]);
      setMsg(ok('User created.'));
      refresh();
    } catch (err) { setMsg(fail(err)); }
  };

  const addGroup = async () => {
    setMsg(null);
    try {
      await createGroup(groupName, groupPermissions);
      setGroupName(''); setGroupPermissions([]); setMsg(ok('Permission group created.'));
      refresh();
    } catch (err) { setMsg(fail(err)); }
  };

  const toggle = (values: string[], value: string) =>
    values.includes(value) ? values.filter((x) => x !== value) : [...values, value];

  return (
    <section className="panel users">
      <div>
        <p className="section-label">Access control</p>
        <h2 className="panel__title">Users &amp; permissions
          <HelpTip text="Access is the union of a user's groups. Administrators always have every permission." />
        </h2>
      </div>

      <div className="users__grid">
        <div className="users__editor">
          <h3>Create user</h3>
          <input className="field" placeholder="Display name" value={user.displayName} onChange={(e) => setUser({ ...user, displayName: e.target.value })} />
          <input className="field" placeholder="Username" autoCapitalize="none" value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} />
          <PasswordInput className="field" placeholder="PIN" inputMode="numeric" value={user.pin} onChange={(e) => setUser({ ...user, pin: e.target.value })} />
          <PersonPicker value={user.planningCenterPersonId} onChange={(personId) => setUser({ ...user, planningCenterPersonId: personId })} />
          <div className="users__checks">
            {directory.groups.map((group) => (
              <Checkbox key={group.id} label={group.name} checked={userGroups.includes(group.id)} onChange={() => setUserGroupsDraft(toggle(userGroups, group.id))} />
            ))}
          </div>
          <button className="btn btn--primary" disabled={!user.displayName || !user.username || user.pin.length < 4} onClick={addUser}>Create user</button>
        </div>

        <div className="users__editor">
          <h3>Create permission group</h3>
          <input className="field" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <div className="users__checks users__checks--permissions">
            {directory.permissions.map((permission) => (
              <Checkbox key={permission.id} label={<><strong>{permission.label}</strong><small>{permission.id}</small></>} checked={groupPermissions.includes(permission.id)} onChange={() => setGroupPermissions(toggle(groupPermissions, permission.id))} />
            ))}
          </div>
          <button className="btn btn--primary" disabled={groupName.trim().length < 2} onClick={addGroup}>Create group</button>
        </div>
      </div>

      <div className="users__list">
        <h3>Current users</h3>
        {directory.users.length === 0 && <p className="settings__muted">No named users yet. The existing Admin PIN remains available for bootstrap access.</p>}
        {directory.users.map((entry) => (
          <div className="users__row" key={entry.id}>
            <div className="users__identity">
              <span className="users__avatar" role="img" aria-label={`${entry.displayName} avatar`}>
                {entry.avatarUrl
                  ? <img src={entry.avatarUrl} alt="" />
                  : <CircleUser size={28} />}
              </span>
              <span><strong>{entry.displayName}</strong><small>@{entry.username}{entry.planningCenterPersonId ? ` · PCO ${entry.planningCenterPersonId}` : ''}</small></span>
            </div>
            <div className="users__groups">
              {directory.groups.map((group) => {
                const checked = entry.groups.some((g) => g.id === group.id);
                return <Checkbox key={group.id} label={group.name} checked={checked} onChange={async () => {
                  const next = toggle(entry.groups.map((g) => g.id), group.id);
                  await setUserGroups(entry.id, next);
                  refresh();
                }} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <Msg msg={msg} />
    </section>
  );
}

// ── Registered browser stations ─────────────────────────────────────────────
function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function StationsPanel() {
  const [stations, setStations] = useState<ManagedStation[]>([]);
  const [rooms, setRooms] = useState<RoomMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Feedback>(null);
  const [revokeTarget, setRevokeTarget] = useState<ManagedStation | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [stationResult, roomResult] = await Promise.all([getStations(), getRooms()]);
      setStations(stationResult.stations);
      setRooms(roomResult);
    } catch (err) {
      setMessage(fail(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = async () => {
    if (!revokeTarget) return;
    setMessage(null);
    try {
      const result = await revokeStation(revokeTarget.id);
      setRevokeTarget(null);
      if (!result.current) {
        setMessage(ok('Station revoked. Its browser will be asked to register again.'));
        refresh();
      }
    } catch (err) {
      setMessage(fail(err));
    }
  };

  if (loading) return <p className="settings__muted">Loading stations…</p>;

  return (
    <section className="panel stations">
      <div>
        <p className="section-label">Browser identity</p>
        <h2 className="panel__title">Registered stations
          <HelpTip text="A station identifies which browser an action came from. Revoking one signs out its sessions and returns that browser to first-run registration." />
        </h2>
      </div>

      <div className="stations__list">
        {stations.length === 0 && <p className="settings__muted">No registered stations.</p>}
        {stations.map((station) => (
          <StationEditor
            key={station.id}
            station={station}
            rooms={rooms}
            onSaved={(updated) => {
              setStations((all) => all.map((entry) => entry.id === updated.id ? { ...updated, current: station.current } : entry));
              setMessage(ok('Station updated.'));
            }}
            onRevoke={() => setRevokeTarget(station)}
          />
        ))}
      </div>
      <Msg msg={message} />

      {revokeTarget && (
        <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="revoke-station-title">
          <div className="confirm__card">
            <p className="eyebrow">Revoke station</p>
            <p className="confirm__text" id="revoke-station-title">
              Unregister <strong>{revokeTarget.name}</strong>? Its browser will return to station registration.
            </p>
            <div className="confirm__buttons">
              <button className="confirm__cancel" onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button className="confirm__ok" onClick={remove}>Revoke station</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StationEditor({
  station,
  rooms,
  onSaved,
  onRevoke,
}: {
  station: ManagedStation;
  rooms: RoomMeta[];
  onSaved: (station: ManagedStation) => void;
  onRevoke: () => void;
}) {
  const church = useChurch();
  const [name, setName] = useState(station.name);
  const [campusId, setCampusId] = useState(station.campusId ?? '');
  const [roomId, setRoomId] = useState(station.roomId ?? '');
  const [roomOnly, setRoomOnly] = useState(station.roomOnly ?? false);
  const [viewId, setViewId] = useState(station.viewId ?? '');
  const [busy, setBusy] = useState(false);

  // A display belongs to the room the station stands in — the server refuses
  // any other pairing, so offer only what it would accept.
  const displays = useQuery(
    roomId ? viewsKey(roomId) : null,
    () => getViews(roomId),
    { staleMs: 30_000 },
  ).data?.views.filter((view) => view.kind === 'display') ?? [];

  const campusRooms = rooms.filter((room) => !campusId || room.site === campusId);
  const dirty =
    name !== station.name ||
    campusId !== (station.campusId ?? '') ||
    roomId !== (station.roomId ?? '') ||
    viewId !== (station.viewId ?? '') ||
    (roomId !== '' && roomOnly !== (station.roomOnly ?? false));

  const save = async () => {
    setBusy(true);
    try {
      onSaved(await updateStation(station.id, {
        name,
        campusId: campusId || null,
        roomId: roomId || null,
        roomOnly: Boolean(roomId) && roomOnly,
        viewId: (roomId && viewId) || null,
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stations__row">
      <div className="stations__identity">
        <span className="stations__icon"><MonitorCog size={19} /></span>
        <span>
          <strong>{station.name}</strong>
          <small>{station.current ? 'CURRENT STATION · ' : ''}Last seen {relativeTime(station.lastSeen)}</small>
        </span>
      </div>
      <div className="stations__fields">
        <label><span>Name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>
          <span>Campus</span>
          <SelectField value={campusId} onChange={(event) => {
            setCampusId(event.target.value);
            if (roomId && rooms.find((room) => room.id === roomId)?.site !== event.target.value) setRoomId('');
          }}>
            <option value="">Unassigned</option>
            {church.sites.filter((site) => site.status === 'active').map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </SelectField>
        </label>
        <label>
          <span>Room</span>
          <SelectField value={roomId} onChange={(event) => {
            const nextRoom = rooms.find((room) => room.id === event.target.value);
            setRoomId(event.target.value);
            if (nextRoom) setCampusId(nextRoom.site ?? '');
            // The display belonged to the old room; keeping it would be a
            // save the server refuses.
            setViewId('');
          }}>
            <option value="">No room</option>
            {campusRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </SelectField>
        </label>
        <label>
          <span>Display <HelpTip text="This browser shows that display full-screen with no navigation — a Raspberry Pi on a multiview input, or a TV in the foyer. It still works as an ordinary browser until you open it." /></span>
          <SelectField
            value={viewId}
            disabled={!roomId || displays.length === 0}
            title={roomId ? undefined : 'Assign a room first'}
            onChange={(event) => setViewId(event.target.value)}
          >
            <option value="">{displays.length ? 'Not a display' : 'No displays in this room'}</option>
            {displays.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
          </SelectField>
        </label>
        <Checkbox
          label="Room only when locked"
          title={roomId
            ? 'In read-only mode (nobody logged in), this station only browses its assigned room. Logging in unlocks everything.'
            : 'Assign a room first'}
          checked={Boolean(roomId) && roomOnly}
          disabled={!roomId}
          onChange={(event) => setRoomOnly(event.target.checked)}
        />
      </div>
      <div className="stations__actions">
        <button className="btn btn--primary btn--sm" disabled={!dirty || busy || name.trim().length < 2} onClick={save}>Save</button>
        <button className="btn btn--ghost btn--sm stations__revoke" onClick={onRevoke}><Trash2 size={13} /> Revoke</button>
      </div>
    </div>
  );
}

// ── Checklist templates (per event type) ──────────────────────────────────────
const DEFAULT_KEY = '*';

function ChecklistsPanel() {
  const [info, setInfo] = useState<ChecklistTemplatesInfo | null>(null);
  const [selected, setSelected] = useState(DEFAULT_KEY);
  const [draft, setDraft] = useState<TemplateItem[] | null>(null);
  const [msg, setMsg] = useState<Feedback>(null);

  useEffect(() => {
    getChecklistTemplates()
      .then((i) => {
        setInfo(i);
        setDraft(i.templates[DEFAULT_KEY] ?? null);
      })
      .catch(() => {});
  }, []);

  if (!info) return null;

  const typeName = (id: string) =>
    id === DEFAULT_KEY
      ? 'Default (any other event)'
      : info.serviceTypes.find((s) => s.id === id)?.name ?? `Type ${id}`;

  // Event types worth listing: the default, everything mapped on a room, plus
  // any template saved for a type we no longer map (so it stays editable).
  const typeIds = [
    DEFAULT_KEY,
    ...info.serviceTypes.map((s) => s.id),
    ...Object.keys(info.templates).filter(
      (id) => id !== DEFAULT_KEY && !info.serviceTypes.some((s) => s.id === id),
    ),
  ];

  const pick = (id: string) => {
    setSelected(id);
    setDraft(info.templates[id] ?? null);
    setMsg(null);
  };

  const edit = (i: number, patch: Partial<TemplateItem>) =>
    setDraft((d) => d!.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, delta: number) =>
    setDraft((d) => {
      const next = [...d!];
      const j = i + delta;
      if (j < 0 || j >= next.length) return d!;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setMsg(null);
    try {
      const templates = await saveChecklistTemplate(selected, draft ?? []);
      setInfo((x) => x && { ...x, templates });
      setDraft(templates[selected] ?? []);
      setMsg(ok('Template saved.'));
    } catch (err) {
      setMsg(fail(err));
    }
  };

  const removeTemplate = async () => {
    setMsg(null);
    try {
      const templates = await deleteChecklistTemplate(selected);
      setInfo((x) => x && { ...x, templates });
      setDraft(templates[selected] ?? null);
      setMsg(ok(selected === DEFAULT_KEY ? 'Default template removed.' : 'Now using the Default template.'));
    } catch (err) {
      setMsg(fail(err));
    }
  };

  const hasOwn = Boolean(info.templates[selected]);

  return (
    <section className="panel">
      <h2 className="panel__title">Checklists</h2>

      <div className="tpl-types">
        {typeIds.map((id) => (
          <button
            key={id}
            className={`typebtn${selected === id ? ' typebtn--on' : ''}`}
            onClick={() => pick(id)}
          >
            {typeName(id)}
            {id !== DEFAULT_KEY && !info.templates[id] && (
              <span className="typebtn__uses">default</span>
            )}
          </button>
        ))}
      </div>

      {draft === null ? (
        <div className="tpl-fallback">
          <p className="settings__muted">
            <strong>{typeName(selected)}</strong> uses the Default template
            {(info.templates[DEFAULT_KEY] ?? []).length
              ? ` (${info.templates[DEFAULT_KEY]!.length} items)`
              : ' (currently empty)'}
            .
          </p>
          <button
            className="btn btn--sm"
            onClick={() => setDraft(structuredClone(info.templates[DEFAULT_KEY] ?? []))}
          >
            Customize for this event type
          </button>
        </div>
      ) : (
        <>
          {draft.length === 0 && <p className="settings__muted">No items yet.</p>}
          {draft.map((it, i) => (
            <div key={it.id ?? `new-${i}`} className="tpl-item">
              <div className="tpl-item__order">
                <button className="orderbtn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp size={13} />
                </button>
                <button className="orderbtn" disabled={i === draft.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                  <ArrowDown size={13} />
                </button>
              </div>
              <input
                className="field tpl-item__label"
                value={it.label}
                placeholder="What needs to happen?"
                onChange={(e) => edit(i, { label: e.target.value })}
              />
              <SelectField
                className="tpl-item__action"
                value={it.action?.mode ?? ''}
                onChange={(e) =>
                  edit(i, { action: e.target.value ? { type: 'mode', mode: e.target.value } : null })
                }
              >
                <option value="">Manual check</option>
                {info.modes.map((m) => (
                  <option key={m.id} value={m.id}>
                    ⚡ Set room to {m.label}
                  </option>
                ))}
              </SelectField>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setDraft((d) => d!.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="settings__toolbar">
            <button className="btn btn--sm" onClick={() => setDraft((d) => [...(d ?? []), { label: '' }])}>
              + Item
            </button>
            <button className="btn btn--primary" onClick={save}>
              Save template
            </button>
            {hasOwn && selected !== DEFAULT_KEY && (
              <button className="btn btn--ghost" onClick={removeTemplate}>
                Remove (use Default)
              </button>
            )}
            <Msg msg={msg} inline />
          </div>
        </>
      )}
    </section>
  );
}

function SecurityPanel() {
  const [overrideSet, setOverrideSet] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [overridePin, setOverridePin] = useState('');
  const [msg, setMsg] = useState<Feedback>(null);

  useEffect(() => {
    getSettings().then((s) => setOverrideSet(s.pins.overrideSet)).catch(() => {});
  }, []);

  const saveAdmin = async () => {
    // Longer than the override PIN on purpose: this one unlocks a token that
    // bypasses every permission check, while the override only clears a room
    // mode change for someone already standing at the booth. Server enforces
    // the same floor — this is just a faster, kinder error.
    if (adminPin.length < 6) return setMsg(fail('Admin PIN must be at least 6 characters.'));
    try {
      await setPins({ admin: adminPin });
      setAdminPin(''); setMsg(ok('Admin PIN updated.'));
    } catch (err) { setMsg(fail(err)); }
  };
  const saveOverride = async () => {
    if (overridePin.length < 4) return setMsg(fail('Override PIN must be ≥ 4 digits.'));
    try {
      await setPins({ override: overridePin });
      setOverridePin(''); setOverrideSet(true); setMsg(ok('Override PIN updated.'));
    } catch (err) { setMsg(fail(err)); }
  };
  const clearOverride = async () => {
    try {
      await setPins({ override: '' });
      setOverrideSet(false); setMsg(ok('Override PIN cleared — mode locks are now inactive.'));
    } catch (err) { setMsg(fail(err)); }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Security</h2>
      <div className="panel__row">
        <div>
          <div className="panel__label">Admin PIN</div>
          <div className="settings__muted">Protects Settings + system updates.</div>
        </div>
        <div className="panel__controls">
          <PasswordInput className="field field--sm" inputMode="numeric" placeholder="New admin PIN"
            value={adminPin} onChange={(e) => setAdminPin(e.target.value)} />
          <button className="btn" onClick={saveAdmin}>Update</button>
        </div>
      </div>
      <div className="panel__row">
        <div>
          <div className="panel__label">Override PIN {overrideSet
            ? <span className="pill pill--on">set</span>
            : <span className="pill pill--off">not set</span>}</div>
          <div className="settings__muted">Unlocks locked mode changes during protected windows.</div>
        </div>
        <div className="panel__controls">
          <PasswordInput className="field field--sm" inputMode="numeric" placeholder="New override PIN"
            value={overridePin} onChange={(e) => setOverridePin(e.target.value)} />
          <button className="btn" onClick={saveOverride}>Update</button>
          {overrideSet && <button className="btn btn--ghost" onClick={clearOverride}>Clear</button>}
        </div>
      </div>
      <Msg msg={msg} />
    </section>
  );
}

const secretGroupIntegration = (id: string): IntegrationId => ({
  planningCenter: 'planning-center', slack: 'slack', youtube: 'youtube', restream: 'restream', resi: 'resi',
}[id] as IntegrationId | undefined) ?? 'prodmesh';

const INTEGRATION_GROUPS: Array<{ title: string; description: string; integrations: IntegrationId[] }> = [
  {
    title: 'Planning & Scheduling',
    description: 'Build services, schedules, teams, and run-of-show information.',
    integrations: ['planning-center'],
  },
  {
    title: 'Presentation & Show Control',
    description: 'Control presentations and connect room automation.',
    integrations: ['propresenter', 'companion'],
  },
  {
    title: 'Audio',
    description: 'Measure live SPL and monitor loudness over time.',
    integrations: ['open-sound-meter', 'smaart', 'prodmesh-rta'],
  },
  {
    title: 'Video & Streaming',
    description: 'Monitor broadcasts, destinations, and audience activity.',
    integrations: ['youtube', 'restream', 'resi'],
  },
  {
    title: 'Communication',
    description: 'Keep the booth and team connected with captions and messaging.',
    integrations: ['slack', 'captions', 'prodcom'],
  },
];

function IntegrationEnablePanel() {
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<Feedback>(null);
  const refresh = useCallback(() => { getEnabledIntegrations().then((state) => setEnabled(state.enabled)).catch((err) => setMsg(fail(err))); }, []);
  useEffect(refresh, [refresh]);

  const toggle = async (id: IntegrationId) => {
    if (!enabled) return;
    const next = !(enabled[id] ?? true);
    setSaving(id); setMsg(null);
    try {
      const state = await setIntegrationEnabled(id, next);
      setEnabled(state.enabled);
      // The credential-management cards live in a sibling panel. Tell them
      // about the saved state so they appear or disappear immediately.
      window.dispatchEvent(new CustomEvent('prodmesh:integrations-changed', { detail: state.enabled }));
    } catch (err) { setMsg(fail(err)); }
    finally { setSaving(null); }
  };

  return <section className="panel">
    <p className="section-label">Availability</p>
    <h2 className="panel__title">Enabled integrations</h2>
    <p className="settings__muted">Turn off integrations your organization does not use. Their stored credentials remain intact, but their widgets are unavailable on new dashboards until re-enabled.</p>
    <div className="integration-groups">
      {INTEGRATION_GROUPS.map((group) => <section className="integration-group" key={group.title}>
        <div className="integration-group__head">
          <h3>{group.title}</h3>
          <p>{group.description}</p>
        </div>
        <div className="integration-switches">
          {group.integrations.map((id) => <div className="integration-switch" key={id}>
            <IntegrationBrand integration={id} label />
            <label className="integration-switch__toggle">
              <input type="checkbox" checked={enabled?.[id] ?? true} disabled={!enabled || saving === id} onChange={() => toggle(id)} />
              <span>{enabled?.[id] === false ? 'Disabled' : saving === id ? 'Saving…' : 'Enabled'}</span>
            </label>
          </div>)}
        </div>
      </section>)}
    </div>
    <Msg msg={msg} />
  </section>;
}

// Credentials for Planning Center and Slack. WRITE-ONLY on purpose: the server
// never returns a stored credential, so this shows WHETHER one is set (as a
// row of dots) and never what it is. Editing opens a modal per integration, so
// the common case — looking at this page to check something is configured —
// stays a glance rather than a form.
function SecretsPanel() {
  const [groups, setGroups] = useState<SecretGroup[] | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);
  const [editing, setEditing] = useState<SecretGroup | null>(null);

  const load = useCallback(() => {
    getSecrets().then((r) => setGroups(r.secrets)).catch(() => setGroups([]));
    getEnabledIntegrations().then((r) => setEnabled(r.enabled)).catch(() => setEnabled(null));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const update = (event: Event) => setEnabled((event as CustomEvent<Record<string, boolean>>).detail);
    window.addEventListener('prodmesh:integrations-changed', update);
    return () => window.removeEventListener('prodmesh:integrations-changed', update);
  }, []);

  if (!groups) return null;

  return (
    <section className="panel">
      <p className="section-label">Credentials</p>
      <h2 className="panel__title">
        Integrations
        <HelpTip text="Write-only: ProdMesh never shows a saved credential back, so a stolen admin session can't read them. To check a value, open server/data/secrets.json on the server." />
      </h2>

      <div className="integrations">
        {groups.filter((group) => enabled?.[secretGroupIntegration(group.id)] !== false).map((group) => (
          <div key={group.id} className="integration">
            <div className="integration__head">
              <span className="integration__name"><IntegrationBrand integration={secretGroupIntegration(group.id)} />{group.label}{integrationInfo[secretGroupIntegration(group.id)].beta && <span className="integration-brand__beta">Beta</span>}</span>
              <span className={`integration__state integration__state--${group.configured ? 'on' : 'off'}`}>
                {group.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <div className="integration__actions">
              <button className="btn btn--sm" onClick={() => setEditing(group)}>Manage integration</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <SecretsDialog
          group={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => { setGroups(next); setEditing(null); }}
        />
      )}
    </section>
  );
}

function SecretsDialog({
  group,
  onClose,
  onSaved,
}: {
  group: SecretGroup;
  onClose: () => void;
  onSaved: (groups: SecretGroup[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Feedback>(null);
  const [restreamRedirectUrl, setRestreamRedirectUrl] = useState('');
  const [copiedRestreamUrl, setCopiedRestreamUrl] = useState(false);
  const [connectingRestream, setConnectingRestream] = useState(false);
  const [checkingResi, setCheckingResi] = useState(false);
  const [checkingPlanningCenter, setCheckingPlanningCenter] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<Feedback>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => {
    if (group.id === 'restream') getRestreamConfig().then((r) => setRestreamRedirectUrl(r.redirectUrl)).catch(() => {});
  }, [group.id]);

  const dirty = Object.values(draft).some((v) => v.trim() !== '');

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveSecrets(draft);
      // Credentials are only really saved if they work — finding out here
      // beats finding out mid-service on Sunday.
      if (group.id === 'planningCenter') {
        const check = await checkIntegrations().catch(() => null);
        if (check?.planningCenter === false) {
          setMsg(fail(`Saved, but Planning Center could not verify these credentials${check.reason ? ` (${check.reason})` : ''}.`));
          setBusy(false);
          return;
        }
      }
      onSaved(res.secrets);
    } catch (err) {
      setMsg(fail(err));
      setBusy(false);
    }
  };

  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="secret-title">
      <div className="confirm__card secretdlg">
        <p className="eyebrow">Credentials</p>
        <h3 id="secret-title" className="secretdlg__title">{group.label}</h3>
        <p className="settings__muted">{group.hint}</p>

        {group.fields.map((f) => (
          <label key={f.path} className="lfield">
            <span>
              {f.label}
              {f.set && <span className="secretdlg__kept">leave blank to keep</span>}
            </span>
            {f.secret ? <PasswordInput
              className="field"
              autoComplete="new-password"
              placeholder={f.set ? (f.secret ? '••••••••' : f.value ?? '') : 'not set'}
              value={draft[f.path] ?? ''}
              disabled={f.env || busy}
              onChange={(e) => setDraft((d) => ({ ...d, [f.path]: e.target.value }))}
            /> : <input
              className="field"
              type="text"
              autoComplete="new-password"
              placeholder={f.set ? f.value ?? '' : 'not set'}
              value={draft[f.path] ?? ''}
              disabled={f.env || busy}
              onChange={(e) => setDraft((d) => ({ ...d, [f.path]: e.target.value }))}
            />}
            {f.note && <small className="settings__muted">{f.note}</small>}
            {f.env && <small className="settings__muted">Set by an environment variable — edit it there.</small>}
          </label>
        ))}

        {group.id === 'restream' && (
          <>
            <p className="settings__muted integration__redirect">
              Redirect URL: <code>{restreamRedirectUrl || `${window.location.origin}/api/integrations/restream/callback`}</code>
              <button className="btn btn--sm" type="button" onClick={() => {
                const url = restreamRedirectUrl || `${window.location.origin}/api/integrations/restream/callback`;
                navigator.clipboard.writeText(url).then(() => { setCopiedRestreamUrl(true); window.setTimeout(() => setCopiedRestreamUrl(false), 1800); }).catch(() => setConnectionMessage(fail('Could not copy the Redirect URL. Please select and copy it manually.')));
              }}>{copiedRestreamUrl ? 'Copied' : 'Copy'}</button>
            </p>
            <p className="settings__muted">Save credentials, register this exact URL in Restream, then connect the account that owns your broadcasts.</p>
          </>
        )}

        {group.id === 'resi' && <p className="settings__muted">ProdMesh keeps the Resi token on this server. The optional player URL is embedded directly; dashboard clients receive only normalized broadcast data.</p>}

        {msg && <p className={`settings__msg settings__msg--${msg.kind}`}>{msg.text}</p>}
        {connectionMessage && <p className={`settings__msg settings__msg--${connectionMessage.kind}`}>{connectionMessage.text}</p>}

        <div className="confirm__buttons">
          <button className="confirm__cancel" onClick={onClose} disabled={busy}>Cancel</button>
          {group.id === 'restream' && <button className="btn" disabled={!group.configured || connectingRestream} onClick={() => {
            setConnectionMessage(null); setConnectingRestream(true);
            connectRestream().catch((err) => setConnectionMessage(fail(err))).finally(() => setConnectingRestream(false));
          }}>{connectingRestream ? 'Connecting…' : 'Connect account'}</button>}
          {group.id === 'planningCenter' && <button className="btn" disabled={!group.configured || checkingPlanningCenter} onClick={() => {
            setConnectionMessage(null); setCheckingPlanningCenter(true);
            checkIntegrations().then((result) => setConnectionMessage(
              result.planningCenter ? ok('Connected — Planning Center credentials are valid.') : fail(result.reason ?? 'Planning Center could not verify the saved credentials.'),
            )).catch((err) => setConnectionMessage(fail(err))).finally(() => setCheckingPlanningCenter(false));
          }}>{checkingPlanningCenter ? 'Testing…' : 'Test connection'}</button>}
          {group.id === 'resi' && <button className="btn" disabled={!group.configured || checkingResi} onClick={() => {
            setConnectionMessage(null); setCheckingResi(true);
            checkResiConnection().then((state) => setConnectionMessage(ok(state.live ? 'Connected — Resi reports a live broadcast.' : 'Connected — Resi reports no active broadcast.'))).catch((err) => setConnectionMessage(fail(err))).finally(() => setCheckingResi(false));
          }}>{checkingResi ? 'Testing…' : 'Test connection'}</button>}
          <button className="confirm__ok" onClick={save} disabled={!dirty || busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SystemPanel() {
  const [version, setVersion] = useState<Version | null>(null);
  const [status, setStatus] = useState<Feedback>(null);

  const load = useCallback(() => getVersion().then(setVersion).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const update = async () => {
    setStatus(ok('Starting update…'));
    const before = version?.commit;
    try {
      await triggerUpdate();
    } catch {
      return setStatus(fail('Could not start update.'));
    }
    setStatus(ok('Updating & restarting… (this page may briefly disconnect)'));
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      try {
        const v = await getVersion();
        if (v.commit !== before && v.commit !== 'unknown') {
          setVersion(v); setStatus(ok(`Updated to ${v.commit}.`)); clearInterval(iv);
        }
      } catch { /* server restarting */ }
      if (tries > 40) { setStatus(fail('Update taking longer than expected — check the box.')); clearInterval(iv); }
    }, 3000);
  };

  return (
    <section className="panel">
      <h2 className="panel__title">System</h2>
      <div className="panel__row">
        <div>
          <div className="panel__label">Version</div>
          <div className="settings__muted">
            {version
              ? <>{version.version}{version.commit !== 'unknown' && <> · <code>{version.commit}</code></>}
                {version.subject && <> — {version.subject}</>}</>
              : '…'}
          </div>
          {/* Sits with the version, not adrift below the row: it describes
              this install, and a loose paragraph reads as an error. */}
          {version && !version.update.supported && (
            <div className="settings__muted">{version.update.reason}</div>
          )}
        </div>
        {/* A button that cannot work is worse than no button: someone presses
            it mid-service and reads the silence as a broken install. The slot
            goes with it — an empty controls div leaves a gap where a control
            visibly used to be. */}
        {version?.update.supported && (
          <div className="panel__controls">
            <button className="btn btn--primary" onClick={update}>Update now</button>
          </div>
        )}
      </div>
      <Msg msg={status} />

      <BackupRow />
    </section>
  );
}

/**
 * Download an installation.
 *
 * The warning is not boilerplate and is not a tooltip: this file contains the
 * Planning Center token, every PIN and every credential, and the person most
 * likely to press this is the one least likely to guess that. UI_TEXT keeps
 * supplementary detail in a HelpTip, but a must-know consequence stays inline
 * — the same rule the admin PIN reset already follows.
 */
function BackupRow() {
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Feedback>(null);

  const download = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await downloadBackup(history);
      setMsg(ok('Backup downloaded.'));
    } catch (err) {
      setMsg(fail(err instanceof PermissionError ? err.message : 'Could not build the backup.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel__row">
      <div>
        <div className="panel__label">Backup</div>
        <div className="settings__muted">
          Everything needed to rebuild this install on another machine: campuses,
          rooms, integrations, users, dashboards and checklists.
        </div>
        <div className="settings__warn">
          Keep it somewhere safe. It contains your Planning Center token, your
          PINs and every other credential — anyone with this file has what the
          server has.
        </div>
        <label className="settings__check">
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
          Include show history (much larger — every recorded service and its
          loudness readings)
        </label>
        <div className="settings__muted">
          To restore, install prodmesh on the new machine and use the backup on
          its welcome screen. Restoring is only possible before an admin PIN is
          set, so it can never overwrite a working install.
        </div>
        <Msg msg={msg} />
      </div>
      <div className="panel__controls">
        <button className="btn" onClick={download} disabled={busy}>
          {busy ? 'Preparing…' : 'Download backup'}
        </button>
      </div>
    </div>
  );
}

function SchedulesPanel() {
  const [rooms, setRooms] = useState<RoomMeta[]>([]);
  const [schedules, setSchedules] = useState<Record<string, ScheduleWindow[]>>({});
  const [msg, setMsg] = useState<Feedback>(null);

  useEffect(() => {
    Promise.all([getRooms(), getSettings()])
      .then(([r, s]) => { setRooms(r); setSchedules(s.schedules ?? {}); })
      .catch(() => {});
  }, []);

  const windowsFor = (roomId: string) => schedules[roomId] ?? [];
  const update = (roomId: string, next: ScheduleWindow[]) =>
    setSchedules((s) => ({ ...s, [roomId]: next }));

  const addWindow = (roomId: string) =>
    update(roomId, [...windowsFor(roomId), {
      // Not crypto.randomUUID() — that requires a secure context (https/localhost)
      // and would throw when a room Mac opens the app over http://<ip>.
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: 'New window', days: [0], start: '08:00', end: '12:00', lock: [],
    }]);

  const editWindow = (roomId: string, i: number, patch: Partial<ScheduleWindow>) =>
    update(roomId, windowsFor(roomId).map((w, j) => (j === i ? { ...w, ...patch } : w)));

  const removeWindow = (roomId: string, i: number) =>
    update(roomId, windowsFor(roomId).filter((_, j) => j !== i));

  const save = async () => {
    setMsg(null);
    try {
      await saveSchedules(schedules);
      setMsg(ok('Schedules saved.'));
    } catch (err) { setMsg(fail(err)); }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Schedules &amp; Locks</h2>

      {rooms.map((room) => (
        <div key={room.id} className="sched-room">
          <div className="sched-room__head">
            <h3 className="sched-room__name">{room.name}</h3>
            <button className="btn btn--sm" onClick={() => addWindow(room.id)}>+ Window</button>
          </div>
          {windowsFor(room.id).length === 0 && <p className="settings__muted">No windows.</p>}
          {windowsFor(room.id).map((w, i) => (
            <div key={w.id} className="sched-win">
              <input className="field field--sm" value={w.label}
                onChange={(e) => editWindow(room.id, i, { label: e.target.value })} />
              <div className="sched-days">
                {DAY_LABELS.map((d, di) => (
                  <button key={di} type="button"
                    className={`daybtn${w.days.includes(di) ? ' daybtn--on' : ''}`}
                    onClick={() => editWindow(room.id, i, {
                      days: w.days.includes(di) ? w.days.filter((x) => x !== di) : [...w.days, di].sort(),
                    })}>{d}</button>
                ))}
              </div>
              <input className="field field--time" type="time" value={w.start}
                onChange={(e) => editWindow(room.id, i, { start: e.target.value })} />
              <span className="sched-dash">–</span>
              <input className="field field--time" type="time" value={w.end}
                onChange={(e) => editWindow(room.id, i, { end: e.target.value })} />
              <div className="sched-locks">
                <span className="settings__muted">Lock:</span>
                {room.modes.map((m) => (
                  <Checkbox key={m.id} className="lockchk" label={m.label}
                    checked={w.lock.includes(m.id)}
                      onChange={() => editWindow(room.id, i, {
                        lock: w.lock.includes(m.id) ? w.lock.filter((x) => x !== m.id) : [...w.lock, m.id],
                      })} />
                ))}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => removeWindow(room.id, i)}>Remove</button>
            </div>
          ))}
        </div>
      ))}
      <div className="settings__toolbar">
        <button className="btn btn--primary" onClick={save}>Save schedules</button>
        <Msg msg={msg} inline />
      </div>
    </section>
  );
}

// ── Logs: server process log + audit trail ─────────────────────────────────────
export function LogsPanel() {
  const [tab, setTab] = useState<'server' | 'audit'>('server');
  return (
    <>
      <div className="logtabs">
        <button className={`typebtn${tab === 'server' ? ' typebtn--on' : ''}`} onClick={() => setTab('server')}>
          Server log
        </button>
        <button className={`typebtn${tab === 'audit' ? ' typebtn--on' : ''}`} onClick={() => setTab('audit')}>
          Audit trail
        </button>
      </div>
      {tab === 'server' ? <ServerLogViewer /> : <AuditTrail />}
    </>
  );
}

function ServerLogViewer() {
  const [log, setLog] = useState<ServerLogTail | null>(null);
  const [lines, setLines] = useState(500);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const preRef = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    try {
      setLog(await getServerLog(lines));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [lines]);

  useEffect(() => {
    refresh();
    if (!follow) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh, follow]);

  const shown = (log?.lines ?? []).filter(
    (line) => !filter || line.toLowerCase().includes(filter.toLowerCase()),
  );

  // Keep the newest lines in view as the log grows (unless filtering around).
  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, log?.size]);

  return (
    <section className="panel logview">
      <div>
        <p className="section-label">Diagnostics</p>
        <h2 className="panel__title">Server log</h2>
      </div>

      <div className="logview__controls">
        <input
          className="field logview__filter"
          placeholder="Filter lines… (e.g. smaart, autostart)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <SelectField value={lines} onChange={(e) => setLines(Number(e.target.value))} aria-label="Lines to show">
          <option value={200}>Last 200</option>
          <option value={500}>Last 500</option>
          <option value={1000}>Last 1,000</option>
          <option value={2000}>Last 2,000</option>
        </SelectField>
        <Checkbox label="Auto-refresh" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
      </div>

      {log && !log.exists && (
        <p className="settings__muted">
          No log file at <code>{log.file}</code>. {log.hint}
        </p>
      )}
      {log?.exists && (
        <>
          <pre ref={preRef} className="logview__pre" data-testid="server-log">
            {shown.join('\n') || (filter ? 'No lines match the filter.' : 'Log is empty.')}
          </pre>
          <p className="settings__muted logview__meta">
            {shown.length === log.lines.length
              ? `${log.lines.length} lines`
              : `${shown.length} of ${log.lines.length} lines`}
            {log.size != null && <> · {Math.max(1, Math.round(log.size / 1024))} KB</>}
            {log.mtime != null && <> · updated {relativeTime(log.mtime)}</>}
          </p>
        </>
      )}
      {error && <p className="settings__error">{error}</p>}
    </section>
  );
}

function AuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setEntries((await getAuditLog(200)).entries);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <section className="panel audittrail">
      <div className="audittrail__head">
        <div>
          <p className="section-label">Accountability</p>
          <h2 className="panel__title">Audit trail
            <HelpTip text="Every consequential action, who did it, and from which station. The most recent 200 entries." />
          </h2>
        </div>
        <button className="btn" onClick={refresh}>Refresh</button>
      </div>


      {error && <p className="settings__error">{error}</p>}
      {entries && entries.length === 0 && <p className="settings__muted">Nothing recorded yet.</p>}
      {entries && entries.length > 0 && (
        <div className="audittrail__scroll">
          <table className="audittrail__table">
            <thead>
              <tr><th>When</th><th>User</th><th>Station</th><th>Action</th><th>Result</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="audittrail__when" title={new Date(entry.ts).toLocaleString()}>
                    {relativeTime(entry.ts)}
                  </td>
                  <td>{entry.userName ?? <span className="settings__muted">anonymous</span>}</td>
                  <td>{entry.stationName ?? <span className="settings__muted">—</span>}</td>
                  <td className="audittrail__action">
                    {entry.action}
                    {(entry.roomId || entry.resourceId) && (
                      <span className="settings__muted"> · {entry.roomId ?? `${entry.resourceType}:${entry.resourceId}`}</span>
                    )}
                  </td>
                  <td>
                    <span className={`audittrail__result audittrail__result--${entry.result === 'allowed' ? 'ok' : 'denied'}`}>
                      {entry.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Campuses: institution name, sites, rooms, Quick Access tiles ──────────────
// Edits a local draft of the whole tree; Save replaces it transactionally on
// the server (PUT /api/config). Nothing is destructive until Save.

const TILE_TYPE_LABELS: Record<Tile['type'], string> = {
  route: 'Room Status link',
  companion: 'Bitfocus Companion',
  screenshare: 'Screen Sharing (Mac)',
  link: 'Web link',
  placeholder: 'Placeholder',
};

const TILE_ICONS: Array<[string, string]> = [
  ['🎛️', 'Console'],
  ['🎚️', 'Faders'],
  ['💡', 'Lighting'],
  ['🎬', 'Video'],
  ['🎥', 'Camera'],
  ['📷', 'PTZ camera'],
  ['📖', 'ProPresenter'],
  ['⏺️', 'Recorder'],
  ['⏱️', 'Timecode'],
  ['🎧', 'Comms'],
  ['🔊', 'Audio'],
  ['🖥️', 'Computer'],
  ['🌐', 'Network device'],
];

// Shared draft plumbing: both the overview and the room page edit a local
// copy of the whole tree and save it transactionally (PUT /api/config).
function useChurchDraft() {
  const [draft, setDraft] = useState<Church | null>(null);
  const [baseline, setBaseline] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    getConfig().then((c) => {
      setDraft(c);
      setBaseline(JSON.stringify(c));
    }).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const update = (fn: (next: Church) => void) => {
    setMsg('');
    setDraft((cur) => {
      const next = structuredClone(cur!);
      fn(next);
      return next;
    });
  };

  const save = async () => {
    setErr('');
    try {
      const stored = await saveConfig(draft!);
      setDraft(stored);
      setBaseline(JSON.stringify(stored));
      setMsg('Saved.');
      window.dispatchEvent(new Event('prodmesh:config-changed'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return {
    draft,
    baseline,
    dirty: draft != null && JSON.stringify(draft) !== baseline,
    msg,
    err,
    update,
    save,
  };
}

const moveIn = <T,>(arr: T[], from: number, dir: -1 | 1) => {
  const to = from + dir;
  if (to < 0 || to >= arr.length) return;
  [arr[from], arr[to]] = [arr[to], arr[from]];
};

// The overview: institution name, sites, and each site's rooms as rows that
// link into their own configuration page.
// Institution identity — name and logo. These are the two things every
// installing church changes first, so they get a section of their own in
// General rather than living inside the topology editor.
function BrandingPanel() {
  const [church, setChurch] = useState<Church | null>(null);
  const [name, setName] = useState('');
  const [stamp, setStamp] = useState(() => Date.now());
  const [hasLogo, setHasLogo] = useState(true); // assume; the 404 corrects us
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Feedback>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getConfig().then((c) => { setChurch(c); setName(c.name); }).catch(() => {});
  }, []);

  const announce = () => {
    setStamp(Date.now());
    window.dispatchEvent(new Event('prodmesh:config-changed'));
  };

  const saveName = async () => {
    if (!church) return;
    setBusy(true);
    setMsg(null);
    try {
      // Re-read before writing: this endpoint takes the whole tree, and the
      // Campuses editor may have changed rooms since we loaded.
      const latest = await getConfig();
      const saved = await saveConfig({ ...latest, name: name.trim() });
      setChurch(saved);
      announce();
      setMsg(ok('Name updated.'));
    } catch (err) {
      setMsg(fail(err));
    } finally {
      setBusy(false);
    }
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      await uploadLogo(file);
      setHasLogo(true);
      announce();
      setMsg(ok('Logo updated.'));
    } catch (err) {
      setMsg(fail(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resetLogo = async () => {
    setBusy(true);
    try {
      await clearLogo();
      setHasLogo(false);
      announce();
      setMsg(ok('Reverted to the default logo.'));
    } catch (err) {
      setMsg(fail(err));
    } finally {
      setBusy(false);
    }
  };

  if (!church) return null;
  const dirty = name.trim() !== church.name && name.trim().length > 0;

  return (
    <section className="panel">
      <p className="section-label">Identity</p>
      <h2 className="panel__title">
        Branding
        <HelpTip text="Shown on every screen — the sidebar mark and the name above it." />
      </h2>

      <div className="branding">
        <div className="branding__logo">
          {/* Two previews: the logo at the size it actually renders in the
              sidebar, and larger. A mark that reads fine big can turn to mush
              at 32px, which is the size that matters. */}
          <div className="branding__previews">
            <img
              className="branding__big"
              src={logoSrc(stamp)}
              alt=""
              onError={(e) => { e.currentTarget.src = logoUrl; setHasLogo(false); }}
            />
            <div className="branding__actual">
              <img src={logoSrc(stamp)} alt="" onError={(e) => { e.currentTarget.src = logoUrl; }} />
              <span>actual size</span>
            </div>
          </div>
          <div className="branding__logoactions">
            <button className="btn btn--sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              Upload logo
            </button>
            {hasLogo && (
              <button className="btn btn--ghost btn--sm" disabled={busy} onClick={resetLogo}>
                Use default
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
            <p className="branding__hint">
              PNG, JPEG, GIF or WebP · under 256 KB. The sidebar is dark, so a
              light or full-colour mark reads best.
            </p>
          </div>
        </div>

        <div className="branding__name">
          <label className="lfield">
            <span>Institution name</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirty) saveName(); }}
            />
          </label>
          <button className="btn btn--primary btn--sm" disabled={!dirty || busy} onClick={saveName}>
            {dirty ? 'Save name' : 'Saved'}
          </button>
        </div>
      </div>

      {msg && <p className={`settings__msg settings__msg--${msg.kind}`}>{msg.text}</p>}
    </section>
  );
}

export function CampusesPanel() {
  const { draft, baseline, dirty, msg, err, update, save } = useChurchDraft();
  const [selectedSite, setSelectedSite] = useState('');

  if (!draft) return err ? <p className="settings__error">{err}</p> : <p className="settings__muted">Loading…</p>;

  const site = draft.sites.find((s) => s.id === selectedSite) ?? draft.sites[0];
  // Rooms that exist on the server (vs. added to this unsaved draft) — a new
  // room's page can only load after the draft is saved.
  const savedRoomIds = new Set(
    (JSON.parse(baseline || '{"sites":[]}') as Church).sites.flatMap((s) => s.auditoriums).map((r) => r.id),
  );

  return (
    <section className="panel campuses">
      <div className="campuses__head">
        <div>
          <p className="section-label">Topology</p>
          <h2 className="panel__title">Campuses
            <HelpTip text="Changes apply everywhere when you save — nothing is final until then." />
          </h2>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={!dirty}>
          {dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>



      <div className="campuses__sitebar">
        {draft.sites.map((s) => (
          <button key={s.id}
            className={`typebtn${s.id === site?.id ? ' typebtn--on' : ''}`}
            onClick={() => setSelectedSite(s.id)}>
            {s.name || s.id}
            {s.status !== 'active' && <span className="typebtn__uses">off</span>}
          </button>
        ))}
        <button className="btn" onClick={() => update((n) => {
          const id = slugId('new-site', allIds(n));
          n.sites.push({ id, name: 'New Site', status: 'disabled', auditoriums: [] });
          setSelectedSite(id);
        })}>+ Add site</button>
      </div>

      {site && (
        <div className="campuses__site" key={site.id}>
          <div className="campuses__siterow">
            <label className="lfield"><span>Site name</span>
              <input className="field" value={site.name}
                onChange={(e) => update((n) => { n.sites.find((s) => s.id === site.id)!.name = e.target.value; })} />
            </label>
            <label className="lfield"><span>Status</span>
              <SelectField value={site.status}
                onChange={(e) => update((n) => { n.sites.find((s) => s.id === site.id)!.status = e.target.value as Site['status']; })}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </SelectField>
            </label>
            <div className="campuses__rowactions">
              <button className="iconbtn" title="Move site left" aria-label="Move site left"
                onClick={() => update((n) => moveIn(n.sites, n.sites.findIndex((s) => s.id === site.id), -1))}><ArrowUp size={14} /></button>
              <button className="iconbtn" title="Move site right" aria-label="Move site right"
                onClick={() => update((n) => moveIn(n.sites, n.sites.findIndex((s) => s.id === site.id), 1))}><ArrowDown size={14} /></button>
              <button className="iconbtn iconbtn--danger" title="Remove site" aria-label="Remove site"
                onClick={() => update((n) => {
                  n.sites = n.sites.filter((s) => s.id !== site.id);
                  setSelectedSite(n.sites[0]?.id ?? '');
                })}><Trash2 size={14} /></button>
            </div>
          </div>

          <div className="campuses__roomlist">
            {site.auditoriums.length === 0 && <p className="settings__muted">No rooms yet.</p>}
            {site.auditoriums.map((room, roomIdx) => (
              <div className="campuses__roomrow" key={room.id}>
                <div className="campuses__roominfo">
                  <strong>{room.name}</strong>
                  <small>{room.tiles.length} tile{room.tiles.length === 1 ? '' : 's'}</small>
                </div>
                {savedRoomIds.has(room.id)
                  ? <Link className="btn" to={`/admin/campuses/${room.id}`}>Configure</Link>
                  : <span className="settings__muted campuses__unsaved">save to configure</span>}
                <div className="campuses__rowactions">
                  <button className="iconbtn" title="Move room up" aria-label="Move room up"
                    onClick={() => update((n) => moveIn(n.sites.find((s) => s.id === site.id)!.auditoriums, roomIdx, -1))}><ArrowUp size={14} /></button>
                  <button className="iconbtn" title="Move room down" aria-label="Move room down"
                    onClick={() => update((n) => moveIn(n.sites.find((s) => s.id === site.id)!.auditoriums, roomIdx, 1))}><ArrowDown size={14} /></button>
                  <button className="iconbtn iconbtn--danger" title="Remove room" aria-label="Remove room"
                    onClick={() => update((n) => {
                      const s = n.sites.find((x) => x.id === site.id)!;
                      s.auditoriums = s.auditoriums.filter((r) => r.id !== room.id);
                    })}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <button className="btn" onClick={() => update((n) => {
            const id = slugId(`${site.id}-room`, allIds(n));
            n.sites.find((s) => s.id === site.id)!.auditoriums.push({ id, name: 'New Room', tiles: [] });
          })}>+ Add room</button>
        </div>
      )}

      {err && <p className="settings__error">{err}</p>}
      {msg && <p className="settings__ok">{msg}</p>}
    </section>
  );
}

// One room's configuration page (/admin/campuses/:roomId): identity, Quick
// Access tiles, and (soon) integration connectivity as rooms.config.js
// migrates into the database.
export function RoomConfigPanel() {
  const { roomId } = useParams();
  const { draft, dirty, msg, err, update, save } = useChurchDraft();

  if (!draft) return err ? <p className="settings__error">{err}</p> : <p className="settings__muted">Loading…</p>;

  const owner = draft.sites.find((s) => s.auditoriums.some((r) => r.id === roomId));
  const room = owner?.auditoriums.find((r) => r.id === roomId);

  if (!owner || !room) {
    return (
      <section className="panel">
        <p className="settings__error">No room "{roomId}" exists.</p>
        <Link className="btn" to="/admin/campuses">← All campuses</Link>
      </section>
    );
  }

  // Locate this room inside a draft copy, wherever it currently lives.
  const findRoom = (n: Church) => {
    const s = n.sites.find((x) => x.auditoriums.some((r) => r.id === roomId))!;
    return { site: s, room: s.auditoriums.find((r) => r.id === roomId)! };
  };

  return (
    <>
      <section className="panel campuses">
        <div className="campuses__head">
          <div>
            <p className="section-label"><Link className="campuses__back" to="/admin/campuses">← All campuses</Link></p>
            <h2 className="panel__title">{room.name}</h2>
          </div>
          <button className="btn btn--primary" onClick={save} disabled={!dirty}>
            {dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>

        <div className="campuses__siterow">
          <label className="lfield"><span>Room name</span>
            <input className="field" value={room.name}
              onChange={(e) => update((n) => { findRoom(n).room.name = e.target.value; })} />
          </label>
          <label className="lfield"><span>Site</span>
            <SelectField value={owner.id}
              onChange={(e) => update((n) => {
                const from = findRoom(n);
                const dest = n.sites.find((x) => x.id === e.target.value)!;
                from.site.auditoriums = from.site.auditoriums.filter((r) => r.id !== roomId);
                dest.auditoriums.push(from.room);
              })}>
              {draft.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectField>
          </label>
          <label className="lfield"><span>Room ID</span>
            <input className="field" value={room.id} disabled
              title="Stable identifier — links this room to its server integrations" />
          </label>
        </div>

        {err && <p className="settings__error">{err}</p>}
        {msg && <p className="settings__ok">{msg}</p>}
      </section>

      <section className="panel campuses">
        <div>
          <p className="section-label">Launcher</p>
          <h2 className="panel__title">Quick Access tiles
            <HelpTip text="The shortcuts this room shows on Home." />
          </h2>
        </div>

        <div className="campuses__room">
          {room.tiles.map((tile, tileIdx) => (
            <TileEditor key={tile.id} tile={tile}
              onChange={(patch) => update((n) => { findRoom(n).room.tiles[tileIdx] = patch; })}
              onMove={(dir) => update((n) => moveIn(findRoom(n).room.tiles, tileIdx, dir))}
              onRemove={() => update((n) => {
                const r = findRoom(n).room;
                r.tiles = r.tiles.filter((t) => t.id !== tile.id);
              })}
            />
          ))}
          <button className="btn campuses__addtile" onClick={() => update((n) => {
            const id = slugId(`${roomId}-tile`, allIds(n));
            findRoom(n).room.tiles.push({ id, type: 'link', label: 'New tile', url: 'http://' });
          })}>+ Add tile</button>
        </div>
      </section>

      <ConnectivityPanel roomId={roomId!} />
    </>
  );
}

function TileEditor({ tile, onChange, onMove, onRemove }: {
  tile: Tile;
  onChange: (tile: Tile) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const set = (field: string, value: string) => {
    const next = { ...tile } as Record<string, unknown>;
    if (value === '') delete next[field];
    else next[field] = value;
    onChange(next as unknown as Tile);
  };

  const retype = (type: Tile['type']) => {
    const base = { id: tile.id, label: tile.label, note: tile.note, icon: tile.icon };
    if (type === 'companion') onChange({ ...base, type, host: '' });
    else if (type === 'screenshare') onChange({ ...base, type, host: '' });
    else if (type === 'link') onChange({ ...base, type, url: 'http://' });
    else if (type === 'route') onChange({ ...base, type, to: '/' });
    else onChange({ ...base, type });
  };

  const t = tile as unknown as Record<string, string | undefined>;

  return (
    <div className="campuses__tile">
      <label className="lfield"><span>Type</span>
        <SelectField value={tile.type} onChange={(e) => retype(e.target.value as Tile['type'])}>
          {Object.entries(TILE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>
      </label>
      <label className="lfield campuses__tileicon"><span>Icon</span>
        <SelectField value={tile.icon ?? ''} onChange={(e) => set('icon', e.target.value)}>
          <option value="">Default</option>
          {TILE_ICONS.map(([emoji, name]) => <option key={emoji} value={emoji}>{emoji} {name}</option>)}
        </SelectField>
      </label>
      <label className="lfield"><span>Label</span>
        <input className="field" value={tile.label}
          onChange={(e) => onChange({ ...tile, label: e.target.value })} />
      </label>
      <label className="lfield campuses__grow"><span>Note</span>
        <input className="field" placeholder="Optional" value={tile.note ?? ''}
          onChange={(e) => set('note', e.target.value)} />
      </label>

      {(tile.type === 'companion' || tile.type === 'screenshare') && (
        <label className="lfield"><span>Host</span>
          <input className="field" placeholder="IP or hostname" value={t.host ?? ''}
            onChange={(e) => set('host', e.target.value)} />
        </label>
      )}
      {tile.type === 'companion' && (
        <label className="lfield campuses__tileport"><span>Port</span>
          <input className="field" placeholder="8000" value={t.port ?? ''}
            onChange={(e) => set('port', e.target.value)} />
        </label>
      )}
      {tile.type === 'screenshare' && (
        <label className="lfield"><span>Mac username</span>
          <input className="field" placeholder="Optional" value={t.username ?? ''}
            onChange={(e) => set('username', e.target.value)} />
        </label>
      )}
      {tile.type === 'link' && (
        <label className="lfield campuses__grow"><span>URL</span>
          <input className="field" placeholder="http://…" value={t.url ?? ''}
            onChange={(e) => set('url', e.target.value)} />
        </label>
      )}
      {tile.type === 'route' && (
        <label className="lfield campuses__grow"><span>Route</span>
          <input className="field" placeholder="/room/…" value={t.to ?? ''}
            onChange={(e) => set('to', e.target.value)} />
        </label>
      )}

      <div className="campuses__rowactions">
        <button className="iconbtn" title="Move tile up" aria-label="Move tile up" onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
        <button className="iconbtn" title="Move tile down" aria-label="Move tile down" onClick={() => onMove(1)}><ArrowDown size={14} /></button>
        <button className="iconbtn iconbtn--danger" title="Remove tile" aria-label="Remove tile" onClick={onRemove}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

// Connectivity: per-room integration config served from SQLite. First
// migrated integration: Planning Center service types. The rest still live in
// server/rooms.config.js and move here one at a time.
function ConnectivityPanel({ roomId }: { roomId: string }) {
  const [conn, setConn] = useState<RoomConnectivity | null>(null);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState<RoomConnectivityStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const enabledIntegrations = useQuery('enabled-integrations', getEnabledIntegrations, { staleMs: 60_000 }).data?.enabled;

  useEffect(() => {
    getRoomConnectivity(roomId)
      .then(setConn)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [roomId]);

  // One probe on load, then on demand via each chip's refresh button — the
  // devices are on the local network, no need to poll.
  const check = useCallback(() => {
    setChecking(true);
    getRoomConnectivityStatus(roomId)
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setChecking(false));
  }, [roomId]);

  const hasServerRoom = conn?.hasServerRoom;
  useEffect(() => {
    if (hasServerRoom) check();
  }, [hasServerRoom, check]);

  const chip = (s: IntegrationStatus | null | undefined) => (
    <StatusChip status={s} checking={checking} onRefresh={check} />
  );
  const enabled = (id: IntegrationId) => enabledIntegrations?.[id] !== false;
  const analysisEnabled = enabled('prodmesh-rta') || enabled('smaart') || enabled('open-sound-meter');

  return (
    <section className="panel campuses">
      <div>
        <p className="section-label">Connectivity</p>
        <h2 className="panel__title">Integrations</h2>
      </div>

      {err && <p className="settings__error">{err}</p>}
      {!conn && !err && <p className="settings__muted">Loading…</p>}

      {conn && !conn.hasServerRoom && (
        <p className="settings__muted">
          The server doesn't know a room <code>{roomId}</code> — save the campus
          configuration above, then reload this page.
        </p>
      )}

      {conn?.hasServerRoom && (
        <>
          {enabled('companion') && <CompanionEditor roomId={roomId} initial={conn.companion} status={chip(status?.companion)} />}
          {enabled('planning-center') && <PcServiceTypesEditor roomId={roomId} initial={conn.planningCenter?.serviceTypes ?? []} status={chip(status?.planningCenter)} />}
          {analysisEnabled && <AnalysisEditor roomId={roomId} initial={conn.analysis} status={chip(status?.analysis)} />}
          {enabled('youtube') && <YouTubeEditor roomId={roomId} initial={conn.youtube} />}
          {enabled('captions') && <CaptionsEditor roomId={roomId} initial={conn.captions} />}
          {enabled('propresenter') && <ProPresenterEditor roomId={roomId} initial={conn.proPresenter} status={chip(status?.proPresenter)} />}
        </>
      )}
    </section>
  );
}

// The live dot next to an integration's title: green = the probe's real
// request succeeded, red = it failed (the reason inline), gray = simulated or
// not probed. The refresh button re-probes the room on demand.
function StatusChip({ status, checking, onRefresh }: {
  status: IntegrationStatus | null | undefined;
  checking: boolean;
  onRefresh: () => void;
}) {
  if (!status) return null; // not configured — nothing to report
  const kind = status.mock ? 'sim' : status.ok === true ? 'ok' : status.ok === false ? 'down' : 'unknown';
  const label = status.mock ? 'Simulated' : status.ok === true ? 'Connected' : status.ok === false ? 'Unreachable' : 'Not checked';
  return (
    <span className={`connstatus connstatus--${kind}`} title={status.detail ?? undefined}>
      <span className="connstatus__dot" aria-hidden />
      {label}
      {status.detail && !status.mock && <span className="connstatus__detail">{status.detail}</span>}
      {!status.mock && (
        <button
          className="iconbtn connstatus__refresh"
          title="Check now"
          aria-label="Check integration status now"
          onClick={onRefresh}
          disabled={checking}
        >
          <RefreshCw size={12} className={checking ? 'connstatus__spin' : undefined} />
        </button>
      )}
    </span>
  );
}

function PcServiceTypesEditor({ roomId, initial, status }: { roomId: string; initial: PcServiceType[]; status?: ReactNode }) {
  const f = useDraft<PcServiceType[]>(initial, async (types) =>
    (await savePcServiceTypes(roomId, types)).serviceTypes);
  const editType = (i: number, patch: Partial<PcServiceType>) =>
    f.setDraft((all) => all.map((x, j) => j === i ? { ...x, ...patch } : x));

  return (
    <EditorSection
      title={<IntegrationTitle integration="planning-center">Planning Center service types</IntegrationTitle>}
      status={status}
      help="The event types this room hosts. The ID is in the Planning Center Services URL for that service type."
      saveLabel="Save service types"
      form={f}
    >
      {f.draft.length === 0 && <p className="settings__muted">None — this room shows no Planning Center events.</p>}
      {f.draft.map((st, i) => (
        <FormRow key={i}>
          <Field label="Name" width="grow">
            <input className="field" placeholder="e.g. Sunday" value={st.name}
              onChange={(e) => editType(i, { name: e.target.value })} />
          </Field>
          <Field label="Service type ID">
            <input className="field" placeholder="e.g. 500001" inputMode="numeric" value={st.id}
              onChange={(e) => editType(i, { id: e.target.value })} />
          </Field>
          <div className="formrow__actions">
            <button className="iconbtn iconbtn--danger" title="Remove service type" aria-label="Remove service type"
              onClick={() => f.setDraft((all) => all.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        </FormRow>
      ))}
      <button className="btn" onClick={() => f.setDraft((all) => [...all, { id: '', name: '' }])}>
        + Add service type
      </button>
    </EditorSection>
  );
}

// Where the room's service is streamed. A channel id is the normal case: the
// video id changes every week, and the server finds whatever is live on the
// channel. A fixed video id is the escape hatch for a one-off broadcast.
interface YouTubeDraft {
  channelId: string;
}

const toYtDraft = (cfg: YouTubeConfig | null): YouTubeDraft => ({
  channelId: cfg?.channelId ?? '',
});

// Draft state as strings so the inputs stay controlled; the server normalises.
interface CaptionsDraft {
  source: 'none' | 'prodmesh-caption' | 'prodcom';
  host: string;
  port: string;
  key: string;
  hasKey: boolean;
  channels: string;
}

const toCapDraft = (c: CaptionsConfig | null): CaptionsDraft => ({
  source: c?.source ?? 'none',
  host: c?.host ?? '',
  port: c?.port != null ? String(c.port) : '',
  key: '',
  hasKey: Boolean(c?.hasKey),
  channels: (c?.channels ?? []).join(', '),
});

const CAPTION_PORTS: Record<string, string> = { 'prodmesh-caption': '8518', prodcom: '24480' };

function CaptionsEditor({ roomId, initial }: { roomId: string; initial: CaptionsConfig | null }) {
  const f = useDraft(toCapDraft(initial), async (d) => {
    if (d.source === 'none') return toCapDraft(await saveCaptions(roomId, null));
    const channels = d.channels.split(',').map((c) => c.trim()).filter(Boolean);
    const stored = await saveCaptions(roomId, {
      source: d.source,
      host: d.host.trim(),
      ...(d.port.trim() ? { port: Number(d.port) } : {}),
      // Omitted entirely when left blank, which the server reads as "keep the
      // stored one" — this form is never sent the existing key.
      ...(d.key ? { key: d.key } : {}),
      ...(channels.length ? { channels } : {}),
    });
    return toCapDraft(stored);
  });
  const { draft } = f;

  return (
    <EditorSection
      title="Captions"
      help="Live transcript of the production comms channels, so the band can read what the music director and monitor engineer are saying. Shown by the Comms widget on a dashboard or display; nothing else surfaces it. prodmesh reads only — it never renames a channel or clears a transcript."
      saveLabel="Save captions"
      form={f}
    >
      <FormRow>
        {/* "Caption app" rather than "Source": the analysis editor on this same
            page already has a Source, and two of them is ambiguous to a reader
            long before it is ambiguous to a test. */}
        <Field label="Caption app">
          <SelectField
            value={draft.source}
            onChange={(e) => {
              const source = e.target.value as CaptionsDraft['source'];
              // Swap the default port with the source, unless the port has been
              // typed over — a wrong default is worse than an empty box.
              const known = Object.values(CAPTION_PORTS);
              const port = !draft.port || known.includes(draft.port) ? (CAPTION_PORTS[source] ?? '') : draft.port;
              f.patch({ source, port });
            }}
          >
            <option value="none">None</option>
            <option value="prodmesh-caption">ProdMesh Caption</option>
            <option value="prodcom">ProdCom</option>
          </SelectField>
        </Field>
        {draft.source !== 'none' && (
          <>
            <Field label="Host" width="grow">
              <input className="field" placeholder="e.g. 192.168.1.150"
                value={draft.host} onChange={(e) => f.patch({ host: e.target.value })} />
            </Field>
            <Field label="Port">
              <input className="field" inputMode="numeric" placeholder={CAPTION_PORTS[draft.source] ?? ''}
                value={draft.port} onChange={(e) => f.patch({ port: e.target.value })} />
            </Field>
          </>
        )}
      </FormRow>

      {draft.source !== 'none' && (
        <FormRow>
          <Field label="Channels" width="grow">
            <input className="field" placeholder="blank for all — e.g. 0, 6"
              value={draft.channels} onChange={(e) => f.patch({ channels: e.target.value })} />
          </Field>
          {draft.source === 'prodcom' && (
            <Field label={draft.hasKey ? 'API key (set)' : 'API key'}>
              <PasswordInput className="field" autoComplete="new-password"
                placeholder={draft.hasKey ? 'unchanged' : 'only if PSK is enabled'}
                value={draft.key} onChange={(e) => f.patch({ key: e.target.value })} />
            </Field>
          )}
        </FormRow>
      )}

      {draft.source !== 'none' && (
        <p className="settings__muted">
          Channels are the speakers to show — a channel number for ProdMesh
          Caption, a channel name or ID for ProdCom. Leave blank for all of them.
        </p>
      )}
    </EditorSection>
  );
}

function YouTubeEditor({ roomId, initial }: { roomId: string; initial: YouTubeConfig | null }) {
  const f = useDraft(toYtDraft(initial), async (d) => {
    const stored = await saveYouTube(
      roomId,
      d.channelId.trim() ? { channelId: d.channelId.trim() } : null,
    );
    return toYtDraft(stored);
  });
  const { draft } = f;

  return (
    <EditorSection
      title={<IntegrationTitle integration="youtube">YouTube Live</IntegrationTitle>}
      help="Records how many people watched the stream, for the show report. Needs a YouTube API key under Admin → General → Integrations. Viewer counts are only available while a broadcast is live — YouTube does not report them afterwards, so nothing is recorded for services that ran before this was set up. Find the channel ID in YouTube Studio → Settings → Channel → Advanced."
      saveLabel="Save YouTube"
      form={f}
    >
      <FormRow>
        <Field label="Channel ID" width="grow">
          <input
            className="field"
            placeholder="e.g. UCxxxxxxxxxxxxxxxxxxxxxx"
            value={draft.channelId}
            onChange={(e) => f.patch({ channelId: e.target.value })}
          />
        </Field>
      </FormRow>
      <p className="settings__muted">
        Blank if this room isn’t streamed. Each service records whatever is live
        on the channel at the time — pick a specific broadcast on an event’s page
        only when that needs overriding.
      </p>
    </EditorSection>
  );
}

// Draft form state for the analysis source — everything as strings so the
// inputs stay controlled; the server normalizes numbers on save.
interface AnalysisDraft {
  source: 'none' | 'smaart' | 'rta' | 'open-sound-meter';
  host: string;
  port: string;
  password: string;
  logControl: boolean;
  // Not edited here — dB goals moved onto the widgets. They still ride through
  // the draft because this form PUTs a whole analysis object: omitting them
  // deleted the room's stored thresholds every time somebody saved a host.
  goals: { target?: number; limit?: number; metric?: string };
}

function toDraft(cfg: AnalysisConfig | null): AnalysisDraft {
  return {
    source: cfg ? cfg.source : 'none',
    host: cfg?.host ?? '',
    port: cfg?.port != null ? String(cfg.port) : '',
    password: '',
    logControl: Boolean(cfg?.logControl),
    goals: {
      ...(cfg?.target != null ? { target: cfg.target } : {}),
      ...(cfg?.limit != null ? { limit: cfg.limit } : {}),
      ...(cfg?.metric ? { metric: cfg.metric } : {}),
    },
  };
}

function analysisFromDraft(d: AnalysisDraft): AnalysisConfig | null {
  if (d.source === 'none') return null;
  return {
    source: d.source,
    host: d.host || undefined,
    port: d.port === '' ? undefined : Number(d.port),
    logControl: d.source === 'smaart' && d.logControl ? true : undefined,
    ...d.goals,
    ...(d.password ? { password: d.password } : {}),
  };
}

function AnalysisEditor({ roomId, initial, status }: { roomId: string; initial: AnalysisConfig | null; status?: ReactNode }) {
  const [hasPassword, setHasPassword] = useState(Boolean(initial?.hasPassword));
  const [testState, setTestState] = useState<{ busy: boolean; ok?: boolean; detail?: string }>({ busy: false });
  const f = useDraft(toDraft(initial), async (d) => {
    const stored = await saveAnalysis(
      roomId,
      analysisFromDraft(d),
    );
    setHasPassword(Boolean(stored?.hasPassword));
    return toDraft(stored);
  });
  const { draft } = f;
  const runTest = async () => {
    const analysis = analysisFromDraft(draft);
    if (!analysis) return;
    setTestState({ busy: true });
    try {
      setTestState({ busy: false, ...(await testAnalysisConnection(roomId, analysis)) });
    } catch (err) {
      setTestState({ busy: false, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  };

  if (initial?.mock) {
    return (
      <div className="fsection">
        <h3 className="fsection__title">Analysis source
          <HelpTip text="Where this room's SPL numbers come from." />
          {status}
        </h3>
        <p className="settings__muted">Simulated meter (dev room).</p>
      </div>
    );
  }

  return (
    <EditorSection
      title="Analysis source"
      status={status}
      help="Where this room's SPL numbers come from — a Smaart rig, ProdMesh Remote RTA, or Open Sound Meter. Target and limit set the dB goals on the live meter and show reports."
      saveLabel="Save analysis source"
      form={f}
    >
      <FormRow>
        <Field label="Source">
          <SelectField value={draft.source}
            onChange={(e) => f.patch({ source: e.target.value as AnalysisDraft['source'] })}>
            <option value="none">None</option>
            <option value="smaart">Smaart</option>
            <option value="rta">ProdMesh Remote RTA</option>
            <option value="open-sound-meter">Open Sound Meter</option>
          </SelectField>
        </Field>
        {draft.source !== 'none' && (
          <>
            {draft.source !== 'open-sound-meter' && <Field label="Host" width="grow">
              <input className="field" placeholder="e.g. 192.168.1.120" value={draft.host}
                onChange={(e) => f.patch({ host: e.target.value })} />
            </Field>}
            {draft.source !== 'open-sound-meter' && <Field label="Port" width="sm">
              <input className="field" inputMode="numeric"
                placeholder={draft.source === 'smaart' ? '26000' : '8517'} value={draft.port}
                onChange={(e) => f.patch({ port: e.target.value })} />
            </Field>}
          </>
        )}
      </FormRow>

      {draft.source === 'smaart' && (
        <FormRow>
            <Field label="API password">
              <PasswordInput className="field" autoComplete="off"
                placeholder={hasPassword ? 'unchanged' : 'none'} value={draft.password}
                onChange={(e) => f.patch({ password: e.target.value })} />
            </Field>
        </FormRow>
      )}

      {draft.source === 'smaart' && (
        <FormRow>
          <Checkbox
            label={<>Start/stop SPL logging with shows
              <HelpTip text="Show start turns Smaart's SPL logging on; show end turns it off (only if the show turned it on). Needs a calibrated input in Smaart." />
            </>}
            checked={draft.logControl}
            onChange={(e) => f.patch({ logControl: e.target.checked })}
          />
        </FormRow>
      )}
      {draft.source === 'open-sound-meter' && (
        <p className="settings__muted">
          In Open Sound Meter, enable the Wi‑Fi icon’s <strong>Remote API Server</strong>.
          ProdMesh listens for multicast level packets at 239.255.42.42:49007; both
          computers must be on the same multicast-enabled network.
        </p>
      )}
      {draft.source !== 'none' && (
        <div className="fsection__actions">
          <button type="button" className="btn btn--secondary" onClick={runTest} disabled={testState.busy || f.busy}>
            {testState.busy ? 'Testing connection…' : 'Test connection'}
          </button>
          {testState.detail && <span className={testState.ok ? 'fsection__ok' : 'fsection__error'}>{testState.detail}</span>}
        </div>
      )}
    </EditorSection>
  );
}

// Draft form state for Companion + modes — everything stringly for controlled
// inputs; the server normalizes on save. A mode's button is optional: leaving
// page/row/col empty saves a mode with no Companion button.
interface ModeDraft {
  id: string;
  label: string;
  color: string;
  match: string;
  page: string;
  row: string;
  column: string;
  isStandby: boolean;
}

interface CompanionDraft {
  mock: boolean;
  host: string;
  port: string;
  variable: string;
  modes: ModeDraft[];
}

function toModeDraft(m: ModeConfig): ModeDraft {
  return {
    id: m.id,
    label: m.label,
    color: m.color,
    match: m.match,
    page: m.press ? String(m.press.page) : '',
    row: m.press ? String(m.press.row) : '',
    column: m.press ? String(m.press.column) : '',
    isStandby: Boolean(m.isStandby),
  };
}

function toCompanionDraft(cfg: CompanionConfig | null): CompanionDraft {
  return {
    mock: cfg ? cfg.mock : true,
    host: cfg?.host ?? '',
    port: cfg?.port != null ? String(cfg.port) : '',
    variable: cfg?.variable ?? '',
    modes: (cfg?.modes ?? []).map(toModeDraft),
  };
}

function CompanionEditor({ roomId, initial, status }: { roomId: string; initial: CompanionConfig | null; status?: ReactNode }) {
  const f = useDraft(toCompanionDraft(initial), async (d) =>
    toCompanionDraft(await saveCompanion(roomId, {
      mock: d.mock,
      host: d.host || undefined,
      port: d.port === '' ? undefined : Number(d.port),
      variable: d.variable || undefined,
      modes: d.modes.map((m) => ({
        id: m.id,
        label: m.label,
        color: m.color,
        match: m.match,
        ...(m.page === '' && m.row === '' && m.column === ''
          ? {}
          : { press: { page: Number(m.page), row: Number(m.row), column: Number(m.column) } }),
        ...(m.isStandby ? { isStandby: true } : {}),
      })),
    })));
  const { draft } = f;
  const setMode = (i: number, patch: Partial<ModeDraft>) =>
    f.setDraft((d) => ({ ...d, modes: d.modes.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const moveMode = (i: number, dir: -1 | 1) =>
    f.setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.modes.length) return d;
      const modes = [...d.modes];
      [modes[i], modes[j]] = [modes[j], modes[i]];
      return { ...d, modes };
    });

  return (
    <EditorSection
      title={<IntegrationTitle integration="companion">Bitfocus Companion &amp; modes</IntegrationTitle>}
      status={status}
      help="The room's Bitfocus Companion install. Each mode presses a Bitfocus Companion button (page/row/column) and shows as active when the state variable matches its value. Every Bitfocus Companion lays its buttons out differently — set each mode's location to match this room's."
      saveLabel="Save Bitfocus Companion"
      form={f}
    >
      <FormRow>
        <Checkbox
          label={<>Simulated
            <HelpTip text="No Companion yet — room state is kept in memory so every screen still works. Untick when this room's Companion has the state variable and buttons set up." />
          </>}
          checked={draft.mock}
          onChange={(e) => f.patch({ mock: e.target.checked })}
        />
        <Field label="Host" width="grow">
          <input className="field" placeholder="e.g. 192.168.1.100" value={draft.host}
            onChange={(e) => f.patch({ host: e.target.value })} />
        </Field>
        <Field label="Port" width="sm">
          <input className="field" inputMode="numeric" placeholder="8000"
            value={draft.port} onChange={(e) => f.patch({ port: e.target.value })} />
        </Field>
        <Field label="State variable">
          <input className="field" placeholder="roomState" value={draft.variable}
            onChange={(e) => f.patch({ variable: e.target.value })} />
        </Field>
      </FormRow>

      {draft.modes.map((m, i) => (
        <FormRow card key={i}>
          <Field label="Color" width="xs">
            <ColorInput value={m.color} onChange={(e) => setMode(i, { color: e.target.value })} />
          </Field>
          <Field label="Label">
            <input className="field" value={m.label}
              onChange={(e) => setMode(i, { label: e.target.value })} />
          </Field>
          <Field label="ID">
            <input className="field" placeholder="e.g. sunday" value={m.id}
              onChange={(e) => setMode(i, { id: e.target.value })} />
          </Field>
          <Field label="Match">
            <input className="field" placeholder="e.g. SUNDAY" value={m.match}
              onChange={(e) => setMode(i, { match: e.target.value })} />
          </Field>
          <Field label="Page" width="sm">
            <input className="field" inputMode="numeric" value={m.page}
              onChange={(e) => setMode(i, { page: e.target.value })} />
          </Field>
          <Field label="Row" width="sm">
            <input className="field" inputMode="numeric" value={m.row}
              onChange={(e) => setMode(i, { row: e.target.value })} />
          </Field>
          <Field label="Col" width="sm">
            <input className="field" inputMode="numeric" value={m.column}
              onChange={(e) => setMode(i, { column: e.target.value })} />
          </Field>
          <Checkbox label="Standby" checked={m.isStandby}
            onChange={(e) => setMode(i, { isStandby: e.target.checked })} />
          <div className="formrow__actions">
            <button className="iconbtn" title="Move mode up" aria-label="Move mode up"
              onClick={() => moveMode(i, -1)}><ArrowUp size={14} /></button>
            <button className="iconbtn" title="Move mode down" aria-label="Move mode down"
              onClick={() => moveMode(i, 1)}><ArrowDown size={14} /></button>
            <button className="iconbtn iconbtn--danger" title="Remove mode" aria-label="Remove mode"
              onClick={() => f.setDraft((d) => ({ ...d, modes: d.modes.filter((_, j) => j !== i) }))}>
              <Trash2 size={14} /></button>
          </div>
        </FormRow>
      ))}

      <button className="btn" onClick={() => f.setDraft((d) => ({
        ...d,
        modes: [...d.modes, {
          id: '', label: '', color: '#5b8def', match: '',
          page: '', row: '', column: '', isStandby: false,
        }],
      }))}>+ Add mode</button>
    </EditorSection>
  );
}

// Draft form state for ProPresenter — an empty host means "not in this room"
// and saves as a clear.
interface PpDraft {
  host: string;
  port: string;
  timer: string;
}

function toPpDraft(cfg: ProPresenterConfig | null): PpDraft {
  return {
    host: cfg?.host ?? '',
    port: cfg?.port != null ? String(cfg.port) : '',
    timer: cfg?.timer ?? '',
  };
}

function ProPresenterEditor({ roomId, initial, status }: { roomId: string; initial: ProPresenterConfig | null; status?: ReactNode }) {
  // An empty host means "not in this room" and saves as a clear.
  const f = useDraft(toPpDraft(initial), async (d) =>
    toPpDraft(await saveProPresenter(
      roomId,
      d.host.trim()
        ? {
            host: d.host,
            port: d.port === '' ? undefined : Number(d.port),
            timer: d.timer || undefined,
          }
        : null,
    )));
  const { draft } = f;

  return (
    <EditorSection
      title={<IntegrationTitle integration="propresenter">ProPresenter</IntegrationTitle>}
      status={status}
      help="The room's ProPresenter API (official, 7.9+) — drives Run of Show tracking and the service countdown. Leave the host empty if the room has no ProPresenter."
      saveLabel="Save ProPresenter"
      form={f}
    >
      <FormRow>
        <Field label="Host" width="grow">
          <input className="field" placeholder="e.g. 192.168.1.110" value={draft.host}
            onChange={(e) => f.patch({ host: e.target.value })} />
        </Field>
        <Field label="Port" width="sm">
          <input className="field" inputMode="numeric" placeholder="62202"
            value={draft.port} onChange={(e) => f.patch({ port: e.target.value })} />
        </Field>
        <Field label="Countdown timer" width="grow">
          <input className="field" placeholder="First countdown timer" value={draft.timer}
            onChange={(e) => f.patch({ timer: e.target.value })} />
        </Field>
      </FormRow>
    </EditorSection>
  );
}
