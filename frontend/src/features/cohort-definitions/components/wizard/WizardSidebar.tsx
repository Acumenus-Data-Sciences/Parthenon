import { Check, Circle, AlertCircle } from "lucide-react";
import { useCohortWizardStore, type ChapterStatus } from "../../stores/cohortWizardStore";

interface Chapter {
  number: number;
  label: string;
  steps: string[];
  optional?: boolean;
}

const CHAPTERS: Chapter[] = [
  { number: 1, label: "Basics", steps: ["Name, description, domain"] },
  { number: 2, label: "Define Population", steps: ["Entry Events", "Observation Window", "Qualifying Events"] },
  { number: 3, label: "Refine & Filter", steps: ["Inclusion Rules", "Demographics", "Risk Scores"] },
  { number: 4, label: "Follow-up & Exit", steps: ["End Strategy", "Censoring Events"] },
  { number: 5, label: "Specialized", steps: ["Genomic", "Imaging"], optional: true },
  { number: 6, label: "Review & Generate", steps: ["Summary", "Generate", "What's Next"] },
];

function StatusIcon({ status, number }: { status: ChapterStatus; number: number }) {
  switch (status) {
    case "complete":
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-success">
          <Check size={12} className="text-surface-base" />
        </div>
      );
    case "warning":
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent">
          <AlertCircle size={12} className="text-surface-base" />
        </div>
      );
    case "in-progress":
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-accent">
          <Circle size={8} className="fill-accent text-accent" />
        </div>
      );
    default:
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border-default">
          <span className="text-[11px] text-text-ghost">{number}</span>
        </div>
      );
  }
}

export function WizardSidebar() {
  const { currentChapter, currentStep, setChapter, getChapterStatus } =
    useCohortWizardStore();

  return (
    <div className="w-[240px] shrink-0 rounded-xl border border-border-default bg-surface-base p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-text-ghost">
        Wizard Progress
      </div>
      <div className="flex flex-col gap-5">
        {CHAPTERS.map((ch) => {
          const isActive = currentChapter === ch.number;
          const status: ChapterStatus = isActive ? "in-progress" : getChapterStatus(ch.number);

          return (
            <button
              key={ch.number}
              type="button"
              onClick={() => setChapter(ch.number)}
              className="text-left"
            >
              <div className="flex items-center gap-2">
                <StatusIcon status={status} number={ch.number} />
                <span
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-accent"
                      : status === "complete"
                        ? "text-success"
                        : "text-text-muted"
                  }`}
                >
                  {ch.label}
                </span>
                {ch.optional && (
                  <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-text-ghost">
                    optional
                  </span>
                )}
              </div>
              <div className="ml-[30px] mt-1">
                {ch.steps.map((step, si) => {
                  const isActiveStep = isActive && currentStep === si + 1;
                  return (
                    <div
                      key={step}
                      className={`text-[11px] ${
                        isActiveStep ? "text-accent" : "text-text-ghost"
                      }`}
                    >
                      {isActiveStep ? "→ " : "· "}
                      {step}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
