import { Field, FormRow, SelectField, Checkbox, ColorInput } from 'church-production-dashboard';

// Field is the label/control pairing every Admin editor is built from. It
// generates the id and wires the label to whatever single control it wraps —
// which is why each story passes a real control rather than a placeholder.
//
// `help` deliberately renders as a HelpTip rather than body copy: docs/UI_TEXT
// says supplementary detail goes in a tip, not a paragraph under the label.

export const Default = () => (
  <Field label="Room name">
    <input className="field" defaultValue="Main Auditorium" />
  </Field>
);

export const WithHelp = () => (
  <Field label="ProPresenter host" help="The machine running ProPresenter. Its API port is per-machine and can change on restart unless pinned.">
    <input className="field" defaultValue="192.0.2.14" />
  </Field>
);

// `width` is a grid SPAN, so it only says anything when fields share a row.
// Laid out one per row — or in a plain column — every field takes the full
// width and all four look identical, which is a story that lies about its own
// variant axis. Side by side, the four widths are the thing you can actually
// see.
export const Widths = () => (
  <FormRow>
    <Field label="Grow" width="grow">
      <input className="field" defaultValue="Main Auditorium" />
    </Field>
    <Field label="Medium" width="md">
      <input className="field" defaultValue="bothell-main" />
    </Field>
    <Field label="Small" width="sm">
      <input className="field" defaultValue="1025" />
    </Field>
    <Field label="XS" width="xs">
      <input className="field" defaultValue="8" />
    </Field>
  </FormRow>
);

// The real shape: Fields inside a FormRow, mixing control types.
export const InAFormRow = () => (
  <FormRow card>
    <Field label="Mode" width="md">
      <SelectField defaultValue="sunday">
        <option value="sunday">Sunday</option>
        <option value="encore">Encore</option>
        <option value="standby">Standby</option>
      </SelectField>
    </Field>
    <Field label="Colour" width="xs">
      <ColorInput defaultValue="#34c759" />
    </Field>
    <Field label="Target" help="House SPL target in dB, measured at the desk." width="sm">
      <input className="field" defaultValue="94" />
    </Field>
    <Checkbox label="Standby" />
  </FormRow>
);
