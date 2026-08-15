import { Checkbox } from 'church-production-dashboard';

// Content is drawn from the real Admin editors this control appears in
// (Settings → room and show configuration), not invented — the design agent
// imitates these examples, so they should read like prodmesh.

export const Default = () => (
  <Checkbox label="Log SPL for this room" defaultChecked />
);

export const States = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Checkbox label="Follow the room's next service" defaultChecked />
    <Checkbox label="Show rehearsal times in the picker" />
    <Checkbox label="Start the show automatically" disabled defaultChecked />
    <Checkbox label="Require a PIN to end a show" disabled />
  </div>
);

export const InAForm = () => (
  <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
    <legend
      style={{
        padding: 0,
        marginBottom: 10,
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-dim)',
      }}
    >
      Autostart
    </legend>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Checkbox label="Arm 15 minutes before the service" defaultChecked />
      <Checkbox label="Only when the room is in Sunday mode" defaultChecked />
      <Checkbox label="Notify the booth when it fires" />
    </div>
  </fieldset>
);
