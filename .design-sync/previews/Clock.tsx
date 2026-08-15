import { Clock, Widget } from 'church-production-dashboard';

// Wall clock for the booth. It ticks on a boundary-aligned timer rather than a
// plain interval, so the seconds do not drift. The two sizes exist because the
// same clock goes on a wall and into a 2x1 dashboard cell.

export const Default = () => <Clock />;

export const Compact = () => <Clock compact />;

export const InAWidget = () => (
  <Widget title="Time">
    <Clock />
  </Widget>
);
