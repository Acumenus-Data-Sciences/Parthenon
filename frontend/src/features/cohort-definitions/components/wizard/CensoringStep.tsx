import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";
import { useTranslation } from "react-i18next";

export function CensoringStep() {
  const { t } = useTranslation("app");
  const { censoringConcepts, addCensoringConcept, removeCensoringConcept } =
    useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.step2Of2CensoringEvents_8b6873")}{" "}
          <span className="text-[11px] text-text-ghost">{t("cohortDefinitions.auto.optional_f53d1c")}</span>
        </div>
        <p className="text-[13px] text-text-muted">
          {t("cohortDefinitions.auto.areThereSpecificEventsThatShouldEndA_f98618")}
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
