import { useTranslation } from "react-i18next";
import { Database, BookOpen, BarChart2, Clock } from "lucide-react";

export interface DaimonsData {
  cdm: string;
  vocabulary: string;
  results: string;
  temp: string;
}

interface Props {
  data: DaimonsData;
  onChange: (data: DaimonsData) => void;
}

const DAIMON_ROWS = [
  {
    key: "cdm" as const,
    labelKey: "dataSources.wizard.daimons.labels.cdm",
    icon: Database,
    placeholder: "omop",
    required: true,
    descriptionKey: "dataSources.wizard.daimons.descriptions.cdm",
  },
  {
    key: "vocabulary" as const,
    labelKey: "dataSources.wizard.daimons.labels.vocabulary",
    icon: BookOpen,
    placeholder: "omop",
    required: true,
    descriptionKey: "dataSources.wizard.daimons.descriptions.vocabulary",
  },
  {
    key: "results" as const,
    labelKey: "dataSources.wizard.daimons.labels.results",
    icon: BarChart2,
    placeholder: "achilles_results",
    required: true,
    descriptionKey: "dataSources.wizard.daimons.descriptions.results",
  },
  {
    key: "temp" as const,
    labelKey: "dataSources.wizard.daimons.labels.temp",
    icon: Clock,
    placeholder: "temp",
    required: false,
    descriptionKey: "dataSources.wizard.daimons.descriptions.temp",
  },
];

export function DaimonsStep({ data, onChange }: Props) {
  const { t } = useTranslation("app");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          {t("dataSources.wizard.daimons.title")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("dataSources.wizard.daimons.subtitle")}
        </p>
      </div>

      <div className="space-y-3">
        {DAIMON_ROWS.map(({ key, labelKey, icon: Icon, placeholder, required, descriptionKey }) => (
          <div key={key} className="rounded-lg border border-border-default bg-surface-base px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-default bg-surface-raised">
                <Icon size={13} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-text-secondary">
                    {t(labelKey)}
                  </span>
                  {required ? (
                    <span className="text-critical text-xs">*</span>
                  ) : (
                    <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9px] font-medium text-text-ghost">
                      {t("dataSources.wizard.daimons.optional")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-ghost">{t(descriptionKey)}</p>
                <input
                  type="text"
                  value={data[key]}
                  onChange={(e) => onChange({ ...data, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full rounded-md border border-border-default bg-surface-raised px-3 py-1.5 font-mono text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
