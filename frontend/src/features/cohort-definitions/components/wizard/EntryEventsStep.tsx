import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";

export function EntryEventsStep() {
  const { entryConcepts, addEntryConcept, removeEntryConcept, updateEntryConceptOptions } =
    useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          Step 1 of 3 — Entry Events
        </div>
        <p className="text-[13px] text-text-muted">
          Search for the diagnoses, procedures, medications, or other events that define when
          a patient enters your cohort. You can add multiple entry events — a patient matching{" "}
          <em>any</em> of them qualifies.
        </p>
      </div>

      <WizardConceptPicker
        concepts={entryConcepts}
        onAdd={(concept, domain) => addEntryConcept(concept, domain)}
        onRemove={removeEntryConcept}
        onUpdateOptions={updateEntryConceptOptions}
        showFirstOccurrence
        prompt="Search conditions, drugs, procedures..."
      />
    </div>
  );
}
