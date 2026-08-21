import type { AnalysisSource } from '../api';
import type { IntegrationId } from '../components/IntegrationBrand';
import type { WidgetType } from '../widgets/types';

/** Public-facing identity for the room's configured SPL provider. */
export function analysisIntegration(source: AnalysisSource | null | undefined): IntegrationId {
  if (source === 'smaart') return 'smaart';
  if (source === 'rta') return 'prodmesh-rta';
  if (source === 'open-sound-meter') return 'open-sound-meter';
  return 'analysis';
}

export function analysisWidgetTitle(type: WidgetType, source: AnalysisSource | null | undefined): string | null {
  if (type !== 'loudness' && type !== 'loudness-trend') return null;
  const suffix = type === 'loudness' ? 'Decibel Meter' : 'Trend';
  if (source === 'smaart') return `Smaart ${suffix}`;
  if (source === 'rta') return `ProdMesh RTA ${suffix}`;
  if (source === 'open-sound-meter') return `Open Sound Meter ${suffix}`;
  // Keep the audio widgets discoverable before a campus selects a provider.
  // The picker blocks their addition until then, but hiding them entirely made
  // it look as if the Audio integration had no widgets at all.
  return `Audio ${suffix}`;
}
