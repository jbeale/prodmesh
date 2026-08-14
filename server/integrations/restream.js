import { getSecret, setSecrets } from '../secrets.js';
import { report } from '../health.js';

const TOKEN_URL = 'https://api.restream.io/oauth/token';
const API = 'https://api.restream.io/v2';
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
  setSecrets({ 'restream.accessToken': value.access_token ?? '', 'restream.refreshToken': value.refresh_token ?? '' });
}
export function authorizeUrl(redirectUri, state) {
  if (!configured()) throw new Error('Save the Restream Client ID and Client Secret first');
  return `https://api.restream.io/login?${new URLSearchParams({ response_type: 'code', client_id: getSecret('restream.clientId'), redirect_uri: redirectUri, state })}`;
}
export async function status() {
  const accessToken = getSecret('restream.accessToken');
  if (!accessToken) throw new Error('Connect a Restream account first');
  const res = await fetch(`${API}/user/events/in-progress`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) { report(healthKey(), false, `Restream HTTP ${res.status}`); throw new Error(`Restream request failed (${res.status})`); }
  report(healthKey(), true);
  const data = await res.json(); const event = Array.isArray(data) ? data[0] : data.items?.[0];
  return { connected: true, status: event ? 'live' : 'offline', title: event?.title ?? 'No active broadcast', startedAt: event?.startedAt ?? null };
}
