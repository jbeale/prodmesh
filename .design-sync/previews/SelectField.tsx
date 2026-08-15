import { SelectField, Field } from 'church-production-dashboard';

// A themed trigger around a NATIVE <select> — deliberately, so keyboard,
// screen-reader and platform picker behaviour all come for free. Options are
// plain <option> children.

export const Default = () => (
  <SelectField defaultValue="sunday">
    <option value="sunday">Sunday</option>
    <option value="encore">Encore</option>
    <option value="womens">Women's</option>
    <option value="ya">Young Adults</option>
    <option value="standby">Standby</option>
  </SelectField>
);

export const Disabled = () => (
  <SelectField defaultValue="9:30" disabled>
    <option value="9:30">9:30 AM — following the room</option>
  </SelectField>
);

export const Labelled = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Field label="Service time" width="md">
      <SelectField defaultValue="0930">
        <option value="follow">Follow the room</option>
        <option value="0930">9:30 AM</option>
        <option value="1100">11:00 AM</option>
      </SelectField>
    </Field>
    <Field label="Analysis source" help="Which analyzer this room reads SPL from." width="md">
      <SelectField defaultValue="smaart">
        <option value="smaart">Smaart</option>
        <option value="rta">ProdMesh Remote RTA</option>
        <option value="none">None</option>
      </SelectField>
    </Field>
  </div>
);
