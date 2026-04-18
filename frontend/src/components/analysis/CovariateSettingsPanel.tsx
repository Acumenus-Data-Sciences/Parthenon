import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared covariate settings type used across estimation, prediction, SCCS
// ---------------------------------------------------------------------------

export interface CovariateSettings {
  useDemographics: boolean;
  useConditionOccurrence: boolean;
  useDrugExposure: boolean;
  useProcedureOccurrence: boolean;
  useMeasurement: boolean;
  useObservation?: boolean;
  useDeviceExposure?: boolean;
  useVisitCount?: boolean;
  useCharlsonIndex?: boolean;
  useDcsi?: boolean;
  useChads2?: boolean;
  useChads2Vasc?: boolean;
  timeWindows: { start: number; end: number }[];
}

const DOMAIN_OPTIONS: {
  key: keyof CovariateSettings;
  labelKey: string;
  group: "core" | "extended" | "index";
}[] = [
  { key: "useDemographics", labelKey: "demographics", group: "core" },
  {
    key: "useConditionOccurrence",
    labelKey: "conditionOccurrence",
    group: "core",
  },
  { key: "useDrugExposure", labelKey: "drugExposure", group: "core" },
  {
    key: "useProcedureOccurrence",
    labelKey: "procedureOccurrence",
    group: "core",
  },
  { key: "useMeasurement", labelKey: "measurement", group: "core" },
  { key: "useObservation", labelKey: "observation", group: "extended" },
  { key: "useDeviceExposure", labelKey: "deviceExposure", group: "extended" },
  { key: "useVisitCount", labelKey: "visitCount", group: "extended" },
  {
    key: "useCharlsonIndex",
    labelKey: "charlsonComorbidity",
    group: "index",
  },
  { key: "useDcsi", labelKey: "dcsi", group: "index" },
  { key: "useChads2", labelKey: "chads2", group: "index" },
  { key: "useChads2Vasc", labelKey: "chads2Vasc", group: "index" },
];

interface CovariateSettingsPanelProps {
  settings: CovariateSettings;
  onChange: (settings: CovariateSettings) => void;
  /** Which domain keys to show. Defaults to all. */
  visibleKeys?: (keyof CovariateSettings)[];
  /** Whether to show the time windows editor */
  showTimeWindows?: boolean;
}

export function CovariateSettingsPanel({
  settings,
  onChange,
  visibleKeys,
  showTimeWindows = true,
}: CovariateSettingsPanelProps) {
  const { t } = useTranslation("app");
  const options = visibleKeys
    ? DOMAIN_OPTIONS.filter((o) => visibleKeys.includes(o.key))
    : DOMAIN_OPTIONS;

  const coreOptions = options.filter((o) => o.group === "core");
  const extendedOptions = options.filter((o) => o.group === "extended");
  const indexOptions = options.filter((o) => o.group === "index");

  const timeWindows = settings.timeWindows ?? [];

  const toggleKey = (key: keyof CovariateSettings) => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  const updateWindow = (
    idx: number,
    field: "start" | "end",
    value: number,
  ) => {
    const newWindows = [...timeWindows];
    newWindows[idx] = { ...newWindows[idx], [field]: value };
    onChange({ ...settings, timeWindows: newWindows });
  };

  const removeWindow = (idx: number) => {
    onChange({
      ...settings,
      timeWindows: timeWindows.filter((_, i) => i !== idx),
    });
  };

  const addWindow = () => {
    onChange({
      ...settings,
      timeWindows: [...timeWindows, { start: -365, end: 0 }],
    });
  };

  const renderGroup = (label: string, items: typeof DOMAIN_OPTIONS) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
          {label}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((opt) => {
            const checked = !!settings[opt.key];
            return (
              <label
                key={opt.key}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                  checked
                    ? "border-success/30 bg-success/5 text-success"
                    : "border-border-default bg-surface-base text-text-muted hover:text-text-secondary",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleKey(opt.key)}
                  className="sr-only"
                />
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    checked
                      ? "border-success bg-success"
                      : "border-surface-highlight",
                  )}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="var(--surface-base)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                {t(`covariates.labels.${opt.labelKey}`)}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">
        {t("covariates.title")}
      </h3>
      <p className="text-xs text-text-muted">
        {t("covariates.description")}
      </p>

      {renderGroup(t("covariates.groups.core"), coreOptions)}
      {renderGroup(t("covariates.groups.extended"), extendedOptions)}
      {renderGroup(t("covariates.groups.indices"), indexOptions)}

      {/* Time Windows */}
      {showTimeWindows && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-text-muted mb-2">
            {t("covariates.timeWindows")}
          </label>
          {timeWindows.map((tw, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <input
                type="number"
                value={tw.start}
                onChange={(e) =>
                  updateWindow(idx, "start", Number(e.target.value))
                }
                className={cn(
                  "w-28 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                  "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
                )}
              />
              <span className="text-xs text-text-ghost">
                {t("covariates.to")}
              </span>
              <input
                type="number"
                value={tw.end}
                onChange={(e) =>
                  updateWindow(idx, "end", Number(e.target.value))
                }
                className={cn(
                  "w-28 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                  "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
                )}
              />
              <span className="text-xs text-text-ghost">
                {t("covariates.days")}
              </span>
              {timeWindows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWindow(idx)}
                  className="text-text-muted hover:text-critical transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addWindow}
            className="text-xs text-success hover:text-success-dark transition-colors"
          >
            + {t("covariates.addTimeWindow")}
          </button>
        </div>
      )}
    </div>
  );
}
