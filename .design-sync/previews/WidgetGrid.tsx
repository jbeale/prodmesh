import { WidgetGrid, Widget, Sparkline, Clock } from 'church-production-dashboard';

// The 12-column grid dashboard pages compose Widgets into. Spans apply at
// >=880px and everything collapses to a single column below that, which is why
// a widget never has to know about breakpoints.

export const ThreeUp = () => (
  <WidgetGrid>
    <Widget title="Room mode" span="third">
      <p className="wgt__value">Sunday</p>
    </Widget>
    <Widget title="Current viewers" span="third">
      <p className="wgt__value">1,284</p>
      <p className="wgt__detail">peak 1,502</p>
    </Widget>
    <Widget title="Time" span="third">
      <Clock compact />
    </Widget>
  </WidgetGrid>
);

export const MixedSpans = () => (
  <WidgetGrid>
    <Widget title="Loudness trend" span="two-thirds">
      <p className="wgt__value">92.2<small> dB</small></p>
      <Sparkline
        className="wgt__spark"
        label="Loudness over the last fifteen minutes"
        points={[88, 89, 90.5, 92, 91, 93, 94.5, 96, 95, 93.5, 92, 92.2]}
        bounds={{ min: 85, max: 100 }}
        bands={[{ from: 94, tone: 'warn' }, { from: 98, tone: 'over' }]}
      />
    </Widget>
    <Widget title="Current viewers" span="third">
      <p className="wgt__value">1,284</p>
    </Widget>
    <Widget title="Next service" span="half">
      <p className="wgt__value">9:30 AM</p>
      <p className="wgt__detail">in 42 minutes</p>
    </Widget>
    <Widget title="Room mode" span="half">
      <p className="wgt__value">Sunday</p>
    </Widget>
  </WidgetGrid>
);
