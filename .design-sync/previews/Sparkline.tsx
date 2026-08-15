import { Sparkline, Widget } from 'church-production-dashboard';

// The curve behind every trend readout. Its own source makes the important
// distinction: auto-fitting the vertical scale is right when only the SHAPE
// matters, and wrong wherever a threshold exists — a half-decibel wobble
// auto-fitted fills the box and reads as a dramatic climb. Both stories below.

const VIEWERS = [180, 210, 240, 280, 340, 420, 520, 640, 780, 910, 1040, 1180, 1284, 1250, 1210];
const SPL = [88.2, 88.9, 89.4, 90.1, 91.6, 92.4, 93.8, 95.2, 96.4, 95.1, 93.2, 92.0, 91.4, 91.8, 92.2];

export const Autofitted = () => (
  <Sparkline points={VIEWERS} label="Live viewers over the last hour" />
);

// Fixed bounds plus thresholds: the same wobble now reads as flat, and the
// curve is tinted where it crosses target and limit.
export const WithBands = () => (
  <Sparkline
    points={SPL}
    label="Loudness over the last fifteen minutes"
    bounds={{ min: 85, max: 100 }}
    bands={[
      { from: 94, tone: 'warn' },
      { from: 98, tone: 'over' },
    ]}
  />
);

export const Flat = () => (
  <Sparkline
    points={[91.9, 92.0, 91.8, 92.1, 91.9, 92.0, 92.2, 91.9, 92.0, 91.8]}
    label="A steady mix"
    bounds={{ min: 85, max: 100 }}
    bands={[{ from: 94, tone: 'warn' }]}
  />
);

export const InAWidget = () => (
  <Widget title="Loudness trend">
    <p className="wgt__value">92.2<small> dB</small></p>
    <p className="wgt__detail">target 94 · limit 98</p>
    <Sparkline
      className="wgt__spark"
      points={SPL}
      label="Loudness over the last fifteen minutes"
      bounds={{ min: 85, max: 100 }}
      bands={[{ from: 94, tone: 'warn' }, { from: 98, tone: 'over' }]}
    />
  </Widget>
);
