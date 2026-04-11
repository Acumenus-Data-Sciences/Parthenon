import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function ObservationWindowStep() {
  const { observationWindow, setObservationWindow } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 2 of 3 — Observation Window
        </div>
        <p className="text-[13px] text-[#888]">
          How much medical history must a patient have before and after their entry event?
        </p>
      </div>

      <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="min-w-[240px] text-[13px] text-[#ccc]">
              Days of history required before entry
            </label>
            <input
              type="number"
              min={0}
              value={observationWindow.priorDays}
              onChange={(e) =>
                setObservationWindow(
                  Math.max(0, parseInt(e.target.value) || 0),
                  observationWindow.postDays,
                )
              }
              className="w-[100px] rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
            />
            <span className="text-[13px] text-[#888]">days</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="min-w-[240px] text-[13px] text-[#ccc]">
              Days of follow-up required after entry
            </label>
            <input
              type="number"
              min={0}
              value={observationWindow.postDays}
              onChange={(e) =>
                setObservationWindow(
                  observationWindow.priorDays,
                  Math.max(0, parseInt(e.target.value) || 0),
                )
              }
              className="w-[100px] rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
            />
            <span className="text-[13px] text-[#888]">days</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
        <span className="text-[#C9A227]">💡</span>{" "}
        <span className="text-[13px] text-[#999]">
          <strong className="text-[#C9A227]">Tip:</strong> This ensures patients have enough
          data for your study. For example, requiring 365 days of prior history ensures you
          can check for pre-existing conditions.
        </span>
      </div>
    </div>
  );
}
