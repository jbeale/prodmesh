// Flatten src/styles/index.css into one stylesheet for the Claude Design sync.
//
// WHY THIS EXISTS. The converter appends cfg.cssEntry to _ds_bundle.css
// VERBATIM — it does not resolve that file's own @import statements, and it
// does not copy the files they point at. prodmesh's index.css is nothing but
// an ordered list of 18 @imports, so pointing cssEntry straight at it ships a
// stylesheet whose every rule is behind a dangling reference: designs render
// completely unstyled, and nothing downstream catches it (validate's
// [CSS_IMPORT_MISSING] only inspects styles.css's own imports, not nested ones).
//
// The tokens route is not an alternative: lib/css.mjs's copyTokens returns
// immediately unless cfg.tokensPkg names a package inside node_modules, and
// prodmesh keeps its tokens in src/styles/, not in a package.
//
// So we concatenate, in exactly the order index.css lists — which is the order
// the browser would apply them in, and an order that file's own comment calls
// load-bearing ("tokens first, then base, then shell and features").
//
// RE-SYNC: run this BEFORE package-build.mjs. A stylesheet added to
// src/styles/index.css after the last flatten is simply absent from the bundle,
// and the symptom is one component silently losing its styling rather than an
// error. See .design-sync/NOTES.md.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENTRY = join(ROOT, 'src/styles/index.css');
const OUT = join(ROOT, '.design-sync/.cache/styles.flat.css');

const IMPORT_RX = /^\s*@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/;

const seen = new Set();
const chunks = [];

/** Depth-first, so an @import inside an imported file lands in the right place.
 *  `seen` makes a diamond import appear once — CSS would apply it twice
 *  harmlessly, but duplicate :root blocks make the output hard to read. */
function inline(file) {
  const abs = resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);
  if (!existsSync(abs)) {
    console.error(`✗ missing: ${abs}`);
    process.exitCode = 1;
    return;
  }
  const out = [];
  for (const line of readFileSync(abs, 'utf8').split('\n')) {
    const m = IMPORT_RX.exec(line);
    // Remote @imports (a font host) stay as-is — they resolve at runtime and
    // there is nothing local to inline. prodmesh has none today; this is here
    // so adding one degrades to "still works" rather than "silently dropped".
    if (m && !/^(https?:)?\/\//.test(m[1])) {
      inline(join(dirname(abs), m[1]));
      continue;
    }
    out.push(line);
  }
  chunks.push(`/* ── ${abs.slice(ROOT.length + 1)} ${'─'.repeat(Math.max(0, 60 - abs.length + ROOT.length))} */\n${out.join('\n')}`);
}

inline(ENTRY);
mkdirSync(dirname(OUT), { recursive: true });
const css = chunks.join('\n\n');
writeFileSync(OUT, css);
console.error(`flatten-css: ${seen.size} files → ${(css.length / 1024).toFixed(0)} KB → ${OUT.slice(ROOT.length + 1)}`);
if (/^\s*@import\s+['"]\./m.test(css)) {
  console.error('✗ a relative @import survived — the bundle would ship a dangling reference');
  process.exitCode = 1;
}
