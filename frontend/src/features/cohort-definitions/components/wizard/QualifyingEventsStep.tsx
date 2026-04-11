import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function QualifyingEventsStep() {
  const { qualifiedLimit, setQualifiedLimit } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          Qualifying Events
        </div>
        <p className="text-[13px] text-text-muted">
          If a patient has multiple qualifying events, which one defines their cohort entry?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setQualifiedLimit("First")}
          className={`rounded-lg p-4 text-left transition-colors ${
            qualifiedLimit === "First"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-border-default bg-surface-overlay hover:border-surface-highlight"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                qualifiedLimit === "First"
                  ? "bg-success"
                  : "border border-surface-highlight"
              }`}
            >
              {qualifiedLimit === "First" && (
                <div className="h-2 w-2 rounded-full bg-surface-base" />
              )}
            </div>
            <span className="text-[13px] font-medium text-text-secondary">
              First event
            </span>
            <span className="rounded bg-[rgba(45,212,191,0.15)] px-1.5 py-0.5 text-[10px] text-success">
              recommended
            </span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-text-muted">
            Use the earliest qualifying event as the entry date. Most common choice.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setQualifiedLimit("All")}
          className={`rounded-lg p-4 text-left transition-colors ${
            qualifiedLimit === "All"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-border-default bg-surface-overlay hover:border-surface-highlight"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                qualifiedLimit === "All"
                  ? "bg-success"
                  : "border border-surface-highlight"
              }`}
            >
              {qualifiedLimit === "All" && (
                <div className="h-2 w-2 rounded-full bg-surface-base" />
              )}
            </div>
            <span className="text-[13px] font-medium text-text-secondary">
              All events
            </span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-text-muted">
            Each qualifying event creates a separate cohort entry period.
          </p>
        </button>
      </div>
    </div>
  );
}
