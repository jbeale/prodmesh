import { HelpTip, Field } from 'church-production-dashboard';

// docs/UI_TEXT: labels stay terse and supplementary detail goes in a tip, not a
// paragraph under the control. HelpTip is that tip. Its `text` doubles as the
// button's aria-label, so it reads as a sentence.
//
// THE BUBBLE NEEDS FORCING. base.css reveals it on `.helptip:hover` or
// `.helptip__btn:focus-visible` only — a static screenshot catches neither, so
// the first cut of these stories was three cards showing a bare "?" and nothing
// else. `Reveal` re-asserts the same two declarations the hover rule sets
// (opacity/visibility), which is the honest way to photograph a hover state:
// it shows the real bubble the real CSS produces, rather than a mock of it.
// The in-context story below is left un-forced, because that one is about where
// the affordance sits, not what it says.

/** Forces the hover-only bubble visible so it can be seen in a still. */
const Reveal = ({ children }: { children: React.ReactNode }) => (
  <>
    <style>{`.ds-reveal .helptip__bubble { opacity: 1 !important; visibility: visible !important; }`}</style>
    <div className="ds-reveal">{children}</div>
  </>
);

export const Default = () => (
  <Reveal>
    <div style={{ padding: '52px 120px 20px' }}>
      <HelpTip text="The machine running ProPresenter, as its Network panel reports it." />
    </div>
  </Reveal>
);

export const Below = () => (
  <Reveal>
    <div style={{ padding: '20px 120px 52px' }}>
      <HelpTip place="below" text="Rehearsal times are hidden unless the plan marks them." />
    </div>
  </Reveal>
);

// Un-forced on purpose: this story is about where the affordance sits in a
// form, which is exactly how it looks at rest.
export const NextToALabel = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <Field label="Analysis source" help="Which analyzer this room reads SPL from.">
      <input className="field" defaultValue="Smaart" />
    </Field>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      Autostart window
      <HelpTip text="How long before the service the show may start itself." />
    </span>
  </div>
);
