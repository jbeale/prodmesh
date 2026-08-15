import { HelpDrawer } from 'church-production-dashboard';

// The documentation, inside the app — a booth machine may have no route to the
// internet, which is exactly when someone needs the page explaining why Smaart
// reports no SPL.
//
// Only the OPEN state is worth a card: closed, it renders nothing. The pages
// come from a build-time virtual module, stubbed for the sync
// (.design-sync/shims/help-content.ts), so this shows the real drawer chrome —
// page list, search, article — with stand-in content.
//
// THE WRAPPER IS LOad-BEARING. `.help__scrim` is `position: fixed; inset: 0`,
// so with no containing block it resolves against the viewport and the card,
// which is measured from its mounted root, collapses to a ~30px strip (that is
// the [RENDER_BLANK] this preview first tripped). A `transform` on an ancestor
// makes that ancestor the containing block for fixed descendants — the one
// reliable way to box a fixed overlay — and the explicit height gives the
// scrim's `inset: 0` something real to resolve against.
//
// Paired with cfg.overrides.HelpDrawer {cardMode: "single", viewport: "900x620"}
// so the product renders it as one full-card cell rather than a grid column.

export const Open = () => (
  <div
    style={{
      position: 'relative',
      height: 560,
      transform: 'translateZ(0)',
      overflow: 'hidden',
      borderRadius: 8,
    }}
  >
    <HelpDrawer open onClose={() => {}} />
  </div>
);
