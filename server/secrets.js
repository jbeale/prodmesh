// Secrets loader for external service integrations (Planning Center, etc.).
//
// Unlike PINs (which are hashed), integration tokens must be used as-is, so they
// live in a git-ignored file: server/data/secrets.json (see secrets.example.json
// for the shape). Env vars override file values, so a Proxmox/CI deploy can
// inject secrets without a file.
//
//   getSecret('planningCenter.appId')  → string | undefined

import { readFileSync, existsSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PRODMESH_DATA_DIR ?? join(__dirname, 'data');
const FILE = join(DATA_DIR, 'secrets.json');

let cache = null;

function load() {
  if (cache) return cache;
  if (existsSync(FILE)) {
    try {
      cache = JSON.parse(readFileSync(FILE, 'utf8'));
    } catch {
      cache = {};
    }
  } else {
    cache = {};
  }
  return cache;
}

/** Dotted-path lookup, with an env override (PRODMESH_SECRET_<PATH>). */
export function getSecret(path) {
  const envKey = `PRODMESH_SECRET_${path.replace(/\./g, '_').toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey];
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), load());
}

// ── Writing (Admin → Secrets) ────────────────────────────────────────────────
//
//  Deliberately WRITE-ONLY. Nothing here ever returns a stored value, and no
//  route exposes one — the only way to read a secret back is to open the file
//  on the server, which already implies you own the box. That keeps a stolen
//  admin session from exfiltrating the church's Planning Center token or Slack
//  bot token; it can overwrite them (loudly, and things break) but not learn
//  them.
//
//  Callers get to know only whether a value is SET, and its length, which is
//  enough to tell "configured" from "not" and to spot a truncated paste.

/**
 * Every secret the app reads, grouped by the integration it belongs to so the
 * UI can present one card per integration rather than a flat list of paths.
 *
 * Slack is deliberately ONE set of credentials. It used to be split test/prod
 * with `slack.use` choosing — a development convenience that every installing
 * church had to reason about. slack.js still reads the legacy nested keys as a
 * fallback, so existing installs keep working; they are just not editable here.
 */
export const SECRET_GROUPS = [
  {
    id: 'planningCenter',
    label: 'Planning Center',
    hint: 'Personal Access Token from planningcenteronline.com → Developer → Personal Access Tokens.',
    fields: [
      { path: 'planningCenter.appId', label: 'Application ID' },
      { path: 'planningCenter.secret', label: 'Secret' },
    ],
  },
  {
    id: 'slack',
    label: 'Slack',
    hint: 'Bot token from your Slack app (starts xoxb-), and the channel assistance requests post to.',
    fields: [
      { path: 'slack.botOauthToken', label: 'Bot token' },
      { path: 'slack.channel', label: 'Channel', secret: false },
      // Not read by anything yet. Kept because both are needed the moment
      // Slack can TRIGGER actions rather than only receive them: the signing
      // secret verifies inbound requests, the app token opens Socket Mode.
      // Marked optional so a church that only wants notifications still reads
      // as fully configured.
      {
        path: 'slack.signingSecret',
        label: 'Signing secret',
        optional: true,
        note: 'Needed to verify requests from Slack — for actions triggered from Slack (not used yet).',
      },
      {
        path: 'slack.appToken',
        label: 'App-level token',
        optional: true,
        note: 'Socket Mode token (starts xapp-) — for actions triggered from Slack (not used yet).',
      },
    ],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    hint:
      'API key from a Google Cloud project with the YouTube Data API v3 enabled. '
      + 'Reads public viewer counts only — restrict the key to that API.',
    fields: [{ path: 'youtube.apiKey', label: 'API key' }],
  },
  { id: 'restream', label: 'Restream', hint: 'OAuth app credentials from Restream Developers. ProdMesh stores and refreshes account tokens automatically after you connect.', fields: [
    { path: 'restream.clientId', label: 'Client ID' }, { path: 'restream.clientSecret', label: 'Client Secret' },
  ] },
];

export const SECRET_KEYS = SECRET_GROUPS.flatMap((g) => g.fields.map((f) => ({ ...f, group: g.id })));
// OAuth tokens are written only by the callback/refresh flow. They are never
// exposed in Settings, even as masked fields, and never accepted from its UI.
const INTERNAL_SECRET_KEYS = new Set(['restream.accessToken', 'restream.refreshToken']);

const isSecretKey = (path) => SECRET_KEYS.some((k) => k.path === path) || INTERNAL_SECRET_KEYS.has(path);

/**
 * What is configured — never what it is. `env: true` means an environment
 * variable is winning, so editing the file here would have no effect.
 */
export function describeSecrets() {
  const file = load();
  const describeField = ({ path, label, secret = true, optional = false, note = null }) => {
    const envKey = `PRODMESH_SECRET_${path.replace(/\./g, '_').toUpperCase()}`;
    const fromEnv = Boolean(process.env[envKey]);
    const fileValue = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), file);
    const value = fromEnv ? process.env[envKey] : fileValue;
    return {
      path,
      label,
      secret, // false = safe to show (a channel name is not a credential)
      optional, // stored for a feature that does not exist yet
      note,
      set: Boolean(value),
      length: value ? String(value).length : 0,
      // Non-secret values are echoed so the UI can show which channel is
      // configured. Credentials never are.
      value: !secret && value ? String(value) : null,
      env: fromEnv,
    };
  };
  return SECRET_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    hint: g.hint,
    fields: g.fields.map(describeField),
    // Only the fields the app actually uses decide this — a church that wants
    // notifications and nothing else is fully configured without the
    // Slack-triggered-actions credentials.
    configured: g.fields.filter((f) => !f.optional).every((f) => describeField(f).set),
  }));
}

/**
 * Set or clear secrets. `updates` is { 'dotted.path': 'value' }; an empty
 * string clears. Writes the file with owner-only permissions — it was 0644,
 * i.e. readable by every local account on the box.
 */
export function setSecrets(updates) {
  const next = structuredClone(load());
  const touched = [];
  for (const [path, raw] of Object.entries(updates ?? {})) {
    if (!isSecretKey(path)) {
      const err = new Error(`Unknown secret "${path}"`);
      err.code = 'unknown_secret';
      throw err;
    }
    const value = String(raw ?? '');
    if (value.length > 500) {
      const err = new Error(`Value for "${path}" is too long`);
      err.code = 'bad_secret';
      throw err;
    }
    const parts = path.split('.');
    const leaf = parts.pop();
    let node = next;
    for (const part of parts) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part];
    }
    if (value === '') delete node[leaf];
    else node[leaf] = value;
    touched.push(path);
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(FILE, 0o600); // an existing file keeps its old mode without this
  } catch {
    /* best effort — Windows and some mounts don't support it */
  }
  cache = next;
  return touched;
}

/** Drop the memoized copy (tests, and after an out-of-band file edit). */
export function reloadSecrets() {
  cache = null;
}
