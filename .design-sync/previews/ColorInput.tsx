import { ColorInput, Field, FormRow } from 'church-production-dashboard';

// A themed <input type="color">. It appears wherever a room mode's colour is
// set — that colour then drives the mode chip everywhere in the app, so the
// stories use the real mode palette from the seed topology.

export const Default = () => <ColorInput defaultValue="#34c759" />;

export const ModePalette = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <ColorInput defaultValue="#34c759" aria-label="Sunday" />
    <ColorInput defaultValue="#ff9f0a" aria-label="Encore" />
    <ColorInput defaultValue="#ff6fae" aria-label="Women's" />
    <ColorInput defaultValue="#32ade6" aria-label="Young Adults" />
    <ColorInput defaultValue="#af7bf0" aria-label="Event" />
    <ColorInput defaultValue="#8b97a8" aria-label="Standby" />
  </div>
);

export const InAField = () => (
  <FormRow card>
    <Field label="Mode" width="md">
      <input className="field" defaultValue="Sunday" />
    </Field>
    <Field label="Colour" help="Shown on the wall panel and every room card." width="xs">
      <ColorInput defaultValue="#34c759" />
    </Field>
  </FormRow>
);
