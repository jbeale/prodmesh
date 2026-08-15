// Library entry for the Claude Design sync — NOT part of the app build.
//
// prodmesh ships an application, not a component library: `npm run build` emits
// an app bundle with no component entry points. The converter's fallback is to
// synthesize an entry by re-exporting every .tsx under src/, and that is a trap
// here — src/main.tsx calls createRoot(document.getElementById('root')!) at
// import time, so loading such a bundle inside a preview card throws before any
// component renders and every card comes up blank.
//
// So the entry is explicit. It names the components that render correctly with
// no API, no SSE stream and no router state behind them. Everything omitted is
// omitted on purpose:
//
//   · Widgets (src/widgets/) fetch their own state by design — ADR 0010 — and
//     most deliberately return null when their topic has no data. In a design
//     tool they are blank cards that look broken.
//   · Tile, and AuditoriumCard/SiteSection which compose it, reach
//     tiles/registry, which imports a .webp icon. esbuild has no loader for
//     .webp and lib/bundle.mjs — which owns that loader map — is not ours to
//     fork. Tile is app-coupled anyway: its behaviour and icon come from the
//     registry rather than from props. Restoring all three needs either a
//     loader knob upstream or the icon inlined as an SVG/PNG.
//   · The data-bound components (RoomCard, ServicePanel, OrderOfService,
//     PersonPicker, ShowConfigWidget, AssistanceBar/Dialog, IdentityDialog)
//     read the same topics or hit /api.
//
// Adding one here is only safe if it renders from props alone.

export { Accordion } from '../src/components/Accordion';
export { Checkbox } from '../src/components/Checkbox';
export { Clock } from '../src/components/Clock';
export { HelpDrawer, HelpIcon } from '../src/components/HelpDrawer';
export { HelpTip } from '../src/components/HelpTip';
export { SelectField } from '../src/components/SelectField';
export { Sparkline } from '../src/components/Sparkline';
export { Widget, WidgetGrid } from '../src/components/Widget';

export { ColorInput } from '../src/components/form/ColorInput';
export { EditorSection } from '../src/components/form/EditorSection';
export { Field } from '../src/components/form/Field';
export { FormRow } from '../src/components/form/FormRow';

// ── Preview provider ────────────────────────────────────────────────────────
//
// Does two jobs, both of which every card needs.
//
// 1. ROUTER. Some components render a react-router <Link>, which throws outside
//    a router. The app mounts a BrowserRouter in main.tsx; a preview card has
//    no history to own, so MemoryRouter is the honest equivalent — same
//    context, no URL side effects.
//
// 2. THE PAGE SURFACE. prodmesh is a dark-only design system: base.css puts
//    `background: var(--bg); color: var(--text)` on <body>, and --text is
//    near-white (#edf2f7). The capture harness screenshots each card's mounted
//    ROOT rather than the body, so that rule never reaches the image — and any
//    component that doesn't paint its own background (Checkbox, Field, FormRow,
//    SelectField, HelpTip, Clock…) renders near-white text on white and is
//    invisible. Components that DO paint one (Widget, Accordion) looked fine
//    and hid the problem, which is why the calibration set has to include a
//    bare control.
//
//    Restating the body rule here is not decoration: it is the surface these
//    components are designed against, and without it the cards misrepresent
//    the system to everyone browsing them.
//
// Exported from the bundle because cfg.provider.component must resolve to a
// bundle export.
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

export function PreviewRouter({ children }: { children?: ReactNode }) {
  return (
    <MemoryRouter>
      <div
        style={{
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
          padding: 16,
          minHeight: '100%',
        }}
      >
        {children}
      </div>
    </MemoryRouter>
  );
}
