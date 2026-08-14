// Admin configuration: settings/PINs/schedules, institution config (ADR 0009),
// and per-room connectivity.

import express from 'express';

import { rooms, rebuildRooms } from '../roomsStore.js';
import * as settings from '../settings.js';
import * as show from '../showManager.js';
import * as auth from '../authStore.js';
import * as appConfig from '../appConfig.js';
import * as connectivity from '../connectivity.js';
import * as branding from '../branding.js';
import * as secrets from '../secrets.js';
import * as setup from '../setup.js';
import * as pco from '../integrations/planningCenter.js';
import * as restream from '../integrations/restream.js';
import { roomStatus } from '../connectivityStatus.js';
import { requirePermission, permissionRequired, auditSuccess } from '../httpAuth.js';

const router = express.Router();
const restreamStates = new Map();
const restreamCallback = (req) => `${req.protocol}://${req.get('host')}/api/integrations/restream/callback`;

router.get('/api/integrations/restream/connect', requirePermission('*'), (req, res) => {
  try { const state = crypto.randomUUID(); restreamStates.set(state, Date.now()); res.redirect(restream.authorizeUrl(restreamCallback(req), state)); }
  catch (err) { res.status(400).json({ error: String(err.message ?? err) }); }
});
router.get('/api/integrations/restream/callback', async (req, res) => {
  const state = String(req.query.state ?? ''); const issued = restreamStates.get(state); restreamStates.delete(state);
  if (!issued || Date.now() - issued > 10 * 60_000 || !req.query.code) return res.status(400).send('Invalid or expired Restream authorization. Please connect again from ProdMesh Settings.');
  try { await restream.exchangeCode(String(req.query.code), restreamCallback(req)); res.redirect('/settings?restream=connected'); }
  catch (err) { res.status(502).send(`Restream authorization failed: ${String(err.message ?? err)}`); }
});
router.get('/api/integrations/restream/status', async (_req, res) => {
  try { res.json(await restream.status()); }
  catch (err) { res.status(502).json({ connected: false, status: 'offline', error: String(err.message ?? err) }); }
});

// ── First-run setup ───────────────────────────────────────────────────────────

// Public, like /api/auth/status and /api/config: the browser has to know
// whether to render the wizard before anyone can possibly be signed in, and
// every fact here is already readable from those two endpoints.
router.get('/api/setup', (_req, res) => {
  res.json(setup.getState());
});

// Finishing is an admin action — by this point the wizard has set the PIN and
// signed in, so there is no bootstrap exception to make. '*' rather than
// config.manage: dismissing setup is a one-way door for the whole install.
router.post('/api/setup/complete', requirePermission('*'), (req, res) => {
  const state = setup.complete();
  auditSuccess(req, '*', { resourceType: 'setup', resourceId: 'wizard', details: { completedAt: state.completedAt } });
  res.json(state);
});

// ── Secrets (write-only) ──────────────────────────────────────────────────────
//
//  Nothing here ever returns a stored value. A stolen admin session can
//  overwrite the church's Planning Center token or Slack bot token — loudly,
//  and things visibly break — but cannot learn them. Reading them back means
//  opening the file on the server, which already implies owning the box.
//  Requires '*' rather than settings.manage: these are the credentials to
//  other systems, not an operational setting.

router.get('/api/secrets', requirePermission('*'), (_req, res) => {
  res.json({ secrets: secrets.describeSecrets() }); // set/length/env only
});

router.put('/api/secrets', requirePermission('*'), (req, res) => {
  try {
    const touched = secrets.setSecrets(req.body?.updates ?? {});
    pco.clearCache(); // new credentials must not serve cached results
    auditSuccess(req, '*', {
      resourceType: 'secrets', resourceId: 'secrets',
      details: { paths: touched }, // WHICH keys changed, never their values
    });
    res.json({ ok: true, secrets: secrets.describeSecrets() });
  } catch (err) {
    res.status(400).json({ error: String(err.message ?? err) });
  }
});

// Do the stored credentials actually work? Saving a typo'd token otherwise
// looks like success and surfaces as a dead integration on Sunday. Returns
// booleans only — never anything derived from the secret itself.
router.get('/api/secrets/check', requirePermission('*'), async (_req, res) => {
  if (!pco.isConfigured()) return res.json({ planningCenter: null });
  const serviceTypes = [...new Set(
    Object.values(rooms).flatMap((r) => (r.planningCenter?.serviceTypes ?? []).map((st) => st.id)),
  )];
  if (!serviceTypes.length) return res.json({ planningCenter: null });
  try {
    pco.clearCache();
    await pco.getUpcomingPlans({ id: serviceTypes[0], name: 'check' }, 1);
    res.json({ planningCenter: true });
  } catch {
    res.json({ planningCenter: false });
  }
});

// ── Branding (institution logo) ───────────────────────────────────────────────

// Public read: every page renders it, including anonymous booth screens.
// 404 means "no override" and the client falls back to the bundled default.
// The Content-Type is the type SNIFFED at upload, never anything the uploader
// claimed, and nosniff stops the browser second-guessing it.
router.get('/api/branding/logo', (_req, res) => {
  const logo = branding.readLogo();
  if (!logo) return res.status(404).end();
  res.set({
    'Content-Type': logo.type,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    'Cache-Control': 'no-cache',
    ETag: `"${logo.updatedAt}"`,
  });
  res.end(logo.buffer);
});

// Raw body, capped, no multipart parser: this is one file, and every parser is
// more attack surface than `PUT the bytes` deserves. express.json() is already
// mounted, so this route takes the stream itself.
router.put('/api/branding/logo', requirePermission('config.manage'), (req, res) => {
  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    size += chunk.length;
    // Abort mid-upload rather than buffering the whole thing and then
    // complaining about its size.
    if (size > branding.MAX_LOGO_BYTES) {
      aborted = true;
      res.status(413).json({ error: `Logo must be under ${Math.floor(branding.MAX_LOGO_BYTES / 1024)} KB` });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    try {
      const meta = branding.setLogo(Buffer.concat(chunks));
      auditSuccess(req, 'config.manage', { resourceType: 'branding', resourceId: 'logo', details: { bytes: meta.bytes } });
      res.json({ ok: true, ...meta });
    } catch (err) {
      res.status(err.code === 'too_large' ? 413 : 400).json({ error: String(err.message ?? err) });
    }
  });
});

router.delete('/api/branding/logo', requirePermission('config.manage'), (req, res) => {
  branding.clearLogo();
  auditSuccess(req, 'config.manage', { resourceType: 'branding', resourceId: 'logo', details: { operation: 'clear' } });
  res.json({ ok: true });
});

// ── Settings ───────────────────────────────────────────────────────────────────

router.get('/api/settings', requirePermission('settings.manage'), (_req, res) => {
  res.json(settings.getPublicSettings());
});

// Update PINs. Bootstrap exception: if no admin PIN exists yet, the first
// admin-PIN set is allowed without a token (first-run setup).
router.post('/api/settings/pins', (req, res) => {
  const bootstrapping = settings.isAdminSetupNeeded() && req.body?.admin;
  if (!bootstrapping) {
    // Changing the ADMIN PIN is a superuser action, not an operational one:
    // the PIN it sets mints a token that bypasses every permission check, so
    // settings.manage — labelled "Edit operational settings and schedules" —
    // was silently a path to full control. Reproduced: a settings.manage user
    // overwrote the admin PIN, logged in with it, and created users.
    // The OVERRIDE PIN stays under settings.manage; it only unlocks a room
    // mode change for someone already standing at the booth.
    const wantsAdminPin = req.body?.admin !== undefined;
    const permission = wantsAdminPin ? '*' : 'settings.manage';
    if (!req.legacyAdmin && !auth.hasPermission(req.auth, permission)) {
      return res.status(req.auth ? 403 : 401).json(permissionRequired(permission));
    }
  }
  try {
    // During bootstrap, set ONLY the field the exception justifies. It used to
    // pass `override` through as well, so an anonymous first-run caller took
    // the room-mode override PIN along with admin in the same request.
    settings.setPins(bootstrapping
      ? { admin: req.body.admin }
      : { admin: req.body?.admin, override: req.body?.override });
  } catch (err) {
    if (err.code === 'weak_pin') return res.status(400).json({ error: String(err.message) });
    throw err;
  }
  if (bootstrapping) {
    auth.audit({ action: 'settings.bootstrap', result: 'allowed', details: { ip: req.ip ?? null } });
  }
  res.json({ ok: true, ...settings.getPublicSettings().pins });
});

router.put('/api/settings/schedules', requirePermission('settings.manage'), (req, res) => {
  try {
    settings.setSchedules(req.body?.schedules);
  } catch (err) {
    return res.status(400).json({ error: String(err.message ?? err) });
  }
  res.json({ ok: true, schedules: settings.getPublicSettings().schedules });
});

// ── Institution config (name, sites, Quick Access tiles — ADR 0009) ───────────

// Public read: the shell needs it before anyone signs in (like /api/rooms).
router.get('/api/config', (_req, res) => {
  res.json(appConfig.getChurch());
});

// Whole-tree save from Admin → Campuses (transactional replace).
router.put('/api/config', requirePermission('config.manage'), (req, res) => {
  try {
    const stored = appConfig.replaceChurch(req.body);
    // Topology edits become real server rooms immediately: rebuild the live
    // map, re-apply stored connectivity onto the (possibly new) room objects,
    // and reconcile per-room watchers/shows with the result.
    rebuildRooms();
    connectivity.applyConnectivity();
    show.syncAutomation();
    auditSuccess(req, 'config.manage', {
      resourceType: 'topology',
      details: {
        sites: stored.sites.length,
        tiles: stored.sites.flatMap((s) => s.auditoriums).flatMap((a) => a.tiles).length,
      },
    });
    res.json(stored);
  } catch (err) {
    res.status(400).json({ error: String(err.message ?? err) });
  }
});

// ── Room connectivity (room configuration page) ───────────────────────────────

// What integrations this room has. hasServerRoom=false means the topology
// knows the room but the server integration map (rooms.config.js) doesn't.
// The Smaart password never leaves the server: reads carry hasPassword only,
// and writes without a `password` field keep the stored one.
function redactAnalysis(cfg) {
  if (!cfg) return null;
  const { password, ...rest } = cfg;
  return { ...rest, hasPassword: Boolean(password) };
}

// Same bargain for ProdCom's pre-shared key: it is the credential to a private
// comms transcript, so it goes in and never comes back out.
function redactCaptions(cfg) {
  if (!cfg) return null;
  const { key, ...rest } = cfg;
  return { ...rest, hasKey: Boolean(key) };
}

// Behind config.manage: this is the room-configuration editor's own read, and
// it returns the production network map — ProPresenter/Companion/analysis
// host:port plus the Companion button coordinates that roomModel.js
// deliberately withholds from the public /api/rooms. Anonymous callers were
// getting a pre-built inventory of every device on the church's VLAN.
router.get('/api/config/rooms/:roomId/connectivity', requirePermission('config.manage'), (req, res) => {
  if (!rooms[req.params.roomId]) {
    return res.json({
      hasServerRoom: false, planningCenter: null, analysis: null, proPresenter: null,
      companion: null, youtube: null,
    });
  }
  res.json({
    hasServerRoom: true,
    planningCenter: connectivity.getPlanningCenter(req.params.roomId) ?? { serviceTypes: [] },
    analysis: redactAnalysis(connectivity.getAnalysis(req.params.roomId)),
    captions: redactCaptions(connectivity.getCaptions(req.params.roomId)),
    proPresenter: connectivity.getProPresenter(req.params.roomId),
    youtube: connectivity.getYouTube(req.params.roomId),
    // A room with no stored row yet (created in Admin → Campuses) shows its
    // live defaults so the editor opens pre-filled rather than unsavable.
    companion:
      connectivity.getCompanion(req.params.roomId) ??
      connectivity.companionFromRoom(rooms[req.params.roomId]),
  });
});

// Live per-integration status (the chips next to each editor). Probes the
// room's devices on demand — behind config.manage since it generates real
// outbound requests.
router.get('/api/config/rooms/:roomId/connectivity/status', requirePermission('config.manage'), async (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'unknown room' });
  res.json(await roomStatus(room));
});

router.put('/api/config/rooms/:roomId/connectivity/planning-center', requirePermission('config.manage'), (req, res) => {
  try {
    const stored = connectivity.setPlanningCenter(req.params.roomId, req.body?.serviceTypes);
    auditSuccess(req, 'config.manage', {
      resourceType: 'room-connectivity',
      resourceId: req.params.roomId,
      roomId: req.params.roomId,
      details: { integration: 'planningCenter', serviceTypes: stored.serviceTypes.length },
    });
    res.json({ planningCenter: stored });
  } catch (err) {
    res.status(rooms[req.params.roomId] ? 400 : 404).json({ error: String(err.message ?? err) });
  }
});

router.put('/api/config/rooms/:roomId/connectivity/youtube', requirePermission('config.manage'), (req, res) => {
  try {
    const clean = connectivity.setYouTube(req.params.roomId, req.body?.youtube ?? null);
    auditSuccess(req, 'config.manage', {
      resourceType: 'room-connectivity',
      resourceId: req.params.roomId,
      roomId: req.params.roomId,
      details: { integration: 'youtube', configured: Boolean(clean) },
    });
    res.json({ youtube: clean });
  } catch (err) {
    res.status(rooms[req.params.roomId] ? 400 : 404).json({ error: String(err.message ?? err) });
  }
});

router.put('/api/config/rooms/:roomId/connectivity/captions', requirePermission('config.manage'), (req, res) => {
  try {
    let input = req.body?.captions ?? null;
    // An omitted key means "leave it alone", not "clear it" — the editor never
    // receives the stored one, so it cannot send it back.
    if (input && input.key === undefined) {
      const stored = connectivity.getCaptions(req.params.roomId);
      if (stored?.key) input = { ...input, key: stored.key };
    }
    const clean = connectivity.setCaptions(req.params.roomId, input);
    auditSuccess(req, 'config.manage', {
      resourceType: 'room-connectivity',
      resourceId: req.params.roomId,
      roomId: req.params.roomId,
      details: { integration: 'captions', source: clean?.source ?? null },
    });
    res.json({ captions: redactCaptions(clean) });
  } catch (err) {
    res.status(400).json({ error: String(err.message ?? err) });
  }
});

router.put('/api/config/rooms/:roomId/connectivity/analysis', requirePermission('config.manage'), (req, res) => {
  try {
    let input = req.body?.analysis ?? null;
    if (input && input.password === undefined) {
      const stored = connectivity.getAnalysis(req.params.roomId);
      if (stored?.password) input = { ...input, password: stored.password };
    }
    const clean = connectivity.setAnalysis(req.params.roomId, input);
    auditSuccess(req, 'config.manage', {
      resourceType: 'room-connectivity',
      resourceId: req.params.roomId,
      roomId: req.params.roomId,
      details: { integration: 'analysis', source: clean?.source ?? null },
    });
    res.json({ analysis: redactAnalysis(clean) });
  } catch (err) {
    res.status(rooms[req.params.roomId] ? 400 : 404).json({ error: String(err.message ?? err) });
  }
});

router.put('/api/config/rooms/:roomId/connectivity/companion', requirePermission('config.manage'), (req, res) => {
  try {
    const clean = connectivity.setCompanion(req.params.roomId, req.body?.companion);
    auditSuccess(req, 'config.manage', {
      resourceType: 'room-connectivity',
      resourceId: req.params.roomId,
      roomId: req.params.roomId,
      details: { integration: 'companion', mock: clean.mock, modes: clean.modes.length },
    });
    res.json({ companion: clean });
  } catch (err) {
    res.status(rooms[req.params.roomId] ? 400 : 404).json({ error: String(err.message ?? err) });
  }
});

router.put('/api/config/rooms/:roomId/connectivity/propresenter', requirePermission('config.manage'), (req, res) => {
  try {
    const clean = connectivity.setProPresenter(req.params.roomId, req.body?.proPresenter ?? null);
    auditSuccess(req, 'config.manage', {
      resourceType: 'room-connectivity',
      resourceId: req.params.roomId,
      roomId: req.params.roomId,
      details: { integration: 'proPresenter', host: clean?.host ?? null },
    });
    res.json({ proPresenter: clean });
  } catch (err) {
    res.status(rooms[req.params.roomId] ? 400 : 404).json({ error: String(err.message ?? err) });
  }
});

export default router;
