// Stand-in for the `virtual:help-content` Vite module, for the Claude Design
// sync only. Never imported by the app.
//
// The real module is generated at build time by vite-plugin-help.ts, which
// renders docs/wiki/*.md to HTML. esbuild has no Vite plugin pipeline, so
// bundling HelpDrawer without this fails at `Could not resolve
// "virtual:help-content"`. Mapped in .design-sync/tsconfig.sync.json via
// compilerOptions.paths — which works here only because the specifier is
// non-relative; TypeScript path mapping never applies to relative imports.
//
// Two sample pages rather than an empty array: HelpDrawer renders its page list
// and the current article from this data, so an empty array would produce a
// technically-correct card of an empty drawer.

export default [
  {
    slug: 'index',
    title: 'Getting started',
    html:
      '<h1>Getting started</h1>' +
      '<p>prodmesh runs on the church network and is reached from any browser ' +
      'in the building. Pick a room to see its mode, run of show and levels.</p>' +
      '<h2>Rooms</h2>' +
      '<p>Each room carries its own integrations — ProPresenter, Companion, an ' +
      'analyzer — configured under Admin.</p>',
    text:
      'getting started prodmesh runs on the church network and is reached from ' +
      'any browser in the building. pick a room to see its mode, run of show ' +
      'and levels. rooms each room carries its own integrations.',
  },
  {
    slug: 'run-of-show',
    title: 'Run of show',
    html:
      '<h1>Run of show</h1>' +
      '<p>The order of service from Planning Center, with the item that is live ' +
      'now and the controls to move it along.</p>',
    text:
      'run of show the order of service from planning center, with the item ' +
      'that is live now and the controls to move it along.',
  },
];
