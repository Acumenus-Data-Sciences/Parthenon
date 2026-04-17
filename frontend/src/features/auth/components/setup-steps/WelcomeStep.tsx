import { Activity, Bot, Shield, Database, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const WIZARD_OVERVIEW = [
  {
    icon: Activity,
    labelKey: "setup.welcome.overview.systemHealth.label",
    descriptionKey: "setup.welcome.overview.systemHealth.description",
  },
  {
    icon: Bot,
    labelKey: "setup.welcome.overview.aiProvider.label",
    descriptionKey: "setup.welcome.overview.aiProvider.description",
  },
  {
    icon: Shield,
    labelKey: "setup.welcome.overview.authentication.label",
    descriptionKey: "setup.welcome.overview.authentication.description",
  },
  {
    icon: Database,
    labelKey: "setup.welcome.overview.dataSources.label",
    descriptionKey: "setup.welcome.overview.dataSources.description",
  },
];

const BEFORE_YOU_START = [
  "setup.welcome.before.cdm",
  "setup.welcome.before.docker",
  "setup.welcome.before.ollama",
  "setup.welcome.before.sso",
];

export function WelcomeStep() {
  const { t } = useTranslation("auth");

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary">
          {t("setup.welcome.title")}
        </h2>
        <p className="mt-2 text-base text-text-muted">
          {t("setup.welcome.intro")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* What we'll set up */}
        <div>
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.welcome.configureTitle")}
          </p>
          <div className="space-y-2">
            {WIZARD_OVERVIEW.map((item) => {
              const Icon = item.icon;
              const label = t(item.labelKey);
              return (
                <div
                  key={item.labelKey}
                  className="flex items-start gap-3 rounded-xl border border-border-default bg-surface-overlay p-3"
                >
                  <div className="rounded-lg bg-accent/10 p-2 shrink-0">
                    <Icon size={15} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-text-primary">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm text-text-muted">
                      {t(item.descriptionKey)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Before you start */}
        <div>
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.welcome.beforeTitle")}
          </p>
          <div className="rounded-xl border border-border-default bg-surface-overlay p-4 space-y-3">
            {BEFORE_YOU_START.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-text-ghost" />
                <p className="text-sm text-text-muted leading-relaxed">
                  {t(item)}
                </p>
              </div>
            ))}
            <p className="pt-1 text-sm text-text-ghost border-t border-border-default mt-2">
              {t("setup.welcome.optionalNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
