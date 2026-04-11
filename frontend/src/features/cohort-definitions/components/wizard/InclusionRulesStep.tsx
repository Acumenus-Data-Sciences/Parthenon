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
        <div className="mb-1 text-[13px] font-medium text-[#C5C0B8]">
          Inclusion Rules{" "}
          <span className="text-[11px] text-[#5A5650]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#8A857D]">
          What additional requirements must a patient meet to stay in the cohort?
        </p>
      </div>

      {/* Boolean logic toggle */}
      {inclusionRules.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#0E0E11] p-3">
          <span className="text-[13px] text-[#C5C0B8]">Patient must match</span>
          <div className="inline-flex overflow-hidden rounded-md border border-[#2A2A30]">
            {(["ALL", "ANY", "NONE"] as const).map((logic) => (
              <button
                key={logic}
                type="button"
                onClick={() => setInclusionLogic(logic)}
                className={`border-l border-[#2A2A30] px-3 py-1 text-[12px] first:border-l-0 ${
                  inclusionLogic === logic
                    ? "bg-[#2DD4BF] font-semibold text-[#0E0E11]"
                    : "text-[#8A857D] hover:text-[#C5C0B8]"
                }`}
              >
                {logic}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-[#C5C0B8]">of these rules:</span>
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
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#2A2A30] py-2.5 text-[12px] text-[#8A857D] transition-colors hover:border-[#3A3A42] hover:text-[#C5C0B8]"
      >
        <Plus size={14} />
        Add inclusion rule
      </button>
    </div>
  );
}
