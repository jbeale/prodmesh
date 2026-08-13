import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Play, Radio, Square } from 'lucide-react';
import {
  clearShowConfig,
  getPpPlaylist,
  getYouTubeBroadcasts,
  saveShowConfig,
  type PlanItem,
  type PlanTime,
  type PpPlaylist,
  type ShowConfig,
  type YouTubeBroadcast,
} from '../api';
import { Widget } from './Widget';
import { SelectField } from './SelectField';

// Pre-created broadcasts usually share a title ("Sunday Service"), so the
// scheduled time is what actually tells them apart — show it always.
function broadcastLabel(b: YouTubeBroadcast) {
  const when = b.actualStart ?? b.scheduledStart;
  const stamp = when
    ? new Date(when).toLocaleString([], {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'no date';
  return `${b.live ? '● LIVE · ' : ''}${stamp} · ${b.title}`;
}

// Sentinels for the select only — never stored. The stored form is
// key-absent / null / id, which keeps the default state out of the record.
const AUTO = '';
const NONE = '\u0000none';

const EMPTY: ShowConfig = {
  startItemId: null, endItemId: null, map: {}, videos: {},
  servicesLiveFromProPresenter: false, servicesLiveStartMode: 'item',
  servicesLiveStartItemId: null, servicesLiveStartTimeId: null,
};

// Per-event show automation (one config per event, shared by all its service
// times): which PC item autostarts the show, which one auto-completes it at
// its last slide, and manual PC→PP mapping overrides for when the orders
// drift apart.
export function ShowConfigWidget({
  roomId,
  planId,
  items,
  times,
  saved,
}: {
  roomId: string;
  planId: string;
  items: PlanItem[];
  times: PlanTime[];
  saved: ShowConfig | null;
}) {
  const [draft, setDraft] = useState<ShowConfig>(saved ?? EMPTY);
  const [persisted, setPersisted] = useState<ShowConfig | null>(saved); // what the server has
  const [pp, setPp] = useState<PpPlaylist | null | undefined>(undefined); // undefined = loading
  const [mapOpen, setMapOpen] = useState(false);
  const [ytOpen, setYtOpen] = useState(false);
  const [casts, setCasts] = useState<YouTubeBroadcast[] | null | undefined>(undefined);
  const [castErr, setCastErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getPpPlaylist(roomId, planId)
      .then((r) => setPp(r.playlist))
      .catch(() => setPp(null));
  }, [roomId, planId]);

  useEffect(() => {
    // Only when the section is opened — the listing costs ~201 YouTube quota
    // units, which is fine for a deliberate action and wasteful on every page
    // view of an event nobody is pinning.
    if (!ytOpen || casts !== undefined) return;
    getYouTubeBroadcasts(roomId)
      .then((r) => {
        setCasts(r.configured ? r.broadcasts : null);
        setCastErr(r.error ?? null);
      })
      .catch((e) => {
        setCasts([]);
        setCastErr(e instanceof Error ? e.message : String(e));
      });
  }, [ytOpen, casts, roomId]);

  const trackable = items.filter((i) => (i.type ?? 'item') !== 'header');
  const serviceTimes = times.filter((t) => t.type === 'service');
  // Both "pinned" and "not streamed" are decisions worth surfacing on the
  // collapsed header — an unexpected "not streamed" is exactly the thing
  // someone needs to notice before Sunday.
  const setCount = Object.keys(draft.videos ?? {}).length;
  const ppItems = (pp?.items ?? []).filter((i) => i.type !== 'header');
  const overrideCount = Object.values(draft.map).filter(Boolean).length;

  const save = async () => {
    setMsg(null);
    try {
      const next = await saveShowConfig(roomId, planId, draft);
      setDraft(next);
      setPersisted(next);
      setMsg('Saved — automation is armed for this event.');
    } catch (err) {
      setMsg(`Couldn’t save: ${err instanceof Error ? err.message : err}`);
    }
  };

  const clear = async () => {
    await clearShowConfig(roomId, planId);
    setDraft(EMPTY);
    setPersisted(null);
    setMsg('Cleared — this event starts and ends manually.');
  };

  const itemSelect = (
    value: string | null,
    onChange: (v: string | null) => void,
    placeholder: string,
  ) => (
    <SelectField
      className="showcfg__select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {trackable.map((i) => (
        <option key={i.id} value={i.id}>
          {i.title}
        </option>
      ))}
    </SelectField>
  );

  return (
    <Widget
      title="Show Automation"
      meta={
        persisted?.startItemId || persisted?.endItemId || persisted?.servicesLiveFromProPresenter ? (
          <span className="svc__badge svc__badge--live">● armed</span>
        ) : (
          <span className="svc__badge svc__badge--mock">○ manual</span>
        )
      }
    >
      <label className="showcfg__row">
        <span className="showcfg__label"><Radio size={13} /> ProPresenter controls Services LIVE</span>
        <input type="checkbox" checked={Boolean(draft.servicesLiveFromProPresenter)} onChange={(e) => setDraft((d) => ({ ...d, servicesLiveFromProPresenter: e.target.checked }))} />
      </label>
      {draft.servicesLiveFromProPresenter && (
        <>
          <p className="widget__hint">ProdMesh takes Planning Center Services LIVE control and advances it as ProPresenter changes presentations. It never moves Services LIVE backward automatically, and does not require Run of Show to be started.</p>
          <div className="showcfg__row">
            <span className="showcfg__label"><Radio size={12} /> Start Services LIVE</span>
            <SelectField
              className="showcfg__select"
              value={draft.servicesLiveStartMode ?? 'item'}
              onChange={(e) => setDraft((d) => ({ ...d, servicesLiveStartMode: e.target.value as 'item' | 'service-time' }))}
            >
              <option value="item">When PP lands on an item</option>
              <option value="service-time">At a service time</option>
            </SelectField>
          </div>
          {(draft.servicesLiveStartMode ?? 'item') === 'item' ? (
            <div className="showcfg__row">
              <span className="showcfg__label"><Play size={12} /> Services LIVE trigger</span>
              {itemSelect(
                draft.servicesLiveStartItemId ?? draft.startItemId,
                (v) => setDraft((d) => ({ ...d, servicesLiveStartItemId: v })),
                'Choose a ProPresenter-mapped item',
              )}
            </div>
          ) : (
            <div className="showcfg__row">
              <span className="showcfg__label"><Radio size={12} /> Service time</span>
              <SelectField
                className="showcfg__select"
                value={draft.servicesLiveStartTimeId ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, servicesLiveStartTimeId: e.target.value || null }))}
              >
                <option value="">Choose a service time</option>
                {serviceTimes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.startsAt ? ` — ${new Date(t.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</option>
                ))}
              </SelectField>
            </div>
          )}
        </>
      )}

      <div className="showcfg__row">
        <span className="showcfg__label">
          <Square size={12} /> Complete at last slide of
        </span>
        {itemSelect(draft.endItemId, (v) => setDraft((d) => ({ ...d, endItemId: v })), 'Never (end manually)')}
      </div>

      {serviceTimes.length > 0 && (
        <>
          <button className="showcfg__maptoggle" onClick={() => setYtOpen((o) => !o)}>
            {ytOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            YouTube broadcast
            {setCount > 0 && (
              <span className="showcfg__mapcount">{setCount} set</span>
            )}
          </button>

          {ytOpen && (
            casts === undefined ? (
              <p className="svc__muted">Loading broadcasts…</p>
            ) : casts === null ? (
              <p className="svc__muted">
                This room has no YouTube channel set — add one on the room’s configuration page.
              </p>
            ) : (
              <div className="showcfg__map">
                <p className="widget__hint">
                  Each service records whichever broadcast is live at the time, which is normally
                  right even when the channel pre-creates one per service. Pin a specific broadcast
                  to override that — or mark a service <em>Not streamed</em>, which stops it
                  recording a broadcast left running from an earlier service.
                </p>
                {castErr && <p className="showcfg__mismatch">Couldn’t list broadcasts: {castErr}</p>}
                {serviceTimes.map((t) => (
                  <div key={t.id} className="showcfg__row">
                    <span className="showcfg__label">
                      <Radio size={12} /> {t.name}
                      {t.startsAt && (
                        <span className="showcfg__when">
                          {new Date(t.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </span>
                    <SelectField
                      className="showcfg__select"
                      value={
                        !(t.id in (draft.videos ?? {}))
                          ? AUTO
                          : draft.videos[t.id] === null
                            ? NONE
                            : (draft.videos[t.id] as string)
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((d) => {
                          const videos = { ...(d.videos ?? {}) };
                          if (v === AUTO) delete videos[t.id];
                          else if (v === NONE) videos[t.id] = null;
                          else videos[t.id] = v;
                          return { ...d, videos };
                        });
                      }}
                    >
                      <option value={AUTO}>Auto — whatever is live</option>
                      <option value={NONE}>Not streamed — record nothing</option>
                      {casts.map((b) => (
                        <option key={b.videoId} value={b.videoId}>
                          {broadcastLabel(b)}
                        </option>
                      ))}
                      {/* A pin whose broadcast has since left the live/scheduled
                          list must stay selectable, or saving would silently
                          drop it. */}
                      {typeof draft.videos?.[t.id] === 'string'
                        && !casts.some((b) => b.videoId === draft.videos[t.id]) && (
                        <option value={draft.videos[t.id] as string}>
                          {draft.videos[t.id]} (not listed)
                        </option>
                      )}
                    </SelectField>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      <button className="showcfg__maptoggle" onClick={() => setMapOpen((o) => !o)}>
        {mapOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        ProPresenter mapping
        {overrideCount > 0 && <span className="showcfg__mapcount">{overrideCount} override{overrideCount > 1 ? 's' : ''}</span>}
      </button>

      {mapOpen &&
        (pp === undefined ? (
          <p className="svc__muted">Checking ProPresenter…</p>
        ) : pp === null ? (
          <p className="svc__muted">
            ProPresenter isn’t reachable (or has no playlist open). Open this service’s playlist in
            PP, then reload to map items.
          </p>
        ) : (
          <div className="showcfg__map">
            {pp.matched ? (
              <p className="widget__hint">
                Mapping against this event’s playlist (“{pp.playlistName}”). Items map
                automatically by order — override only the ones that drifted.
              </p>
            ) : (
              <p className="showcfg__mismatch">
                Couldn’t find this event’s playlist in ProPresenter — showing the open one
                (“{pp.playlistName}”), which looks like a <em>different</em> service. Push this
                plan from Planning Center first, or map with care.
              </p>
            )}
            {trackable.map((it) => {
              const mapping = draft.map[it.id];
              const mappingValue = mapping && 'disabled' in mapping
                ? NONE
                : mapping && 'ppIndex' in mapping
                  ? mapping.ppIndex
                  : '';
              return (
              <div key={it.id} className="showcfg__maprow">
                <span className="showcfg__pcitem">{it.title}</span>
                <SelectField
                  className="showcfg__select"
                  value={mappingValue}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      map: {
                        ...d.map,
                        [it.id]: e.target.value === NONE
                          ? { disabled: true }
                          : e.target.value
                          ? {
                              ppIndex: Number(e.target.value),
                              ppName: ppItems.find((p) => p.index === Number(e.target.value))?.name ?? null,
                            }
                          : null,
                      },
                    }))
                  }
                >
                  <option value="">Auto</option>
                  <option value={NONE}>None — no ProPresenter presentation</option>
                  {ppItems.map((p) => (
                    <option key={p.index} value={p.index}>
                      {p.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              );
            })}
          </div>
        ))}

      <div className="showcfg__actions">
        <button className="btn btn--primary btn--sm" onClick={save}>
          Save automation
        </button>
        {(persisted?.startItemId || persisted?.endItemId || persisted?.servicesLiveFromProPresenter || overrideCount > 0) && (
          <button className="btn btn--ghost btn--sm" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {msg && <p className="showcfg__msg">{msg}</p>}
    </Widget>
  );
}
