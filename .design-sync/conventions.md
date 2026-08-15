## Building with prodmesh

prodmesh is the production dashboard for a church booth: room control, run of
show, service data and SPL, on machines in a control room and on screens people
read from across a stage. Design for that — dense, legible at distance, calm.

### Dark only, and the page owns the surface

There is no light theme. `base.css` puts `background: var(--bg)` and
`color: var(--text)` on `<body>`, and **most components do not paint their own
background** — they inherit it. If you build a screen on a white page, every
label renders near-white on white and disappears.

So set the surface once, at the root of anything you build:

```jsx
<div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100%' }}>
  {/* … */}
</div>
```

No provider, theme object or context is required beyond that — the tokens are
plain CSS custom properties in the stylesheet.

### The styling idiom: tokens plus a global class vocabulary

Not utility classes, not style props. Two things:

**1. `var(--token)` for every colour, radius and font.** Never a hex literal —
`tokens.css` is explicitly "the single place colors, radii, and accents live".

| | |
|---|---|
| Surfaces | `--bg` `--bg-sidebar` `--bg-raised` `--bg-tile` `--bg-tile-hover` |
| Lines | `--border` `--border-subtle` `--border-strong` |
| Text | `--text` `--text-dim` `--text-faint` `--text-on-accent` |
| Accent | `--accent` `--accent-hover` `--accent-text` `--accent-soft` `--accent-border` |
| Status | `--ok` `--warn` `--warn-text` `--danger` — each with `-soft`/`-border` variants |
| Shape | `--radius-sm` `--radius` `--radius-lg` `--radius-xl` |
| Type | `--font-ui` `--font-mono` |

(There is no `--radius-md`, despite a few stylesheets referencing it. Use
`--radius` or `--radius-lg`.)

**2. Real class names from the shipped stylesheet** for the parts that are CSS
rather than components. The ones worth knowing:

- `.wgt` `.wgt__value` `.wgt__detail` `.wgt__status` `.wgt__dot` — the inside of
  a dashboard card. `Widget` gives you the frame; these style its contents.
- `.field` — the input styling `Field` expects on the control it wraps.
- `.btn`, `.btn--primary`, `.btn--danger` — buttons (there is no Button
  component; buttons are a class on `<button>`).
- `.chip`, `.mono`, `.sr-only`.

### Copy style is part of the system

`guidelines/docs/UI_TEXT.md` is short and binding: terse labels, supplementary
detail in a `HelpTip` rather than a paragraph, no intro copy above a page. Read
it before writing any label.

### Where the truth lives

`_ds/<folder>/styles.css` and its import closure is the real stylesheet — every
token and class above is defined there, and reading it beats any summary. Each
component's `.d.ts` is its API contract and its `.prompt.md` its usage notes.

### An idiomatic screen

```jsx
<div style={{ background: 'var(--bg)', color: 'var(--text)', padding: 24 }}>
  <WidgetGrid>
    <Widget title="Loudness" span="third"
      meta={<span className="wgt__status wgt__status--live">
              <span className="wgt__dot" aria-hidden /> Live
            </span>}>
      <p className="wgt__value">92.4<small> dB</small></p>
      <p className="wgt__detail">target 94 · limit 98</p>
    </Widget>

    <Widget title="Loudness trend" span="two-thirds">
      <Sparkline className="wgt__spark" label="Loudness over fifteen minutes"
        points={[88, 90, 92, 95, 96, 93, 92]}
        bounds={{ min: 85, max: 100 }}
        bands={[{ from: 94, tone: 'warn' }, { from: 98, tone: 'over' }]} />
    </Widget>
  </WidgetGrid>

  <FormRow card>
    <Field label="Room" width="md"><input className="field" defaultValue="Main Auditorium" /></Field>
    <Field label="Target" help="House SPL target in dB." width="sm">
      <input className="field" defaultValue="94" />
    </Field>
    <Checkbox label="Log SPL" defaultChecked />
  </FormRow>
</div>
```

`Field`'s `width` is a grid span — it only means anything when fields share a
`FormRow`. One field per row always fills the row.
