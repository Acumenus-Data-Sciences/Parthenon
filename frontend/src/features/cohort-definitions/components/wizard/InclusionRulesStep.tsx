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
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 1 of 3 — Inclusion Rules{" "}
          <span className="text-[11px] text-[#555]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#888]">
          What additional requirements must a patient meet to stay in the cohort?
        </p>
      </div>

      {/* Boolean logic toggle */}
      {inclusionRules.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-3">
          <span className="text-[13px] text-[#ccc]">Patient must match</span>
          <div className="inline-flex overflow-hidden rounded-md border border-[#333]">
            {(["ALL", "ANY", "NONE"] as const).map((logic) => (
              <button
                key={logic}
                type="button"
                onClick={() => setInclusionLogic(logic)}
                className={`border-l border-[#333] px-3 py-1 text-[12px] first:border-l-0 ${
                  inclusionLogic === logic
                    ? "bg-[#2DD4BF] font-semibold text-[#0E0E11]"
                    : "text-[#888] hover:text-[#ccc]"
                }`}
              >
                {logic}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-[#ccc]">of these rules:</span>
        </div>
      )}

      {/* Rules */}
      <div className="flex flex-col gap-3">
        {inclusionRules.map((rule, index) => (
          <InclusionRuleSentence
            key={index}
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
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#333] py-2.5 text-[12px] text-[#888] transition-colors hover:border-[#555] hover:text-[#ccc]"
      >
        <Plus size={14} />
        Add inclusion rule
      </button>
    </div>
  );
}
