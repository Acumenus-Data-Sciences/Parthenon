import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";

export function CensoringStep() {
  const { censoringConcepts, addCensoringConcept, removeCensoringConcept } =
    useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#C5C0B8]">
          Censoring Events{" "}
          <span className="text-[11px] text-[#5A5650]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#8A857D]">
          Are there specific events that should end a patient's follow-up early? For example,
          death, organ transplant, or switching to a different treatment.
        </p>
      </div>

      <WizardConceptPicker
        concepts={censoringConcepts}
        onAdd={(concept, domain) => addCensoringConcept(concept, domain)}
        onRemove={removeCensoringConcept}
        prompt="Search for censoring events..."
      />
    </div>
  );
}
