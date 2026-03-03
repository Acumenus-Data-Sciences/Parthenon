import { CheckCircle2, Circle, Rocket, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardState {
  organizationName: string;
  healthChecked: boolean;
  aiConfigured: boolean;
  authConfigured: boolean;
  sourcesConfigured: boolean;
}

interface Props {
  wizardState: WizardState;
  onFinish: () => void;
  completing: boolean;
}

const SUMMARY_ITEMS = [
  { key: "healthChecked" as const, label: "System Health Verified" },
  { key: "aiConfigured" as const, label: "AI Provider Configured" },
  { key: "authConfigured" as const, label: "Authentication Configured" },
  { key: "sourcesConfigured" as const, label: "Data Sources Configured" },
];

export function CompleteStep({ wizardState, onFinish, completing }: Props) {
  return (
    <div className="space-y-6 text-center">
      <div>
        <h2 className="text-2xl font-bold text-[#F0EDE8]">
          {wizardState.organizationName || "Parthenon"} is ready!
        </h2>
        <p className="mt-2 text-sm text-[#8A857D]">
          Here's a summary of your initial configuration. You can always change these
          settings from the Administration panel.
        </p>
      </div>

      {/* Summary checklist */}
      <div className="mx-auto max-w-sm space-y-2">
        {SUMMARY_ITEMS.map((item) => {
          const done = wizardState[item.key];
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#1A1A1E] px-4 py-3"
            >
              {done ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              ) : (
                <Circle size={16} className="shrink-0 text-[#5A5650]" />
              )}
              <span
                className={cn(
                  "text-sm",
                  done ? "text-[#F0EDE8]" : "text-[#5A5650]",
                )}
              >
                {item.label}
                {!done && <span className="ml-1 text-xs">(skipped)</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Launch button */}
      <button
        type="button"
        onClick={onFinish}
        disabled={completing}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-8 py-3 text-base font-semibold text-[#0E0E11]",
          "hover:bg-[#D4AE3A] transition-colors disabled:opacity-50",
        )}
      >
        {completing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            <Rocket size={16} />
            Launch Parthenon
          </>
        )}
      </button>
    </div>
  );
}
