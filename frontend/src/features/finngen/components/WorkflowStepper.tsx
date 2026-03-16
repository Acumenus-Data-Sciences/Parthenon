import { Database, FileCode2, FlaskConical, Radar } from "lucide-react";
import type { ServiceName } from "./workbenchShared";

const steps: Array<{
  key: ServiceName;
  label: string;
  subtitle: string;
  icon: typeof Database;
}> = [
  {
    key: "finngen_romopapi",
    label: "ROMOPAPI",
    subtitle: "Explore source",
    icon: Database,
  },
  {
    key: "finngen_hades_extras",
    label: "HADES Extras",
    subtitle: "Render SQL",
    icon: FileCode2,
  },
  {
    key: "finngen_cohort_operations",
    label: "Cohort Ops",
    subtitle: "Build cohorts",
    icon: FlaskConical,
  },
  {
    key: "finngen_co2_analysis",
    label: "CO2 Modules",
    subtitle: "Analyze",
    icon: Radar,
  },
];

const stepAccents: Record<ServiceName, string> = {
  finngen_romopapi: "#60A5FA",
  finngen_hades_extras: "#2DD4BF",
  finngen_cohort_operations: "#9B1B30",
  finngen_co2_analysis: "#C9A227",
};

export function WorkflowStepper({
  activeService,
  onSelect,
  completedSteps,
}: {
  activeService: ServiceName;
  onSelect: (service: ServiceName) => void;
  completedSteps?: Set<ServiceName>;
}) {
  const activeIndex = steps.findIndex((s) => s.key === activeService);

  return (
    <div className="flex items-start gap-0 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
      {steps.map((step, index) => {
        const isActive = step.key === activeService;
        const isCompleted = completedSteps?.has(step.key) ?? false;
        const isPast = index < activeIndex;
        const accent = stepAccents[step.key];
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => onSelect(step.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "bg-zinc-800/80"
                  : "hover:bg-zinc-800/40"
              }`}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: isActive
                    ? `${accent}22`
                    : isCompleted || isPast
                      ? `${accent}15`
                      : "#27272a",
                  color: isActive
                    ? accent
                    : isCompleted || isPast
                      ? accent
                      : "#71717a",
                  border: isActive
                    ? `2px solid ${accent}`
                    : "2px solid transparent",
                }}
              >
                {isCompleted ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-sm font-medium ${
                    isActive ? "text-white" : "text-zinc-400"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[11px] text-zinc-600">
                  {step.subtitle}
                </div>
              </div>
            </button>
            {index < steps.length - 1 ? (
              <div
                className="mx-1 h-px w-6 shrink-0"
                style={{
                  backgroundColor:
                    isPast || isCompleted ? accent : "#3f3f46",
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
