import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import type { WidgetProps } from './types';

type State = { connected: boolean; status: string; title?: string; startedAt?: number | null; error?: string };
export function RestreamWidget(_props: WidgetProps) {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => { let live = true; const load = () => fetch('/api/integrations/restream/status').then((r) => r.json()).then((s) => live && setState(s)).catch(() => live && setState({ connected: false, status: 'offline', error: 'Restream is unavailable' })); load(); const timer = setInterval(load, 15000); return () => { live = false; clearInterval(timer); }; }, []);
  if (!state) return <p className="wgt__empty">Checking Restream…</p>;
  return <section className="wgt"><div className="wgt__head"><Radio size={16} /><span className="wgt__title">Restream</span><span className={`wgt__status ${state.status === 'live' ? 'wgt__status--live' : ''}`}>{state.status}</span></div><strong className="pcw__title">{state.title ?? 'No active broadcast'}</strong><p className="wgt__detail">{state.connected ? 'Restream account connected' : state.error ?? 'Connect Restream in Settings'}</p></section>;
}
