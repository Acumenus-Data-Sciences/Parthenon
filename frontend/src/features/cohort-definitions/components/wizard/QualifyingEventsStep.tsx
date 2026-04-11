import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function QualifyingEventsStep() {
  const { qualifiedLimit, setQualifiedLimit } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#C5C0B8]">
          Qualifying Events
        </div>
        <p className="text-[13px] text-[#8A857D]">
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
              : "border border-[#2A2A30] bg-[#1C1C20] hover:border-[#3A3A42]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                qualifiedLimit === "First"
                  ? "bg-[#2DD4BF]"
                  : "border border-[#3A3A42]"
              }`}
            >
              {qualifiedLimit === "First" && (
                <div className="h-2 w-2 rounded-full bg-[#0E0E11]" />
              )}
            </div>
            <span className="text-[13px] font-medium text-[#C5C0B8]">
              First event
            </span>
            <span className="rounded bg-[rgba(45,212,191,0.15)] px-1.5 py-0.5 text-[10px] text-[#2DD4BF]">
              recommended
            </span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-[#8A857D]">
            Use the earliest qualifying event as the entry date. Most common choice.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setQualifiedLimit("All")}
          className={`rounded-lg p-4 text-left transition-colors ${
            qualifiedLimit === "All"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#2A2A30] bg-[#1C1C20] hover:border-[#3A3A42]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                qualifiedLimit === "All"
                  ? "bg-[#2DD4BF]"
                  : "border border-[#3A3A42]"
              }`}
            >
              {qualifiedLimit === "All" && (
                <div className="h-2 w-2 rounded-full bg-[#0E0E11]" />
              )}
            </div>
            <span className="text-[13px] font-medium text-[#C5C0B8]">
              All events
            </span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-[#8A857D]">
            Each qualifying event creates a separate cohort entry period.
          </p>
        </button>
      </div>
    </div>
  );
}
