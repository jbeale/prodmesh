import { useMemo, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';
import { ViewCanvas } from './ViewCanvas';
import { WidgetPalette, paletteFor } from './WidgetPalette';
import { useGridDrag, type Cell } from './useGridDrag';
import { findFirstFit, isFree, occupancy, rowCount, type Grid } from '../lib/gridLayout';
import { widgetRegistry, isWidgetType } from '../widgets/registry';
import { widgetMax, widgetMin, widgetResizable, type WidgetSize } from '../widgets/types';
import type { View, ViewPlacement } from '../api';

// ─────────────────────────────────────────────────────────────────────────────
//  Arranging a view.
//
//  The canvas is the SAME ViewCanvas the live page renders, with `chrome`
//  passed per cell. One renderer means the editor's preview cannot drift from
//  what a screen in the building actually shows — which is the failure mode of
//  every layout editor that draws its own approximation.
//
//  Widgets stay LIVE while you arrange them: a ticking countdown, a real SPL
//  meter. Only the header strip is interactive, and the body is inert via CSS.
//  Solving that with a prop would have meant widening WidgetProps, and that
//  contract being narrow is the whole reason a layout can be data.
// ─────────────────────────────────────────────────────────────────────────────

const ARROWS: Record<string, Cell> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export function ViewEditor({
  view,
  grid,
  onChange,
}: {
  view: View;
  grid: Grid;
  onChange: (widgets: ViewPlacement[]) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  // Which card is in keyboard "grab" mode, and what the last move announced.
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [announcement, setAnnounce] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const placements = view.widgets;

  // ONE row count for the canvas and the pointer maths. A dashboard normally
  // sizes to its content, which would leave the editor dividing by rows the
  // browser never drew — the drop then lands wherever that arithmetic says,
  // which is not where the cursor is. A row of headroom past the deepest
  // widget is what lets a dashboard be extended by dropping below it.
  const rows =
    grid.maxRows ?? Math.max(rowCount(grid, placements) + 1, grid.defaultRows ?? 1);
  const palette = useMemo(() => paletteFor(view.kind, grid, placements), [view.kind, grid, placements]);

  const place = (type: string, at: Cell) => {
    const def = isWidgetType(type) ? widgetRegistry[type] : null;
    if (!def) return;
    onChange([
      ...placements,
      { id: `new-${type}-${placements.length}`, type, ...at, ...def.size, config: {} },
    ]);
  };

  const moveTo = (id: string, at: Cell) =>
    onChange(placements.map((p) => (p.id === id ? { ...p, ...at } : p)));

  const remove = (id: string) => {
    onChange(placements.filter((p) => p.id !== id));
    if (grabbed === id) setGrabbed(null);
  };

  const resizeTo = (id: string, size: WidgetSize) =>
    onChange(placements.map((p) => (p.id === id ? { ...p, ...size } : p)));

  const setConfig = (id: string, patch: Record<string, unknown>) =>
    onChange(placements.map((p) => (p.id === id ? { ...p, config: { ...p.config, ...patch } } : p)));

  /** How far a widget may be stretched — the server enforces the same bounds. */
  const boundsFor = (type: string) => {
    const def = isWidgetType(type) ? widgetRegistry[type] : null;
    return def
      ? { min: widgetMin(def), max: widgetMax(def) }
      : { min: { w: 1, h: 1 }, max: { w: 1, h: 1 } };
  };

  const { drag, addHandlers, moveHandlers, resizeHandlers } = useGridDrag({
    canvas,
    grid,
    placements,
    onAdd: place,
    onMove: moveTo,
    onResize: resizeTo,
  });

  const addFromPalette = (type: string) => {
    const def = isWidgetType(type) ? widgetRegistry[type] : null;
    const at = def && findFirstFit(grid, placements, def.size);
    if (!at || !def) return;
    place(type, at);
    setAnnounce(`${def.title} added at column ${at.x + 1}, row ${at.y + 1}.`);
  };

  const titleOf = (type: string) =>
    isWidgetType(type) ? widgetRegistry[type].title : type;

  /** Arrow-key movement for the grabbed card. Refuses rather than shoves. */
  const nudge = (placement: ViewPlacement, delta: Cell) => {
    const next = { x: placement.x + delta.x, y: placement.y + delta.y };
    const title = titleOf(placement.type);
    const cells = occupancy(placements, placement.id);
    if (!isFree(grid, cells, { ...next, w: placement.w, h: placement.h })) {
      setAnnounce(`${title} cannot move there.`);
      return;
    }
    moveTo(placement.id, next);
    setAnnounce(`${title} at column ${next.x + 1}, row ${next.y + 1}.`);
  };

  /** Shift+arrow stretches it, within what the widget declares. */
  const stretch = (placement: ViewPlacement, delta: Cell) => {
    const title = titleOf(placement.type);
    const { min, max } = boundsFor(placement.type);
    const size = {
      w: Math.max(min.w, Math.min(placement.w + delta.x, max.w)),
      h: Math.max(min.h, Math.min(placement.h + delta.y, max.h)),
    };
    if (size.w === placement.w && size.h === placement.h) {
      setAnnounce(`${title} cannot be resized further.`);
      return;
    }
    if (!isFree(grid, occupancy(placements, placement.id), { x: placement.x, y: placement.y, ...size })) {
      setAnnounce(`${title} cannot grow there.`);
      return;
    }
    resizeTo(placement.id, size);
    setAnnounce(`${title} is now ${size.w} by ${size.h}.`);
  };

  const chromeFor = (placement: ViewPlacement) => {
    const title = titleOf(placement.type);
    const held = grabbed === placement.id;
    const def = isWidgetType(placement.type) ? widgetRegistry[placement.type] : null;
    const resizable = def ? widgetResizable(def) : false;
    return (
      <div className="viewcell__chrome">
        <button
          type="button"
          className="viewcell__grip"
          aria-pressed={held}
          aria-label={
            `Move ${title}, column ${placement.x + 1}, row ${placement.y + 1}` +
            (resizable ? `, ${placement.w} by ${placement.h}` : '')
          }
          title={
            resizable
              ? 'Drag to move. Enter then arrows to move, shift+arrows to resize'
              : 'Drag to move, or press Enter and use the arrow keys'
          }
          {...moveHandlers(placement)}
          onClick={() => setSelected(placement.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setGrabbed(held ? null : placement.id);
              setAnnounce(held ? `${title} placed.` : `${title} grabbed. Use the arrow keys.`);
            } else if (e.key === 'Escape' && held) {
              setGrabbed(null);
              setAnnounce(`${title} placed.`);
            } else if (held && ARROWS[e.key]) {
              e.preventDefault();
              if (e.shiftKey) stretch(placement, ARROWS[e.key]);
              else nudge(placement, ARROWS[e.key]);
            }
          }}
        >
          <GripVertical size={14} aria-hidden />
          <span className="viewcell__name">{title}</span>
        </button>
        <button
          type="button"
          className="viewcell__remove"
          aria-label={`Remove ${title}`}
          onClick={() => remove(placement.id)}
        >
          <X size={14} />
        </button>

        {/* Every widget can grow in both directions within the shared layout
            range; the server applies the exact same bounds on save. */}
        {resizable && (
          <span
            className="viewcell__resize"
            title={`Drag to resize (${widgetMin(def!).w}–${widgetMax(def!).w} columns, ${widgetMin(def!).h}–${widgetMax(def!).h} rows)`}
            aria-hidden
            {...resizeHandlers(placement, boundsFor(placement.type))}
          />
        )}
      </div>
    );
  };

  // The drop shadow. Drawn inside the grid so it lands on real cells rather
  // than on a pixel guess about where they are.
  const ghost = drag.kind !== 'none' && drag.at && (
    <div
      className={`viewghost viewghost--${drag.kind}${drag.ok ? '' : ' viewghost--blocked'}`}
      style={{
        gridColumn: `${drag.at.x + 1} / span ${drag.size.w}`,
        gridRow: `${drag.at.y + 1} / span ${drag.size.h}`,
      }}
      aria-hidden
    />
  );

  return (
    <div className="vieweditor">
      <WidgetPalette entries={palette} onAdd={addFromPalette} dragHandlers={addHandlers} />

      <div className="vieweditor__canvas">
        {view.kind === 'display' ? (
          <div className="viewframe">
            <ViewCanvas
              view={{ ...view, widgets: placements }}
              grid={grid}
              config={{}}
              rows={rows}
              canvasRef={canvas}
              className="viewgrid--editing"
              chromeFor={chromeFor}
              overlay={ghost}
            />
          </div>
        ) : (
          <ViewCanvas
            view={{ ...view, widgets: placements }}
            grid={grid}
            config={{}}
            rows={rows}
            canvasRef={canvas}
            className="viewgrid--editing"
            chromeFor={chromeFor}
            overlay={ghost}
          />
        )}
        {placements.length === 0 && (
          <p className="vieweditor__hint">Add a widget from the list, or drag one onto the grid.</p>
        )}
      </div>

      <WidgetInspector placement={placements.find((p) => p.id === selected) ?? null} onChange={setConfig} />

      {/* Every keyboard move says where it landed, or that it refused. */}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}

/** Settings live beside the canvas, never inside a small widget cell. */
function WidgetInspector({ placement, onChange }: { placement: ViewPlacement | null; onChange: (id: string, patch: Record<string, unknown>) => void }) {
  const pp = placement && (placement.type === 'propresenter-playlist' || placement.type === 'propresenter-controls');
  return <aside className="widgetinspector"><h2>Widget settings</h2>{!placement ? <p>Select a widget to configure it.</p> : !pp ? <p><strong>{placement.type}</strong><br />This widget has no settings.</p> : <><p className="widgetinspector__name">{placement.type === 'propresenter-playlist' ? 'ProPresenter Playlist' : 'ProPresenter Controls'}</p><label className="widgetinspector__check"><input type="checkbox" checked={Boolean(placement.config.slideControls)} onChange={(event) => onChange(placement.id, { slideControls: event.target.checked })} /> Enable slide controls</label>{placement.type === 'propresenter-playlist' && <><label className="widgetinspector__check"><input type="checkbox" checked={Boolean(placement.config.keyboardControls)} onChange={(event) => onChange(placement.id, { keyboardControls: event.target.checked })} /> Enable arrow keys and spacebar</label><label className="widgetinspector__check"><input type="checkbox" checked={Boolean(placement.config.followActive)} onChange={(event) => onChange(placement.id, { followActive: event.target.checked })} /> Follow active cue</label><label>Slide display<select value={placement.config.slideMode ?? 'image'} onChange={(event) => onChange(placement.id, { slideMode: event.target.value })}><option value="image">Rendered previews</option><option value="text">Slide text</option></select></label><label>Slide width (px)<input type="number" min="0" max="200" step="1" value={placement.config.slideSize ?? 60} onChange={(event) => onChange(placement.id, { slideSize: Number(event.target.value) })} /><small>0–200 px. Lower values fit more cues across; 0 uses a safe 32 px rendering floor.</small></label></>}</>}</aside>;
}
