import { useState, useCallback } from "react";
import { Check, X, ArrowLeft, ArrowRight, Loader2, SkipForward } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";
import { cn } from "@/lib/utils";

import { WelcomeStep } from "./setup-steps/WelcomeStep";
import { SystemHealthStep } from "./setup-steps/SystemHealthStep";
import { AiProviderStep } from "./setup-steps/AiProviderStep";
import { AuthenticationStep } from "./setup-steps/AuthenticationStep";
import { DataSourcesStep } from "./setup-steps/DataSourcesStep";
import { CompleteStep, type WizardState } from "./setup-steps/CompleteStep";

// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "system-health", label: "System Health" },
  { key: "ai-provider", label: "AI Provider" },
  { key: "authentication", label: "Authentication" },
  { key: "data-sources", label: "Data Sources" },
  { key: "complete", label: "Complete" },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function SetupWizard() {
  const updateUser = useAuthStore((s) => s.updateUser);

  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>({
    organizationName: "Parthenon",
    healthChecked: false,
    aiConfigured: false,
    authConfigured: false,
    sourcesConfigured: false,
  });

  // Mark onboarding complete — same pattern as OnboardingModal
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

  function goNext() {
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1);
  }

  function goPrev() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  // Memoized callbacks for step components
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

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  // ── Step indicator ───────────────────────────────────────────────────────

  function StepIndicator() {
    return (
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all shrink-0",
                    isCompleted && "bg-[#C9A227] text-[#0E0E11]",
                    isActive && "border-2 border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]",
                    isPending && "border-2 border-[#323238] text-[#5A5650] bg-transparent",
                  )}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium whitespace-nowrap",
                    isCompleted && "text-[#C9A227]",
                    isActive && "text-[#F0EDE8]",
                    isPending && "text-[#5A5650]",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-2 mb-5">
                  <div
                    className={cn(
                      "h-[2px] w-full rounded-full",
                      isCompleted ? "bg-[#C9A227]" : "bg-[#323238]",
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

  const stepContent = [
    <WelcomeStep
      key="welcome"
      organizationName={wizardState.organizationName}
      onOrganizationNameChange={(name) =>
        setWizardState((s) => ({ ...s, organizationName: name }))
      }
    />,
    <SystemHealthStep key="system-health" onHealthChecked={onHealthChecked} />,
    <AiProviderStep key="ai-provider" onConfigured={onAiConfigured} />,
    <AuthenticationStep key="authentication" onConfigured={onAuthConfigured} />,
    <DataSourcesStep key="data-sources" onConfigured={onSourcesConfigured} />,
    <CompleteStep
      key="complete"
      wizardState={wizardState}
      onFinish={markComplete}
      completing={completing}
    />,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E0E11]/90 backdrop-blur-sm">
      <div className="relative mx-4 flex w-full max-w-4xl flex-col rounded-2xl border border-[#232328] bg-[#151518] shadow-2xl max-h-[90vh]">
        {/* Skip wizard (X button) */}
        <button
          type="button"
          onClick={markComplete}
          disabled={completing}
          className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-[#5A5650] hover:text-[#8A857D] transition-colors"
          aria-label="Skip setup wizard"
        >
          <X size={18} />
        </button>

        {/* Step indicator */}
        <StepIndicator />

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-8 py-4">{stepContent[currentStep]}</div>

        {/* Navigation footer (hidden on last step — CompleteStep has its own button) */}
        {!isLastStep && (
          <div className="flex items-center justify-between border-t border-[#232328] px-8 py-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirstStep}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isFirstStep
                  ? "text-[#323238] cursor-not-allowed"
                  : "text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              <ArrowLeft size={14} />
              Previous
            </button>

            <div className="flex items-center gap-3">
              {/* Skip this step */}
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-1.5 text-sm text-[#5A5650] hover:text-[#8A857D] transition-colors"
                >
                  <SkipForward size={14} />
                  Skip
                </button>
              )}

              {/* Next */}
              <button
                type="button"
                onClick={goNext}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg bg-[#C9A227] px-5 py-2 text-sm font-semibold text-[#0E0E11]",
                  "hover:bg-[#D4AE3A] transition-colors",
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
  );
}
