import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { CohortSummary } from "./CohortSummary";

export function ReviewStep() {
  const { setChapter, entryConcepts, name } = useCohortWizardStore();

  const errors: string[] = [];
  if (!name) errors.push("Cohort name is required (Chapter 1)");
  if (entryConcepts.length === 0) errors.push("At least one entry event is required (Chapter 2)");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">Step 1 of 3 — Review Your Cohort</div>
      </div>

      <CohortSummary />

      {/* Edit shortcuts */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChapter(2)}
          className="rounded border border-[#333] px-2.5 py-1 text-[11px] text-[#888] hover:border-[#555] hover:text-[#ccc]"
        >
          &#x270F; Edit Population
        </button>
        <button
          type="button"
          onClick={() => setChapter(3)}
          className="rounded border border-[#333] px-2.5 py-1 text-[11px] text-[#888] hover:border-[#555] hover:text-[#ccc]"
        >
          &#x270F; Edit Rules
        </button>
        <button
          type="button"
          onClick={() => setChapter(4)}
          className="rounded border border-[#333] px-2.5 py-1 text-[11px] text-[#888] hover:border-[#555] hover:text-[#ccc]"
        >
          &#x270F; Edit Follow-up
        </button>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3">
          <div className="mb-1 text-[12px] font-medium text-[#E85A6B]">
            Cannot generate &mdash; fix these issues:
          </div>
          <ul className="list-inside list-disc text-[12px] text-[#E85A6B]">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
