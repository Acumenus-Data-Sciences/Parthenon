import { CheckCircle2, Circle, Rocket, Loader2, ArrowUpRight, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface WizardState {
  passwordChanged: boolean;
  healthChecked: boolean;
  aiConfigured: boolean;
  authConfigured: boolean;
  sourcesConfigured: boolean;
}

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
  wizardState: WizardState;
  steps: StepDef[];
  onFinish: () => void;
  completing: boolean;
  onGoToStep: (key: StepKey) => void;
}

const SUMMARY_ITEMS: {
  key: keyof WizardState;
  labelKey: string;
  stepKey: StepKey;
  always: boolean;
}[] = [
  {
    key: "passwordChanged",
    labelKey: "setup.complete.summaryItems.accountSecured",
    stepKey: "change-password",
    always: false,
  },
  {
    key: "healthChecked",
    labelKey: "setup.complete.summaryItems.systemHealthVerified",
    stepKey: "system-health",
    always: true,
  },
  {
    key: "aiConfigured",
    labelKey: "setup.complete.summaryItems.aiProviderConfigured",
    stepKey: "ai-provider",
    always: true,
  },
  {
    key: "authConfigured",
    labelKey: "setup.complete.summaryItems.authenticationConfigured",
    stepKey: "authentication",
    always: true,
  },
  {
    key: "sourcesConfigured",
    labelKey: "setup.complete.summaryItems.dataSourcesConnected",
    stepKey: "data-sources",
    always: true,
  },
];

const NEXT_STEPS = [
  {
    labelKey: "setup.complete.nextSteps.exploreDemoData",
    descriptionKey: "setup.complete.nextSteps.exploreDemoDataDescription",
    href: "/data-explorer",
  },
  {
    labelKey: "setup.complete.nextSteps.createFirstCohort",
    descriptionKey: "setup.complete.nextSteps.createFirstCohortDescription",
    href: "/cohorts/new",
  },
  {
    labelKey: "setup.complete.nextSteps.inviteTeam",
    descriptionKey: "setup.complete.nextSteps.inviteTeamDescription",
    href: "/admin/users",
  },
];

export function CompleteStep({ wizardState, steps, onFinish, completing, onGoToStep }: Props) {
  const { t } = useTranslation("auth");

  // Only show summary items for steps that are present in this wizard run
  const stepKeys = new Set(steps.map((s) => s.key));
  const visibleItems = SUMMARY_ITEMS.filter(
    (item) => item.always || stepKeys.has(item.stepKey),
  );

  const completedCount = visibleItems.filter((item) => wizardState[item.key]).length;
  const allDone = completedCount === visibleItems.length;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">
          {t("setup.complete.title")}
        </h2>
        <p className="mt-2 text-base text-text-muted">
          {allDone
            ? t("setup.complete.allDone")
            : t("setup.complete.partialDone", {
              completed: completedCount,
              total: visibleItems.length,
            })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Summary checklist */}
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.complete.setupSummary")}
          </p>
          {visibleItems.map((item) => {
            const done = wizardState[item.key];
            const stepPresent = stepKeys.has(item.stepKey);
            const label = t(item.labelKey);
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5"
              >
                {done ? (
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                ) : (
                  <Circle size={15} className="shrink-0 text-text-ghost" />
                )}
                <span
                  className={cn(
                    "flex-1 text-base",
                    done ? "text-text-primary" : "text-text-ghost",
                  )}
                >
                  {label}
                  {!done && (
                    <span className="ml-1 text-sm">
                      {t("setup.complete.skipped")}
                    </span>
                  )}
                </span>
                {!done && stepPresent && (
                  <button
                    type="button"
                    onClick={() => onGoToStep(item.stepKey)}
                    className="flex shrink-0 items-center gap-1 text-sm text-text-ghost transition-colors hover:text-accent"
                    title={t("setup.complete.goBackTitle", { label })}
                  >
                    <RotateCcw size={11} />
                    {t("setup.complete.fix")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick-start next steps */}
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.complete.nextTitle")}
          </p>
          {NEXT_STEPS.map((ns) => (
            <Link
              key={ns.href}
              to={ns.href}
              onClick={onFinish}
              className="flex items-start justify-between gap-3 rounded-lg border border-border-default bg-surface-overlay px-4 py-2.5 transition-colors hover:border-accent/30 hover:bg-accent/5 group"
            >
              <div>
                <p className="text-base font-medium text-text-primary group-hover:text-accent transition-colors">
                  {t(ns.labelKey)}
                </p>
                <p className="mt-0.5 text-sm text-text-muted">
                  {t(ns.descriptionKey)}
                </p>
              </div>
              <ArrowUpRight
                size={14}
                className="mt-0.5 shrink-0 text-text-ghost group-hover:text-accent transition-colors"
              />
            </Link>
          ))}
        </div>
      </div>

      {/* Launch button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onFinish}
          disabled={completing}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3 text-base font-semibold text-surface-base",
            "hover:bg-accent-light transition-colors disabled:opacity-50",
          )}
        >
          {completing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Rocket size={16} />
              {t("setup.complete.launch")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
