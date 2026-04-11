import { useState } from "react";
import { Check, X, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateSource } from "../hooks/useSources";
import { DatabaseStep } from "./add-source-steps/DatabaseStep";
import { ConnectionStep, type ConnectionData } from "./add-source-steps/ConnectionStep";
import { DaimonsStep, type DaimonsData } from "./add-source-steps/DaimonsStep";
import { ReviewStep } from "./add-source-steps/ReviewStep";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardState {
  dialect: string;
  connection: ConnectionData;
  daimons: DaimonsData;
}

const STEPS = [
  { key: "database", label: "Database" },
  { key: "connection", label: "Connection" },
  { key: "daimons", label: "Daimons" },
  { key: "review", label: "Review" },
] as const;

type StepKey = typeof STEPS[number]["key"];

interface Props {
  onClose: () => void;
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between pl-8 pr-14 pt-6 pb-2">
      {STEPS.map((s, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all shrink-0",
                  isCompleted && "bg-accent text-surface-base",
                  isActive && "border-2 border-accent bg-accent/10 text-accent",
                  isPending && "border-2 border-surface-highlight text-text-ghost bg-transparent",
                )}
              >
                {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCompleted && "text-accent",
                  isActive && "text-text-primary",
                  isPending && "text-text-ghost",
                )}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-2 mb-5">
                <div className={cn("h-[2px] w-full rounded-full", isCompleted ? "bg-accent" : "bg-surface-highlight")} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const EMPTY_CONNECTION: ConnectionData = {
  source_name: "",
  source_key: "",
  source_connection: "",
  is_cache_enabled: false,
  db_host: "",
  db_port: "",
  db_database: "",
  username: "",
  password: "",
  db_options: {},
};

export function AddSourceWizard({ onClose }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    dialect: "postgresql",
    connection: EMPTY_CONNECTION,
    daimons: { cdm: "", vocabulary: "", results: "", temp: "" },
  });

  const createSource = useCreateSource();

  function navigate(toIndex: number, dir: "forward" | "back") {
    setSlideDir(dir);
    setAnimKey((k) => k + 1);
    setCurrentStep(toIndex);
  }

  // ── Validation ───────────────────────────────────────────────────────────

  function canProceed(): boolean {
    const step = STEPS[currentStep].key;
    if (step === "database") return !!state.dialect;
    if (step === "connection") {
      const c = state.connection;
      const hasName = c.source_name.trim() !== "" && c.source_key.trim() !== "";
      // For dialects with dynamic fields, require at least host
      const hasConn = c.db_host.trim() !== "" || c.source_connection.trim() !== "";
      return hasName && hasConn;
    }
    if (step === "daimons") {
      return (
        state.daimons.cdm.trim() !== "" &&
        state.daimons.vocabulary.trim() !== "" &&
        state.daimons.results.trim() !== ""
      );
    }
    return true;
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitError(null);
    const c = state.connection;

    const daimons: { daimon_type: string; table_qualifier: string; priority: number }[] = [
      { daimon_type: "cdm", table_qualifier: state.daimons.cdm, priority: 0 },
      { daimon_type: "vocabulary", table_qualifier: state.daimons.vocabulary, priority: 0 },
      { daimon_type: "results", table_qualifier: state.daimons.results, priority: 0 },
    ];
    if (state.daimons.temp.trim()) {
      daimons.push({ daimon_type: "temp", table_qualifier: state.daimons.temp, priority: 0 });
    }

    const hasOptions = Object.values(c.db_options).some(Boolean);

    try {
      await createSource.mutateAsync({
        source_name: c.source_name,
        source_key: c.source_key,
        source_dialect: state.dialect,
        source_connection: c.source_connection || undefined,
        is_cache_enabled: c.is_cache_enabled,
        is_default: false,
        db_host: c.db_host || undefined,
        db_port: c.db_port ? parseInt(c.db_port) : undefined,
        db_database: c.db_database || undefined,
        username: c.username || undefined,
        password: c.password || undefined,
        db_options: hasOptions ? c.db_options : undefined,
        daimons,
      } as Parameters<typeof createSource.mutateAsync>[0]);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      if (e?.response?.data?.errors) {
        setSubmitError(Object.values(e.response.data.errors).flat().join(" "));
      } else {
        setSubmitError(e?.response?.data?.message ?? "Failed to create source. Please check your inputs.");
      }
    }
  }

  // ── Step content ─────────────────────────────────────────────────────────

  const stepKey: StepKey = STEPS[currentStep].key;

  const stepContent: Record<StepKey, React.ReactNode> = {
    database: (
      <DatabaseStep
        dialect={state.dialect}
        onChange={(dialect) => setState((s) => ({ ...s, dialect, connection: EMPTY_CONNECTION }))}
      />
    ),
    connection: (
      <ConnectionStep
        dialect={state.dialect}
        data={state.connection}
        onChange={(connection) => setState((s) => ({ ...s, connection }))}
      />
    ),
    daimons: (
      <DaimonsStep
        data={state.daimons}
        onChange={(daimons) => setState((s) => ({ ...s, daimons }))}
      />
    ),
    review: (
      <ReviewStep
        dialect={state.dialect}
        connection={state.connection}
        daimons={state.daimons}
        onSubmit={handleSubmit}
        isLoading={createSource.isPending}
        error={submitError}
      />
    ),
  };

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <>
      <style>{`
        @keyframes addSourceSlideFromRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes addSourceSlideFromLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/90 backdrop-blur-sm">
        <div className="relative mx-4 flex w-full max-w-2xl flex-col rounded-2xl border border-border-default bg-surface-raised shadow-2xl max-h-[90vh]">

          <button
            type="button"
            onClick={onClose}
            disabled={createSource.isPending}
            className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-text-ghost hover:text-text-muted transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>

          <StepIndicator currentStep={currentStep} />

          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div
              key={animKey}
              style={{
                animation: `${slideDir === "forward" ? "addSourceSlideFromRight" : "addSourceSlideFromLeft"} 220ms ease forwards`,
              }}
            >
              {stepContent[stepKey]}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-default px-8 py-4">
            <button
              type="button"
              onClick={() => navigate(currentStep - 1, "back")}
              disabled={currentStep === 0 || createSource.isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                currentStep === 0
                  ? "cursor-not-allowed text-surface-highlight"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              <ArrowLeft size={14} />
              Back
            </button>

            {!isLastStep && (
              <button
                type="button"
                onClick={() => navigate(currentStep + 1, "forward")}
                disabled={!canProceed()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  canProceed()
                    ? "bg-accent text-surface-base hover:bg-accent-light"
                    : "cursor-not-allowed bg-surface-elevated text-text-ghost",
                )}
              >
                Next
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
