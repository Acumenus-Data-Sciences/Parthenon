import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";
import type { WizardEndStrategy } from "../../utils/buildExpression";

export function EndStrategyStep() {
  const { endStrategy, setEndStrategy } = useCohortWizardStore();

  const setType = (type: WizardEndStrategy["type"]) => {
    if (type === "observation") {
      setEndStrategy({ type: "observation" });
    } else if (type === "fixed") {
      setEndStrategy({ type: "fixed", fixedDays: 365, fixedDateField: "StartDate" });
    } else {
      setEndStrategy({ type: "drug_era", drugConcepts: [], gapDays: 30, offset: 0 });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          Step 1 of 2 — End Strategy
        </div>
        <p className="text-[13px] text-text-muted">
          When does a patient's cohort membership end?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Observation Period End */}
        <button
          type="button"
          onClick={() => setType("observation")}
          className={`rounded-lg p-4 text-left transition-colors ${
            endStrategy.type === "observation"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-border-default bg-surface-overlay hover:border-surface-highlight"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${endStrategy.type === "observation" ? "bg-success" : "border border-surface-highlight"}`}>
              {endStrategy.type === "observation" && <div className="h-2 w-2 rounded-full bg-surface-base" />}
            </div>
            <span className="text-[13px] font-medium text-text-secondary">End of continuous observation</span>
            <span className="rounded bg-[rgba(45,212,191,0.15)] px-1.5 py-0.5 text-[10px] text-success">recommended</span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-text-muted">
            Follow until the patient leaves the database (end of insurance enrollment, transfer out, etc.). Most common choice.
          </p>
        </button>

        {/* Fixed Duration */}
        <button
          type="button"
          onClick={() => setType("fixed")}
          className={`rounded-lg p-4 text-left transition-colors ${
            endStrategy.type === "fixed"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-border-default bg-surface-overlay hover:border-surface-highlight"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${endStrategy.type === "fixed" ? "bg-success" : "border border-surface-highlight"}`}>
              {endStrategy.type === "fixed" && <div className="h-2 w-2 rounded-full bg-surface-base" />}
            </div>
            <span className="text-[13px] font-medium text-text-secondary">Fixed duration after entry</span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-text-muted">
            Follow for exactly N days from the entry event.
          </p>
          {endStrategy.type === "fixed" && (
            <div className="mt-3 ml-[26px] flex items-center gap-2">
              <span className="text-[12px] text-text-muted">Follow for</span>
              <input
                type="number"
                min={1}
                value={endStrategy.fixedDays ?? 365}
                onChange={(e) => setEndStrategy({ ...endStrategy, fixedDays: Math.max(1, parseInt(e.target.value) || 365) })}
                className="w-[70px] rounded border border-border-default bg-surface-base px-2 py-1 text-center text-[13px] text-accent outline-none focus:border-accent"
              />
              <span className="text-[12px] text-text-muted">days</span>
            </div>
          )}
        </button>

        {/* Drug Era */}
        <button
          type="button"
          onClick={() => setType("drug_era")}
          className={`rounded-lg p-4 text-left transition-colors ${
            endStrategy.type === "drug_era"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-border-default bg-surface-overlay hover:border-surface-highlight"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${endStrategy.type === "drug_era" ? "bg-success" : "border border-surface-highlight"}`}>
              {endStrategy.type === "drug_era" && <div className="h-2 w-2 rounded-full bg-surface-base" />}
            </div>
            <span className="text-[13px] font-medium text-text-secondary">While on medication</span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-text-muted">
            Follow as long as the patient continues a drug. Membership ends when the drug era ends.
          </p>
          {endStrategy.type === "drug_era" && (
            <div className="mt-3 ml-[26px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="min-w-[120px] text-[12px] text-text-muted">Gap tolerance:</span>
                <input
                  type="number"
                  min={0}
                  value={endStrategy.gapDays ?? 30}
                  onChange={(e) => setEndStrategy({ ...endStrategy, gapDays: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-[60px] rounded border border-border-default bg-surface-base px-2 py-1 text-center text-[13px] text-accent outline-none focus:border-accent"
                />
                <span className="text-[12px] text-text-muted">days between fills</span>
              </div>
              <WizardConceptPicker
                concepts={endStrategy.drugConcepts ?? []}
                onAdd={(concept, domain) =>
                  setEndStrategy({
                    ...endStrategy,
                    drugConcepts: [
                      ...(endStrategy.drugConcepts ?? []),
                      { concept, domain, includeDescendants: true, includeMapped: false, firstOccurrenceOnly: false },
                    ],
                  })
                }
                onRemove={(conceptId) =>
                  setEndStrategy({
                    ...endStrategy,
                    drugConcepts: (endStrategy.drugConcepts ?? []).filter((c) => c.concept.concept_id !== conceptId),
                  })
                }
                prompt="Search for drug..."
              />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
