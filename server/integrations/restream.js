import { getSecret, setSecrets } from '../secrets.js';
import { report } from '../health.js';

const TOKEN_URL = 'https://api.restream.io/oauth/token';
const API = 'https://api.restream.io/v2';
// Keep the consent request aligned with every capability Restream exposes in
// ProdMesh. A customer can enable any subset in the Restream developer portal;
// Restream will grant only scopes enabled for the application.
const OAUTH_SCOPES = [
  'profile.read', 'channels.read', 'stream.read', 'chat.read', 'clips.read',
  'storage.read', 'studio.read', 'channels.write', 'clips.write',
  'storage.write', 'stream.write', 'studio.write',
].join(' ');
export const healthKey = () => 'restream';
export const configured = () => Boolean(getSecret('restream.clientId') && getSecret('restream.clientSecret'));

async function token(body) {
  const clientId = getSecret('restream.clientId');
  const clientSecret = getSecret('restream.clientSecret');
  if (!clientId || !clientSecret) throw new Error('Save the Restream Client ID and Client Secret first');
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  if (!res.ok) throw new Error(`Restream OAuth rejected the request (${res.status})`);
  return res.json();
}
export async function exchangeCode(code, redirectUri) {
  const value = await token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  storeTokenPair(value);
}

function storeTokenPair(value) {
  setSecrets({
    'restream.accessToken': value.access_token ?? '',
    'restream.refreshToken': value.refresh_token ?? '',
  });
  // A newly connected (or refreshed) account must not read as "not connected"
  // for the rest of the cache window.
  resetStatusCache();
}

/** Access tokens last one hour. Refresh only after Restream rejects one, so we
 * never discard a still-valid token just because the box clock is inaccurate. */
async function refreshAccessToken() {
  const refreshToken = getSecret('restream.refreshToken');
  if (!refreshToken) throw new Error('Restream connection expired. Connect the account again in Settings.');
  const value = await token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  if (!value.access_token || !value.refresh_token) throw new Error('Restream did not return a new token pair. Connect the account again in Settings.');
  storeTokenPair(value);
  return value.access_token;
}
export function authorizeUrl(redirectUri, state) {
  if (!configured()) throw new Error('Save the Restream Client ID and Client Secret first');
  return `https://api.restream.io/login?${new URLSearchParams({ response_type: 'code', client_id: getSecret('restream.clientId'), redirect_uri: redirectUri, state, scope: OAUTH_SCOPES })}`;
}
/**
 * Broadcast state, shared by every caller for a few seconds.
 *
 * The `integration:restream` producer is now the only routine caller, so the
 * multiplication this originally defended against — an open route polled by
 * every dashboard on the church's own OAuth token — is gone. It stays because
 * the producer, the Settings connection check and the maintenance route can
 * still coincide, and one shared in-flight request is cheaper than three
 * identical ones. Bounded by time rather than by callers, either way.
 */
let cached = null; // { at, value } | { at, error }
let inFlight = null;
const TTL_MS = 10_000;
let platformsCache = null;
const PLATFORMS_TTL_MS = 24 * 60 * 60 * 1000;

export function status() {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.error ? Promise.reject(cached.error) : Promise.resolve(cached.value);
  }
  if (inFlight) return inFlight;
  inFlight = fetchStatus()
    .then((value) => { cached = { at: Date.now(), value }; return value; })
    .catch((err) => { cached = { at: Date.now(), error: err }; throw err; })
    .finally(() => { inFlight = null; });
  return inFlight;
}

/** Drop the cache so a freshly connected account is reflected immediately. */
export function resetStatusCache() { cached = null; }

async function fetchStatus() {
  let accessToken = getSecret('restream.accessToken');
  if (!accessToken) throw new Error('Connect a Restream account first');
  const request = async (path) => {
    let res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401) {
      accessToken = await refreshAccessToken();
      res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    }
    if (res.ok) return res.json();
    const body = await res.json().catch(() => null);
    const detail = JSON.stringify(body ?? '');
    if (res.status === 403 && /permission_required|insufficient_scope/i.test(detail)) {
      throw new Error('Restream needs the stream.read scope. Enable stream.read for this Restream app, then reconnect the account in Settings.');
    }
    const error = new Error(`Restream request failed (${res.status})`);
    error.status = res.status;
    throw error;
  };

  let data;
  try { data = await request('/user/events/in-progress'); }
  catch (err) { report(healthKey(), false, err.message); throw err; }
  report(healthKey(), true);
  const event = Array.isArray(data) ? data[0] : data.items?.[0];
  if (!event) return { connected: true, status: 'offline', title: 'No active broadcast', startedAt: null, viewers: null, channels: [] };

  // Analytics has a separate lifetime from an event: immediately after a
  // stream begins Restream can legitimately return 404 until it has a first
  // minute of audience data. That should never make the broadcast look down.
  const [channelsResult, analyticsResult] = await Promise.allSettled([
    request('/user/channel/all'),
    request(`/user/events/${encodeURIComponent(event.id)}/analytics/viewers`),
  ]);
  const availableChannels = channelsResult.status === 'fulfilled' && Array.isArray(channelsResult.value)
    ? channelsResult.value : [];
  const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : null;
  // Restream platform names are public metadata, so cache them independently
  // from the broadcast. A destination must read as “YouTube” or “Facebook”,
  // not the account-specific channel name that happens to be connected.
  if (!platformsCache || Date.now() - platformsCache.at > PLATFORMS_TTL_MS) {
    try {
      const res = await fetch(`${API}/platform/all`);
      if (res.ok) platformsCache = { at: Date.now(), value: await res.json() };
    } catch { /* Platform labels are supplementary; never hide a live event. */ }
  }
  const platformsById = new Map((platformsCache?.value ?? []).map((platform) => [String(platform.id), platform]));
  const latestViewers = (metrics) => {
    const points = metrics?.viewersPerMinute;
    return Array.isArray(points) && points.length ? Number(points.at(-1)?.viewers) || 0 : null;
  };
  const channelById = new Map(availableChannels.map((channel) => [String(channel.id), channel]));
  const destinations = Array.isArray(event.destinations) ? event.destinations : [];
  const channels = destinations.map((destination) => {
    const channel = channelById.get(String(destination.channelId));
    const platform = platformsById.get(String(destination.streamingPlatformId ?? channel?.streamingPlatformId ?? channel?.platformId));
    return {
      id: String(destination.channelId),
      name: platform?.name || `Destination ${destination.channelId}`,
      viewers: latestViewers(analytics?.byChannel?.[String(destination.channelId)]),
      url: destination.externalUrl || channel?.url || null,
      embedUrl: channel?.embedUrl || null,
    };
  });
  const preview = channels.find((channel) => channel.embedUrl || channel.url);
  return {
    connected: true,
    status: 'live',
    title: event.title ?? 'Live broadcast',
    startedAt: event.startedAt ?? null,
    viewers: latestViewers(analytics?.total),
    peakViewers: Number.isFinite(Number(analytics?.total?.max)) ? Number(analytics.total.max) : null,
    channels,
    previewEmbedUrl: preview?.embedUrl ?? null,
    previewUrl: preview?.url ?? null,
    previewImageUrl: event.coverUrl ?? null,
  };
}
