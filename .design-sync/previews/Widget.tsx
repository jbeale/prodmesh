import { Widget, WidgetGrid, Sparkline } from 'church-production-dashboard';

// Widget is the dashboard card every prodmesh feature is delivered in — "a new
// feature is a new Widget dropped into the grid, not a page rewrite" (its own
// source comment). So the stories show it carrying real content rather than
// lorem: a value readout, a header action, and a full grid row.
//
// The .wgt__* classes used here for the inner content are prodmesh's own
// (widgets.css / show.css); they are what the real widgets use, so the agent
// copying this example gets on-brand internals too.

export const Default = () => (
  <Widget title="Current viewers">
    <p className="wgt__value">1,284</p>
    <p className="wgt__detail">peak 1,502 · avg 1,180</p>
  </Widget>
);

export const WithMeta = () => (
  <Widget
    title="Loudness"
    meta={
      <span className="wgt__status wgt__status--live">
        <span className="wgt__dot" aria-hidden /> Live
      </span>
    }
  >
    <p className="wgt__value">
      92.4<small> dB</small>
    </p>
    <p className="wgt__detail">target 94 · limit 98</p>
  </Widget>
);

export const WithSparkline = () => (
  <Widget title="Loudness trend">
    <p className="wgt__value">
      91.8<small> dB</small>
    </p>
    <Sparkline
      className="wgt__spark"
      label="Loudness over the last fifteen minutes"
      points={[88, 89, 90.5, 92, 91, 93, 94.5, 96, 95, 93.5, 92, 91.8]}
      bounds={{ min: 85, max: 100 }}
      bands={[
        { from: 94, tone: 'warn' },
        { from: 98, tone: 'over' },
      ]}
    />
  </Widget>
);

// The grid is the other half of the contract: spans only take effect at
// >=880px, and everything collapses to one column below that.
export const Grid = () => (
  <WidgetGrid>
    <Widget title="Room mode" span="third">
      <p className="wgt__value">Sunday</p>
    </Widget>
    <Widget title="Current viewers" span="third">
      <p className="wgt__value">1,284</p>
    </Widget>
    <Widget title="Clock" span="third">
      <p className="wgt__value">10:42:07</p>
    </Widget>
  </WidgetGrid>
);
