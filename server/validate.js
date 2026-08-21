// Startup validation for the structural room config. Throws a clear, actionable
// error instead of letting a typo surface as a cryptic runtime failure later.

import { MAX_ROWS_HARD, collisions, fits, gridFor, normalize } from './gridLayout.js';

function fail(msg) {
  throw new Error(`Invalid rooms.config.js: ${msg}`);
}

/** Validate the `rooms` map. Returns the rooms on success; throws otherwise. */
export function validateRooms(rooms) {
  if (!rooms || typeof rooms !== 'object') fail('`rooms` must be an object.');

  for (const [key, room] of Object.entries(rooms)) {
    const where = `room "${key}"`;
    if (!room.id) fail(`${where} is missing an id.`);
    if (room.id !== key) fail(`${where} id "${room.id}" must match its key "${key}".`);
    if (!room.name) fail(`${where} is missing a name.`);
    if (!Array.isArray(room.modes) || room.modes.length === 0) {
      fail(`${where} must have a non-empty modes array.`);
    }

    if (!room.mock) {
      if (!room.companion?.host) fail(`${where} is live (mock:false) but has no companion.host.`);
      if (!room.state?.variable) fail(`${where} is live but has no state.variable.`);
    }

    const ids = new Set();
    for (const m of room.modes) {
      const mwhere = `${where} mode "${m.id ?? '?'}"`;
      if (!m.id) fail(`${mwhere} is missing an id.`);
      if (ids.has(m.id)) fail(`${where} has duplicate mode id "${m.id}".`);
      ids.add(m.id);
      if (!m.label) fail(`${mwhere} is missing a label.`);
      if (!m.match) fail(`${mwhere} is missing a match value.`);
      const p = m.press;
      if (p) {
        for (const f of ['page', 'row', 'column']) {
          if (!Number.isInteger(p[f])) fail(`${mwhere} press.${f} must be an integer.`);
        }
      }
    }
  }
  return rooms;
}

/** Validate a schedules object (used when saving from the Settings UI). */
export function validateSchedules(schedules) {
  if (schedules == null) return {};
  if (typeof schedules !== 'object') throw new Error('schedules must be an object');
  for (const windows of Object.values(schedules)) {
    if (!Array.isArray(windows)) throw new Error('each room schedule must be an array');
    for (const w of windows) {
      if (!Array.isArray(w.days) || w.days.some((d) => d < 0 || d > 6)) {
        throw new Error('window.days must be integers 0-6');
      }
      if (!/^\d{1,2}:\d{2}$/.test(String(w.start)) || !/^\d{1,2}:\d{2}$/.test(String(w.end))) {
        throw new Error('window.start/end must be "HH:MM"');
      }
      if (!Array.isArray(w.lock)) throw new Error('window.lock must be an array');
    }
  }
  return schedules;
}

/** Validate one checklist template's items (saving from the Admin editor). */
export function validateTemplateItems(items) {
  if (!Array.isArray(items)) throw new Error('items must be an array');
  if (items.length > 50) throw new Error('a checklist can have at most 50 items');
  for (const it of items) {
    if (typeof it?.label !== 'string' || !it.label.trim()) {
      throw new Error('every item needs a label');
    }
    if (it.label.length > 200) throw new Error('item labels must be ≤ 200 characters');
    if (it.id != null && !/^[a-z0-9_-]{1,60}$/i.test(it.id)) {
      throw new Error('item ids may only contain letters, digits, - and _');
    }
    if (it.action != null) {
      if (it.action.type !== 'mode' || typeof it.action.mode !== 'string' || !it.action.mode) {
        throw new Error('item action must be { type: "mode", mode: "<mode id>" }');
      }
    }
  }
  return items;
}

// ── Institution topology (sites / rooms / Quick Access tiles) ────────────────
// Validates the whole tree the Admin → Campuses editor saves. Returns a
// normalized copy (trimmed strings, only known fields) so junk never persists.

const TOPO_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
const TILE_TYPES = new Set(['companion', 'screenshare', 'link', 'route', 'placeholder']);
const COMPANION_VIEWS = new Set(['admin', 'tablet', 'emulator']);

export function validateChurch(input) {
  if (!input || typeof input !== 'object') throw new Error('config must be an object');
  const name = String(input.name ?? '').trim();
  if (!name || name.length > 80) throw new Error('Institution name must be 1–80 characters');
  if (!Array.isArray(input.sites) || input.sites.length === 0) throw new Error('At least one site is required');
  if (input.sites.length > 20) throw new Error('Too many sites (max 20)');

  const seen = new Set();
  const claim = (id, what) => {
    if (typeof id !== 'string' || !TOPO_ID.test(id)) {
      throw new Error(`${what} id "${id}" must be lowercase letters, numbers, and dashes`);
    }
    if (seen.has(id)) throw new Error(`Duplicate id "${id}"`);
    seen.add(id);
    return id;
  };
  const text = (value, what, max, { required = false } = {}) => {
    const s = String(value ?? '').trim();
    if (required && !s) throw new Error(`${what} is required`);
    if (s.length > max) throw new Error(`${what} must be at most ${max} characters`);
    return s || undefined;
  };

  const sites = input.sites.map((site) => {
    const id = claim(site?.id, 'Site');
    if (site.status !== 'active' && site.status !== 'disabled') {
      throw new Error(`Site "${id}" status must be active or disabled`);
    }
    const auditoriums = Array.isArray(site.auditoriums) ? site.auditoriums : [];
    if (auditoriums.length > 20) throw new Error(`Site "${id}" has too many rooms (max 20)`);
    return {
      id,
      name: text(site.name, `Site "${id}" name`, 60, { required: true }),
      status: site.status,
      auditoriums: auditoriums.map((room) => {
        const roomId = claim(room?.id, 'Room');
        const tiles = Array.isArray(room.tiles) ? room.tiles : [];
        if (tiles.length > 40) throw new Error(`Room "${roomId}" has too many tiles (max 40)`);
        return {
          id: roomId,
          name: text(room.name, `Room "${roomId}" name`, 60, { required: true }),
          tiles: tiles.map((tile) => validateTile(tile, claim, text)),
        };
      }),
    };
  });

  return { name, sites };
}

function validateTile(tile, claim, text) {
  const id = claim(tile?.id, 'Tile');
  if (!TILE_TYPES.has(tile.type)) throw new Error(`Tile "${id}" has unknown type "${tile.type}"`);
  const base = {
    id,
    type: tile.type,
    label: text(tile.label, `Tile "${id}" label`, 60, { required: true }),
    note: text(tile.note, `Tile "${id}" note`, 120),
    icon: text(tile.icon, `Tile "${id}" icon`, 8),
  };
  switch (tile.type) {
    case 'companion': {
      const out = { ...base, host: text(tile.host, `Tile "${id}" host`, 120, { required: true }) };
      if (tile.port != null && tile.port !== '') {
        const port = Number(tile.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Tile "${id}" port must be 1–65535`);
        out.port = port;
      }
      if (tile.view != null && tile.view !== '') {
        if (!COMPANION_VIEWS.has(tile.view)) throw new Error(`Tile "${id}" view must be admin, tablet, or emulator`);
        out.view = tile.view;
      }
      return out;
    }
    case 'screenshare':
      return {
        ...base,
        host: text(tile.host, `Tile "${id}" host`, 120, { required: true }),
        username: text(tile.username, `Tile "${id}" username`, 60),
      };
    case 'link': {
      const url = text(tile.url, `Tile "${id}" url`, 300, { required: true });
      if (!/^https?:\/\//.test(url)) throw new Error(`Tile "${id}" url must start with http:// or https://`);
      return { ...base, url };
    }
    case 'route': {
      const to = text(tile.to, `Tile "${id}" route`, 200, { required: true });
      if (!to.startsWith('/')) throw new Error(`Tile "${id}" route must start with /`);
      return { ...base, to };
    }
    default: // placeholder
      return base;
  }
}

// ── Views (dashboards and displays) ─────────────────────────────────────────
// Same discipline as the topology above: caps on everything, and a normalized
// copy containing only known fields so junk never persists.

const VIEW_KINDS = new Set(['dashboard', 'display']);

/**
 * The widget catalogue, duplicated from src/widgets/registry.tsx exactly as
 * TILE_TYPES duplicates src/tiles/registry.tsx — the server is JS, the
 * frontend is TS, and there is no build step between them.
 *
 * `unique` is whether a view may hold more than one. It is a flag rather than
 * a blanket rule because the real invariant is that a placement be
 * IDENTIFIABLE: today most widgets carry no config, so the type alone
 * identifies them and one-per-view falls out for free. A future multi-instance
 * widget (two Smaart engines in one room — one for the stream, one for the
 * house) sets unique:false and earns an identity in its config.
 *
 * `display` is whether it may go on a read-only screen. A widget that takes
 * actions may not: a display is DEFINED as non-interactive.
 *
 * Exported for src/widgets/registry.test.tsx, which imports this file and
 * fails if the two tables disagree. That is the only thing keeping a hand-kept
 * duplicate honest: a widget added on one side alone is otherwise offered by
 * the editor and refused by the save, or the reverse, and neither is visible
 * until somebody tries it.
 */
// `min`/`max` bound how far a placement may be stretched. Absent means one
// fixed size — see WidgetDef in src/widgets/types.ts for why most stay fixed.
export const WIDGET_TYPES = new Map([
  ['countdown', { unique: true, display: true, size: { w: 2, h: 1 } }],
  ['loudness', { unique: false, display: true, size: { w: 2, h: 1 } }],
  ['loudness-trend', { unique: true, display: true, size: { w: 2, h: 1 } }],
  ['viewers', { unique: true, display: true, size: { w: 1, h: 1 } }],
  ['restream', { unique: true, display: true, size: { w: 2, h: 2 } }],
  ['resi-stream', { unique: true, display: true, size: { w: 3, h: 2 } }],
  ['resi-health', { unique: true, display: true, size: { w: 2, h: 2 } }],
  ['resi-viewers', { unique: true, display: true, size: { w: 1, h: 1 } }],
  ['resi-broadcast', { unique: true, display: true, size: { w: 3, h: 3 } }],
  ['run-of-show', {
    unique: true, display: false,
    size: { w: 2, h: 3 }, min: { w: 2, h: 3 }, max: { w: 2, h: 5 },
  }],
  ['now-next', { unique: true, display: true, size: { w: 3, h: 1 } }],
  ['room-mode', { unique: true, display: true, size: { w: 2, h: 1 } }],
  ['clock', { unique: true, display: true, size: { w: 2, h: 1 } }],
  ['captions', {
    unique: true, display: true,
    size: { w: 2, h: 1 }, min: { w: 2, h: 1 }, max: { w: 3, h: 3 },
  }],
  ['room-health', {
    unique: true, display: true,
    size: { w: 1, h: 1 }, min: { w: 1, h: 1 }, max: { w: 3, h: 3 },
  }],
  ['slides-left', { unique: true, display: true, size: { w: 1, h: 1 } }],
  ['lyrics', {
    unique: true, display: true,
    size: { w: 2, h: 2 }, min: { w: 2, h: 2 }, max: { w: 3, h: 3 },
  }],
  ['propresenter-slides', { unique: true, display: true, size: { w: 2, h: 2 }, min: { w: 2, h: 2 }, max: { w: 3, h: 3 } }],
  // A playlist needs useful room by default, but operators choose its height
  // for the dashboard layout just like its width.
  ['propresenter-playlist', { unique: true, display: false, size: { w: 4, h: 4 }, min: { w: 2, h: 2 }, max: { w: 4, h: 5 } }],
  ['propresenter-controls', { unique: true, display: false, size: { w: 2, h: 1 } }],
  ['slide-notes', { unique: true, display: true, size: { w: 2, h: 1 } }],
  ['propresenter-timers', { unique: true, display: true, size: { w: 2, h: 2 }, min: { w: 2, h: 1 }, max: { w: 3, h: 3 } }],
  ['planning-center-service', { unique: true, display: true, size: { w: 2, h: 1 } }],
  ['planning-center-timers', { unique: true, display: true, size: { w: 2, h: 2 }, min: { w: 2, h: 2 }, max: { w: 3, h: 4 } }],
  ['planning-center-schedule', { unique: true, display: true, size: { w: 2, h: 1 } }],
  ['planning-center-teams', { unique: true, display: true, size: { w: 2, h: 2 }, min: { w: 2, h: 2 }, max: { w: 3, h: 4 } }],
]);

const MAX_WIDGETS_PER_VIEW = 40; // same cap as tiles-per-room
const MAX_WIDGET_SIZE = { w: 6, h: 5 }; // dashboard width × practical height

// A short list, not a free number: this is "how far away is the screen", and
// a slider inviting 1.37 would only ever produce blurry half-pixel type.
const SCALES = [1, 1.25, 1.5, 2, 2.5, 3];

/**
 * Validate a view's editable content. Throws on bad shape — callers map that
 * to HTTP 400.
 *
 * `columns`/`max_rows` are NOT accepted from the client: they are derived from
 * `kind` here and written by the store. A client that could choose its own
 * grid could choose a 12000-column one.
 */
export function validateView(input) {
  if (!input || typeof input !== 'object') throw new Error('view must be an object');

  const kind = input.kind;
  if (!VIEW_KINDS.has(kind)) throw new Error('View kind must be dashboard or display');
  const grid = gridFor(kind);

  const name = String(input.name ?? '').trim();
  if (!name || name.length > 60) throw new Error('View name must be 1–60 characters');

  const slug = String(input.slug ?? '').trim();
  if (!TOPO_ID.test(slug)) {
    throw new Error(`View id "${slug}" must be lowercase letters, numbers, and dashes`);
  }

  // Unlike columns/maxRows this IS the client's to choose — it describes the
  // screen the view is shown on, which the server cannot know.
  const scale = input.scale == null ? 1 : Number(input.scale);
  if (!SCALES.includes(scale)) throw new Error(`View scale must be one of ${SCALES.join(', ')}`);

  const input_widgets = Array.isArray(input.widgets) ? input.widgets : [];
  if (input_widgets.length > MAX_WIDGETS_PER_VIEW) {
    throw new Error(`A view can hold at most ${MAX_WIDGETS_PER_VIEW} widgets`);
  }

  const placed = new Set();
  const widgets = input_widgets.map((widget) => {
    const type = String(widget?.type ?? '');
    const def = WIDGET_TYPES.get(type);
    // Rejected on WRITE, but never on read — see views.js. A PUT comes from
    // this build's own editor, so an unknown type is a bug, and storing it
    // stores something nothing will ever render.
    if (!def) throw new Error(`Unknown widget type "${type}"`);
    if (def.unique && placed.has(type)) throw new Error(`Widget "${type}" can only be placed once`);
    placed.add(type);
    if (kind === 'display' && !def.display) {
      throw new Error(`Widget "${type}" cannot go on a display`);
    }

    const box = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    for (const key of ['x', 'y', 'w', 'h']) {
      if (!Number.isInteger(box[key])) throw new Error(`Widget "${type}" needs integer grid coordinates`);
    }
    // A placement may only be the size its widget allows. The editor already
    // refuses out-of-range handles; this is the door that matters, because a
    // stored layout is data and data arrives from anywhere.
    const min = { w: 1, h: 1 };
    // Widgets may expand up to the dashboard's full width and five rows tall.
    // The display grid still rejects anything that cannot fit its 3×3 canvas.
    const max = MAX_WIDGET_SIZE;
    if (box.w < min.w || box.h < min.h || box.w > max.w || box.h > max.h) {
      throw new Error(
        `Widget "${type}" must be ${sizeRange(min, max)} — got ${box.w}×${box.h}`,
      );
    }
    if (!fits(grid, box)) {
      throw new Error(
        kind === 'display'
          ? `Widget "${type}" does not fit a display's ${grid.columns}×${grid.maxRows} grid`
          : `Widget "${type}" is outside the ${grid.columns}-column grid (max ${MAX_ROWS_HARD} rows)`,
      );
    }

    return { type, ...box, config: viewWidgetConfig(widget.config) };
  });

  const [clash] = collisions(widgets);
  if (clash) throw new Error(`Widgets "${clash[0].type}" and "${clash[1].type}" overlap`);

  return {
    kind,
    name,
    slug,
    columns: grid.columns,
    maxRows: grid.maxRows,
    scale,
    widgets: normalize(widgets),
  };
}

/**
 * A placement's own config. Unknown keys are DROPPED rather than rejected,
 * matching validateTile's "only known fields per type" — a view written by a
 * newer build should lose the field it doesn't understand, not fail to save.
 */
const sizeRange = (min, max) =>
  min.w === max.w && min.h === max.h
    ? `${min.w}×${min.h}`
    : `between ${min.w}×${min.h} and ${max.w}×${max.h}`;

function viewWidgetConfig(config) {
  if (!config || typeof config !== 'object') return {};
  const out = {};
  for (const key of ['planId', 'timeId']) {
    const value = config[key];
    if (typeof value !== 'string' || !value) continue;
    if (value.length > 120) throw new Error(`Widget ${key} is too long`);
    out[key] = value;
  }
  // ProPresenter controls are opt-in per stored placement. This is security
  // configuration, not presentation preference: routes resolve it from SQLite
  // before forwarding any command to the device.
  for (const key of ['slideControls', 'keyboardControls', 'followActive']) {
    if (typeof config[key] === 'boolean') out[key] = config[key];
  }
  if (['image', 'text'].includes(config.slideMode)) out.slideMode = config.slideMode;
  if (config.slideSize != null) {
    const size = Number(config.slideSize);
    if (!Number.isInteger(size) || size < 0 || size > 200) throw new Error('Slide size must be 0–200 pixels');
    out.slideSize = size;
  }
  for (const key of ['target', 'limit']) {
    if (config[key] == null || config[key] === '') continue;
    const value = Number(config[key]);
    if (!Number.isFinite(value) || value < 40 || value > 130) throw new Error(`Widget ${key} must be 40–130 dB`);
    out[key] = value;
  }
  if (out.target != null && out.limit != null && out.limit < out.target) throw new Error('Widget limit must be at or above target');
  if (config.metric != null && config.metric !== '') {
    if (typeof config.metric !== 'string' || config.metric.length > 60) throw new Error('Widget metric must be at most 60 characters');
    out.metric = config.metric;
  }
  if (['A', 'B', 'C', 'Z'].includes(config.weighting)) out.weighting = config.weighting;
  if (['Fast', 'Slow'].includes(config.response)) out.response = config.response;
  if (['current', 'next', 'both'].includes(config.slides)) out.slides = config.slides;
  for (const key of ['autoplay', 'muted', 'playerControls', 'destinationLinks', 'videoPreview']) {
    if (typeof config[key] === 'boolean') out[key] = config[key];
  }
  if (['16:9', '4:3', '1:1'].includes(config.aspectRatio)) out.aspectRatio = config.aspectRatio;
  return out;
}
