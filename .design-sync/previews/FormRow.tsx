import { FormRow, Field, SelectField, Checkbox } from 'church-production-dashboard';

// The row Admin editors are laid out in — a grid that keeps labels and controls
// aligned across rows. `card` raises it onto its own surface, which is how
// repeated rows (one per room, one per mode) are separated.

export const Default = () => (
  <FormRow>
    <Field label="Label" width="md">
      <input className="field" defaultValue="Sunday" />
    </Field>
    <Field label="Id" width="md">
      <input className="field" defaultValue="sunday" />
    </Field>
  </FormRow>
);

export const AsCard = () => (
  <FormRow card>
    <Field label="Label" width="md">
      <input className="field" defaultValue="Women's" />
    </Field>
    <Field label="Id" width="md">
      <input className="field" defaultValue="womens" />
    </Field>
    <Checkbox label="Standby mode" />
  </FormRow>
);

// Stacked cards are the real pattern: a list of modes or rooms, each editable.
export const Stacked = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <FormRow card>
      <Field label="Mode" width="md">
        <input className="field" defaultValue="Sunday" />
      </Field>
      <Field label="Colour" width="sm">
        <input className="field" defaultValue="#34c759" />
      </Field>
      <Checkbox label="Standby" />
    </FormRow>
    <FormRow card>
      <Field label="Mode" width="md">
        <input className="field" defaultValue="Encore" />
      </Field>
      <Field label="Colour" width="sm">
        <input className="field" defaultValue="#ff9f0a" />
      </Field>
      <Checkbox label="Standby" />
    </FormRow>
    <FormRow card>
      <Field label="Mode" width="md">
        <input className="field" defaultValue="Standby" />
      </Field>
      <Field label="Colour" width="sm">
        <input className="field" defaultValue="#8b97a8" />
      </Field>
      <Checkbox label="Standby" defaultChecked />
    </FormRow>
  </div>
);
