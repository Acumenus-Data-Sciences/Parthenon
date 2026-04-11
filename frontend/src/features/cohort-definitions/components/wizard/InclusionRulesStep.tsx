import { Plus } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { InclusionRuleSentence } from "./InclusionRuleSentence";

export function InclusionRulesStep() {
  const {
    inclusionRules,
    inclusionLogic,
    addInclusionRule,
    removeInclusionRule,
    updateInclusionRule,
    addInclusionRuleConcept,
    removeInclusionRuleConcept,
    setInclusionLogic,
  } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          Inclusion Rules{" "}
          <span className="text-[11px] text-text-ghost">(optional)</span>
        </div>
        <p className="text-[13px] text-text-muted">
          What additional requirements must a patient meet to stay in the cohort?
        </p>
      </div>

      {/* Boolean logic toggle */}
      {inclusionRules.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-base p-3">
          <span className="text-[13px] text-text-secondary">Patient must match</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border-default">
            {(["ALL", "ANY", "NONE"] as const).map((logic) => (
              <button
                key={logic}
                type="button"
                onClick={() => setInclusionLogic(logic)}
                className={`border-l border-border-default px-3 py-1 text-[12px] first:border-l-0 ${
                  inclusionLogic === logic
                    ? "bg-success font-semibold text-surface-base"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {logic}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-text-secondary">of these rules:</span>
        </div>
      )}

      {/* Rules */}
      <div className="flex flex-col gap-3">
        {inclusionRules.map((rule, index) => (
          <InclusionRuleSentence
            key={rule._key}
            rule={rule}
            index={index}
            onUpdate={updateInclusionRule}
            onAddConcept={addInclusionRuleConcept}
            onRemoveConcept={removeInclusionRuleConcept}
            onRemove={removeInclusionRule}
          />
        ))}
      </div>

      {/* Add rule */}
      <button
        type="button"
        onClick={addInclusionRule}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-default py-2.5 text-[12px] text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary"
      >
        <Plus size={14} />
        Add inclusion rule
      </button>
    </div>
  );
}
