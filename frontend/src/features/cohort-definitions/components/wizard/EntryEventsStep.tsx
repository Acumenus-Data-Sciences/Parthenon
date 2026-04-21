import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";
import { useTranslation } from "react-i18next";

export function EntryEventsStep() {
  const { t } = useTranslation("app");
  const { entryConcepts, addEntryConcept, removeEntryConcept, updateEntryConceptOptions } =
    useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.step1Of3EntryEvents_e2aefb")}
        </div>
        <p className="text-[13px] text-text-muted">
          {t("cohortDefinitions.auto.searchForTheDiagnosesProceduresMedicationsOrOther_4fd129")}{" "}
          <em>any</em> {t("cohortDefinitions.auto.ofThemQualifies_9d103b")}
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
