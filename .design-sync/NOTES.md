# design-sync notes — prodmesh

Repo-specific gotchas for future syncs. Read this before re-running anything.

## The shape of this repo is not the shape the converter expects

prodmesh is an **application**, not a component library. `package.json` is
`private: true` with no `main`/`module`/`exports`/`types`, and `npm run build`
(`tsc -b && vite build`) emits an app bundle with no component entry points.
Everything below follows from that.

- **`.design-sync/entry.tsx` is the library entry**, hand-written and committed.
  Pass it with `--entry`. It exports the 14 components that render from props
  alone, plus the `PreviewRouter` provider.
- **Never fall back to synth-entry mode.** With no `--entry`, the converter
  re-exports every `.tsx` under `src/` — including `src/main.tsx`, which calls
  `createRoot(document.getElementById('root')!)` at import time. In a preview
  there is no `#root`, so the bundle throws on load and *every* card comes up
  blank. This is the single most expensive trap here.
- **Adding a component to the sync = adding it to `entry.tsx` AND to
  `componentSrcMap`.** The map drives cards and props; the barrel drives the
  bundle. Miss the barrel and the card renders nothing.

## Run `flatten-css.mjs` before every build

```sh
node .design-sync/flatten-css.mjs && node .ds-sync/package-build.mjs …
```

`cfg.cssEntry` is appended to `_ds_bundle.css` **verbatim** — the converter does
not resolve that file's `@import`s or copy their targets. `src/styles/index.css`
is nothing but 18 `@import`s, so pointing `cssEntry` at it directly ships a
stylesheet where every rule is behind a dangling reference and designs render
completely unstyled. Validate does not catch it (`[CSS_IMPORT_MISSING]` only
inspects `styles.css`'s own imports, not nested ones).

The tokens route is not an alternative: `lib/css.mjs`'s `copyTokens` returns
immediately unless `cfg.tokensPkg` names a package in `node_modules`, and
prodmesh keeps tokens in `src/styles/`.

**A stylesheet added to `src/styles/index.css` after the last flatten is simply
absent from the bundle**, and the symptom is one component quietly losing its
styling rather than an error.

## Components that cannot be synced

`Tile`, `AuditoriumCard` and `SiteSection` are excluded. `Tile` imports
`tiles/registry`, which imports `../assets/companion.webp`; esbuild has no
`.webp` loader, that loader map lives in `lib/bundle.mjs`, and the skill
forbids forking that file. `AuditoriumCard` composes `Tile`, `SiteSection`
composes `AuditoriumCard`, so all three fall together. To restore them: ship
that icon as SVG or PNG (both already have loaders), or get a loader knob
upstream.

Widgets (`src/widgets/`) and the data-bound components are excluded by design —
ADR 0010 has widgets fetch their own state, and most return `null` when their
topic is empty, so in a design tool they are blank cards.

## `virtual:help-content`

`HelpDrawer` dynamically imports a Vite virtual module. `.design-sync/tsconfig.sync.json`
maps it to `.design-sync/shims/help-content.ts` via `compilerOptions.paths`.
This works **only because the specifier is non-relative** — TypeScript path
mapping never applies to relative imports, which is why the `.webp` above could
not be solved the same way.

## Preview-harness facts

- **`PreviewRouter` paints the page surface**, not just the router context.
  prodmesh is dark-only (`body { background: var(--bg); color: var(--text) }`),
  but the capture harness screenshots each card's mounted root rather than the
  body, so that rule never reaches the image. Without the wrapper every
  component that doesn't paint its own background renders near-white on white.
  Components that DO paint one (Widget, Accordion) hide the problem — put a
  bare control in any calibration set.
- **`HelpDrawer` needs the `transform` wrapper in its preview.** `.help__scrim`
  is `position: fixed; inset: 0`; with no containing block the card collapses to
  a ~30px strip (`[RENDER_BLANK]`). A `transform` on an ancestor makes it the
  containing block for fixed descendants.
- **`HelpTip`'s bubble is hover-only** (`.helptip:hover`/`:focus-visible`), so a
  still catches nothing. The preview re-asserts the same opacity/visibility the
  hover rule sets.
- **`Field`'s `width` is a grid span** — it only differentiates when several
  fields share one `FormRow`. One per row and all widths look identical.
- `Widget`, `WidgetGrid` and `ColorInput` are pinned to `cardMode: "column"`
  (they are wider than a grid cell); `HelpDrawer` to `cardMode: "single"`.

## Known render warns

Checked against this list on re-sync; anything not here is new.

- `[TOKENS_MISSING] --view-columns, --view-rows, --ch` — set inline by JS at
  runtime (ViewCanvas grid geometry, caption channel colour). Expected absent.
- `[TOKENS_MISSING] --radius-md` — **a real bug in the app**, not a sync
  artifact. `tokens.css` defines `--radius-sm`/`--radius`/`--radius-lg`/
  `--radius-xl` but never `-md`. `views.css:341` (`.viewsindex__row`) uses it
  with no fallback, so those rows render square-cornered. Flagged as a separate
  task on 2026-08-13; if it has been fixed, this warn should disappear.

## Re-sync risks

Things that can silently go stale:

- **`cfg.dtsPropsFor` is hand-written for all 14 components.** There is no
  `.d.ts` tree to extract from (`noEmit: true`), so the props the design agent
  codes against are transcribed from source and **will drift when a component's
  props change**. Nothing detects it. On any re-sync where `src/components/`
  changed, diff the changed component's signature against its `dtsPropsFor`
  entry. Fixing this properly means emitting declarations and pointing the
  converter at them.
- **The flattened stylesheet** is regenerated, not committed — but only if you
  remember to run it (see above).
- **`guidelinesGlob` is narrowed** to `docs/UI_TEXT.md` + `docs/ARCHITECTURE.md`.
  The default swept in every `docs/*.md`, including a point-in-time code review
  and device integration notes — noise in a design agent's context. A new
  design-relevant doc must be added explicitly.
- **Preview content references real prodmesh domain data** (room modes, service
  times, integration names). All IPs are TEST-NET-1 (`192.0.2.x`) per the repo
  rule; keep it that way — previews are published.
- **Toolchain assumed:** node 20, playwright 1.62.1 with chromium build 1234
  (installed into `~/Library/Caches/ms-playwright` during the first sync).
