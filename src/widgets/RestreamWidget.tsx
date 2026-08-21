import { ExternalLink, Radio, UsersRound } from 'lucide-react';
import { integrationTopic, useTopic } from '../lib/stream';
import youtubeLogo from '../assets/integrations/youtube.png';
import facebookLogo from '../assets/integrations/facebook.png';
import type { WidgetProps } from './types';

type Channel = { id: string; name: string; viewers: number | null; url: string | null; embedUrl: string | null };
type State = {
  connected: boolean; status?: string; title?: string; startedAt?: number | null;
  viewers?: number | null; peakViewers?: number | null; channels?: Channel[];
  previewEmbedUrl?: string | null; previewUrl?: string | null; previewImageUrl?: string | null;
  error?: string; disabled?: boolean;
};

function playerUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const video = parsed.searchParams.get('v');
      if (video) return `https://www.youtube-nocookie.com/embed/${video}`;
      if (parsed.pathname.startsWith('/embed/')) return parsed.href;
    }
    if (host === 'facebook.com' || host.endsWith('.facebook.com')) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(parsed.href)}&show_text=false`;
  } catch { /* The server only sends URLs from Restream; malformed ones simply fall back. */ }
  return null;
}

function Preview({ state }: { state: State }) {
  // A preview is intentionally YouTube-only. Restream's API can list many
  // destinations, but only an active YouTube destination gives this widget a
  // consistent, embeddable viewer without guessing at another service's rules.
  const youtube = state.channels?.find((channel) => channel.name.toLowerCase().includes('youtube'));
  const embedUrl = youtube?.embedUrl || playerUrl(youtube?.url);
  if (embedUrl) return <div className="restream__preview"><iframe src={embedUrl} title="Restream live stream preview" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>;
  return null;
}

function DestinationMark({ name }: { name: string }) {
  const normalized = name.toLowerCase();
  const logo = normalized.includes('youtube') ? youtubeLogo : normalized.includes('facebook') ? facebookLogo : null;
  return logo
    ? <img className="restream__destination-mark" src={logo} alt="" />
    : <span className="restream__destination-fallback" aria-hidden>{name.slice(0, 1)}</span>;
}

export function RestreamWidget({ config }: WidgetProps) {
  // One server-side producer polls Restream while anybody is watching, on the
  // shared stream — not an interval per widget per tab (ADR 0010).
  const state = useTopic<State>(integrationTopic('restream'));
  if (!state) return <p className="wgt__empty">Checking Restream…</p>;
  if (state.disabled) return <p className="wgt__empty">Restream is disabled in Admin → Integrations.</p>;
  const status = state.status ?? 'offline';
  const live = status === 'live';
  return <section className="wgt restream">
    <div className="wgt__head"><Radio size={16} /><span className="wgt__title">Restream</span><span className={`wgt__status ${live ? 'wgt__status--live' : ''}`}>{status}</span></div>
    <strong className="pcw__title">{state.title ?? 'No active broadcast'}</strong>
    {live && <div className="restream__audience"><UsersRound size={18} /><strong>{state.viewers == null ? '—' : state.viewers.toLocaleString()}</strong><span>watching now{state.peakViewers != null ? ` · peak ${state.peakViewers.toLocaleString()}` : ''}</span></div>}
    {live && config.videoPreview && <Preview state={state} />}
    {live && state.channels?.length ? <ul className="restream__channels">{state.channels.map((channel) => <li key={channel.id}><DestinationMark name={channel.name} /><span>{channel.name}</span><strong>{channel.viewers == null ? '—' : channel.viewers.toLocaleString()}</strong>{config.destinationLinks && channel.url && <a href={channel.url} target="_blank" rel="noreferrer" aria-label={`Open ${channel.name}`}><ExternalLink size={14} /></a>}</li>)}</ul> : null}
    {!live && <p className="wgt__detail">{state.connected ? 'Restream account connected' : state.error ?? 'Connect Restream in Settings'}</p>}
  </section>;
}
