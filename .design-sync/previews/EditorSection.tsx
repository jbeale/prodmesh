import { EditorSection, FormRow, Field, SelectField, Checkbox } from 'church-production-dashboard';

// The frame every Admin editor sits in: title, optional help, a status slot,
// and a save button driven by the draft state machine from useDraft().
//
// `form` is that machine. The previews pass plain objects because the shape is
// the contract — dirty/busy/err/savedFlash decide what the button says, and
// showing all four is the point of the story set.

const idle = { dirty: false, busy: false, err: '', savedFlash: false, submit: async () => {} };

export const Saved = () => (
  <EditorSection title="ProPresenter" saveLabel="Save" form={idle}>
    <FormRow>
      <Field label="Host" width="md"><input className="field" defaultValue="192.0.2.14" /></Field>
      <Field label="Port" width="sm"><input className="field" defaultValue="1025" /></Field>
    </FormRow>
  </EditorSection>
);

export const Dirty = () => (
  <EditorSection
    title="ProPresenter"
    help="The API port is per-machine and can change on restart unless pinned."
    saveLabel="Save"
    form={{ ...idle, dirty: true }}
  >
    <FormRow>
      <Field label="Host" width="md"><input className="field" defaultValue="192.0.2.14" /></Field>
      <Field label="Port" width="sm"><input className="field" defaultValue="62202" /></Field>
    </FormRow>
  </EditorSection>
);

export const Saving = () => (
  <EditorSection title="Companion" saveLabel="Save" form={{ ...idle, dirty: true, busy: true }}>
    <FormRow>
      <Field label="Host" width="md"><input className="field" defaultValue="192.0.2.31" /></Field>
    </FormRow>
  </EditorSection>
);

export const WithError = () => (
  <EditorSection
    title="Captions"
    saveLabel="Save"
    status={<span className="wgt__status wgt__status--down">Not connected</span>}
    form={{ ...idle, dirty: true, err: 'That host did not answer on port 8518.' }}
  >
    <FormRow>
      <Field label="Caption app" width="md">
        <SelectField defaultValue="prodmesh">
          <option value="prodmesh">ProdMesh Caption</option>
          <option value="prodcom">ProdCom</option>
        </SelectField>
      </Field>
      <Field label="Host" width="md"><input className="field" defaultValue="192.0.2.60" /></Field>
      <Checkbox label="Show on the stage display" defaultChecked />
    </FormRow>
  </EditorSection>
);
