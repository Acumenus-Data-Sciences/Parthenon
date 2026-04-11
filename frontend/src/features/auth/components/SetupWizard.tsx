import { useState, useCallback, useMemo } from "react";
import { Check, X, ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";
import { cn } from "@/lib/utils";

import { WelcomeStep } from "./setup-steps/WelcomeStep";
import { ChangePasswordStep } from "./setup-steps/ChangePasswordStep";
import { SystemHealthStep } from "./setup-steps/SystemHealthStep";
import { AiProviderStep } from "./setup-steps/AiProviderStep";
import { AuthenticationStep } from "./setup-steps/AuthenticationStep";
import { DataSourcesStep } from "./setup-steps/DataSourcesStep";
import { CompleteStep, type WizardState } from "./setup-steps/CompleteStep";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepKey =
  | "welcome"
  | "change-password"
  | "system-health"
  | "ai-provider"
  | "authentication"
  | "data-sources"
  | "complete";

interface StepDef {
  key: StepKey;
  label: string;
  skippable: boolean;
}

interface Props {
  mustChangePassword: boolean;
  /** Called when wizard should close without marking onboarding complete (admin re-open). */
  onClose?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSteps(mustChangePassword: boolean): StepDef[] {
  return [
    { key: "welcome", label: "Welcome", skippable: false },
    ...(mustChangePassword
      ? [{ key: "change-password" as StepKey, label: "Security", skippable: false }]
      : []),
    { key: "system-health", label: "Health", skippable: true },
    { key: "ai-provider", label: "AI", skippable: true },
    { key: "authentication", label: "Auth", skippable: true },
    { key: "data-sources", label: "Data Sources", skippable: true },
    { key: "complete", label: "Complete", skippable: false },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SetupWizard({ mustChangePassword, onClose }: Props) {
  const updateUser = useAuthStore((s) => s.updateUser);

  const steps = useMemo(() => buildSteps(mustChangePassword), [mustChangePassword]);

  const [currentStep, setCurrentStep] = useState(0);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>({
    passwordChanged: !mustChangePassword,
    healthChecked: false,
    aiConfigured: false,
    authConfigured: false,
    sourcesConfigured: false,
  });

  // ── Helpers ─────────────────────────────────────────────────────────────

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const canDismiss = !mustChangePassword || wizardState.passwordChanged;

  // Mark onboarding complete and close
  async function markComplete() {
    if (completing) return;
    setCompleting(true);
    try {
      await apiClient.put<{ onboarding_completed: boolean }>("/user/onboarding");
      const { data } = await apiClient.get<{ data: User }>("/auth/user");
      updateUser(data.data ?? (data as unknown as User));
    } catch {
      const user = useAuthStore.getState().user;
      if (user) updateUser({ ...user, onboarding_completed: true });
    } finally {
      setCompleting(false);
    }
  }

  async function dismiss() {
    if (onClose) {
      // Opened from admin panel — just close, don't re-mark complete
      onClose();
    } else {
      // First launch — closing permanently dismisses the wizard
      await markComplete();
    }
  }

  function navigate(toIndex: number, dir: "forward" | "back") {
    setSlideDir(dir);
    setAnimKey((k) => k + 1);
    setCurrentStep(toIndex);
  }

  function goNext() {
    if (currentStep < steps.length - 1) navigate(currentStep + 1, "forward");
  }

  function goPrev() {
    if (currentStep > 0) navigate(currentStep - 1, "back");
  }

  function goToStepKey(key: StepKey) {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx !== -1) navigate(idx, "back");
  }

  // Index of AI provider step (varies if change-password is included)
  const aiProviderIndex = steps.findIndex((s) => s.key === "ai-provider");

  // ── Step callbacks ───────────────────────────────────────────────────────

  const onPasswordChanged = useCallback(
    () => setWizardState((s) => ({ ...s, passwordChanged: true })),
    [],
  );
  const onHealthChecked = useCallback(
    () => setWizardState((s) => ({ ...s, healthChecked: true })),
    [],
  );
  const onAiConfigured = useCallback(
    () => setWizardState((s) => ({ ...s, aiConfigured: true })),
    [],
  );
  const onAuthConfigured = useCallback(
    () => setWizardState((s) => ({ ...s, authConfigured: true })),
    [],
  );
  const onSourcesConfigured = useCallback(
    () => setWizardState((s) => ({ ...s, sourcesConfigured: true })),
    [],
  );

  // ── Step content map ─────────────────────────────────────────────────────

  const stepContentMap: Record<StepKey, React.ReactNode> = {
    welcome: <WelcomeStep />,
    "change-password": <ChangePasswordStep onPasswordChanged={onPasswordChanged} />,
    "system-health": (
      <SystemHealthStep
        onHealthChecked={onHealthChecked}
        onGoToAiProvider={aiProviderIndex !== -1 ? () => navigate(aiProviderIndex, "forward") : undefined}
      />
    ),
    "ai-provider": <AiProviderStep onConfigured={onAiConfigured} />,
    authentication: <AuthenticationStep onConfigured={onAuthConfigured} />,
    "data-sources": <DataSourcesStep onConfigured={onSourcesConfigured} />,
    complete: (
      <CompleteStep
        wizardState={wizardState}
        steps={steps}
        onFinish={onClose ? onClose : markComplete}
        completing={completing}
        onGoToStep={goToStepKey}
      />
    ),
  };

  // ── Step indicator ───────────────────────────────────────────────────────

  function StepIndicator() {
    return (
      <div className="flex items-center justify-between pl-8 pr-14 pt-6 pb-2">
        {steps.map((s, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;
          const isLast = index === steps.length - 1;

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
                  <div
                    className={cn(
                      "h-[2px] w-full rounded-full",
                      isCompleted ? "bg-accent" : "bg-surface-highlight",
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Slide keyframes */}
      <style>{`
        @keyframes wizardSlideFromRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes wizardSlideFromLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/90 backdrop-blur-sm">
        <div className="relative mx-4 flex w-full max-w-4xl flex-col rounded-2xl border border-border-default bg-surface-raised shadow-2xl max-h-[90vh]">

          {/* Dismiss button — hidden until password is changed on first run */}
          {canDismiss && (
            <button
              type="button"
              onClick={dismiss}
              disabled={completing}
              title={onClose ? "Close" : "Skip setup — return any time via Administration"}
              className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-text-ghost hover:text-text-muted transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          )}

          {/* Step indicator */}
          <StepIndicator />

          {/* Animated step content */}
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div
              key={animKey}
              style={{
                animation: `${slideDir === "forward" ? "wizardSlideFromRight" : "wizardSlideFromLeft"} 220ms ease forwards`,
              }}
            >
              {stepContentMap[step.key]}
            </div>
          </div>

          {/* Navigation footer (hidden on last step) */}
          {!isLastStep && (
            <div className="flex items-center justify-between border-t border-border-default px-8 py-4">
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirstStep}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isFirstStep
                    ? "cursor-not-allowed text-surface-highlight"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                <ArrowLeft size={14} />
                Previous
              </button>

              <div className="flex items-center gap-3">
                {/* Skip — only for skippable steps after welcome */}
                {currentStep > 0 && step.skippable && (
                  <button
                    type="button"
                    onClick={goNext}
                    title="Skip this step — configure later in Administration"
                    className="inline-flex items-center gap-1.5 text-sm text-text-ghost hover:text-text-muted transition-colors"
                  >
                    <SkipForward size={14} />
                    Skip
                  </button>
                )}

                {/* Next — blocked on non-skippable steps until action taken */}
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step.key === "change-password" && !wizardState.passwordChanged}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-surface-base",
                    "hover:bg-[#D4AE3A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  Next
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
