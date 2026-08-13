// ─────────────────────────────────────────────────────────────────────────────
//  SHOW CONFIG  —  per-event automation settings (Event Detail → Show Config).
//
//  config = {
//    startItemId: '<pc item id>' | null,  // PP lands on this item → show starts
//    endItemId:   '<pc item id>' | null,  // last slide of this item → show ends
//    map: { '<pc item id>': { ppIndex, ppName } }  // manual PC→PP overrides
//    videos: { '<time id>': '<video id>' | null }   // per service, tri-state
//  }
//
//  Keyed per (roomId, planId) — per EVENT, not per service time: the 9:00 and
//  11:00 share one config, autostart picks the right time by the clock.
//
//  `videos` is the exception, and deliberately so: a channel pre-creates one
//  broadcast per service, so 8:00 and 9:30 are DIFFERENT videos on the same
//  plan. It lives here rather than on the room for exactly that reason — a
//  room-level pin would attribute both services to one broadcast and report
//  the same numbers twice.
//
//  Three states per service time, and the distinction between the first two
//  is load-bearing:
//    key ABSENT  → auto: record whatever is live on the channel
//    value null  → NOT STREAMED: record nothing, and don't even look
//    value '<id>' → pinned to that broadcast
//
//  "Not streamed" is not the same as "nothing pinned". A plan often has five
//  service times of which two are broadcast; on auto, the other three would
//  happily record a stream that was left running from an earlier service and
//  attribute those viewers to a service nobody watched online. Explicit null
//  also means the watcher never starts, so no YouTube quota is spent looking
//  for a broadcast that was never going to exist.
// ─────────────────────────────────────────────────────────────────────────────

import { getDb } from './db.js';

export function getConfig(roomId, planId) {
  const row = getDb()
    .prepare('SELECT config FROM show_config WHERE room_id = ? AND plan_id = ?')
    .get(roomId, planId);
  if (!row) return null;
  try {
    return JSON.parse(row.config);
  } catch {
    return null;
  }
}

/** Validate + save. Throws on bad shape — callers map that to HTTP 400. */
export function setConfig(roomId, planId, config, nowMs = Date.now()) {
  const clean = validate(config);
  getDb()
    .prepare(
      `INSERT INTO show_config (room_id, plan_id, config, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (room_id, plan_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at`,
    )
    .run(roomId, planId, JSON.stringify(clean), nowMs);
  return clean;
}

export function clearConfig(roomId, planId) {
  getDb().prepare('DELETE FROM show_config WHERE room_id = ? AND plan_id = ?').run(roomId, planId);
}

function validate(config) {
  if (config == null || typeof config !== 'object') throw new Error('config must be an object');
  const id = (v, name) => {
    if (v == null || v === '') return null;
    if (typeof v !== 'string') throw new Error(`${name} must be an item id`);
    return v;
  };
  const map = {};
  if (config.map != null) {
    if (typeof config.map !== 'object') throw new Error('map must be an object');
    for (const [pcId, pp] of Object.entries(config.map)) {
      if (pp == null) continue; // "Auto" — no override
      if (!Number.isInteger(pp.ppIndex) || pp.ppIndex < 0) {
        throw new Error('map values need an integer ppIndex');
      }
      map[pcId] = { ppIndex: pp.ppIndex, ppName: typeof pp.ppName === 'string' ? pp.ppName : null };
    }
  }
  // Per-service broadcast. null is MEANINGFUL (not streamed) and is kept;
  // '' and undefined mean "auto" and are dropped, so only non-default states
  // are stored. Ids are charset-checked because the value is interpolated into
  // a YouTube request URL — same reasoning as validateHost.
  const videos = {};
  if (config.videos != null) {
    if (typeof config.videos !== 'object') throw new Error('videos must be an object');
    for (const [timeId, videoId] of Object.entries(config.videos)) {
      if (videoId === null) {
        videos[timeId] = null; // explicitly not streamed
        continue;
      }
      if (videoId === undefined || videoId === '') continue; // "Auto" — find what's live
      if (typeof videoId !== 'string' || videoId.length > 32 || !/^[A-Za-z0-9_-]+$/.test(videoId)) {
        throw new Error(`"${timeId}" needs a YouTube video id (letters, digits, - and _ only)`);
      }
      videos[timeId] = videoId;
    }
  }

  return {
    startItemId: id(config.startItemId, 'startItemId'),
    endItemId: id(config.endItemId, 'endItemId'),
    map,
    videos,
    servicesLiveFromProPresenter: Boolean(config.servicesLiveFromProPresenter),
    // Kept separate from Run of Show's start item: Services LIVE is useful
    // without a dashboard show, and can instead begin at a service time.
    servicesLiveStartMode: config.servicesLiveStartMode === 'service-time' ? 'service-time' : 'item',
    servicesLiveStartItemId: id(config.servicesLiveStartItemId, 'servicesLiveStartItemId'),
    servicesLiveStartTimeId: id(config.servicesLiveStartTimeId, 'servicesLiveStartTimeId'),
  };
}
