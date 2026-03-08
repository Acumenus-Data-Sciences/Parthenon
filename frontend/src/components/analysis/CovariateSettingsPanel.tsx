import { X } from "lucide-react";
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
  label: string;
  group: "core" | "extended" | "index";
}[] = [
  { key: "useDemographics", label: "Demographics", group: "core" },
  { key: "useConditionOccurrence", label: "Condition Occurrence", group: "core" },
  { key: "useDrugExposure", label: "Drug Exposure", group: "core" },
  { key: "useProcedureOccurrence", label: "Procedure Occurrence", group: "core" },
  { key: "useMeasurement", label: "Measurement", group: "core" },
  { key: "useObservation", label: "Observation", group: "extended" },
  { key: "useDeviceExposure", label: "Device Exposure", group: "extended" },
  { key: "useVisitCount", label: "Visit Count", group: "extended" },
  { key: "useCharlsonIndex", label: "Charlson Comorbidity", group: "index" },
  { key: "useDcsi", label: "DCSI (Diabetes)", group: "index" },
  { key: "useChads2", label: "CHADS2", group: "index" },
  { key: "useChads2Vasc", label: "CHA2DS2-VASc", group: "index" },
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
        <p className="text-[10px] uppercase tracking-wider text-[#5A5650] font-semibold">
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
                    ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/5 text-[#2DD4BF]"
                    : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]",
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
                      ? "border-[#2DD4BF] bg-[#2DD4BF]"
                      : "border-[#323238]",
                  )}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="#0E0E11"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
      <h3 className="text-sm font-semibold text-[#F0EDE8]">
        Covariate Settings
      </h3>
      <p className="text-xs text-[#8A857D]">
        Select which domains to include as covariates for FeatureExtraction.
      </p>

      {renderGroup("Core Domains", coreOptions)}
      {renderGroup("Extended Domains", extendedOptions)}
      {renderGroup("Comorbidity Indices", indexOptions)}

      {/* Time Windows */}
      {showTimeWindows && (
        <div className="mt-4">
          <label className="block text-xs font-medium text-[#8A857D] mb-2">
            Time Windows
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
                  "w-28 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
              <span className="text-xs text-[#5A5650]">to</span>
              <input
                type="number"
                value={tw.end}
                onChange={(e) =>
                  updateWindow(idx, "end", Number(e.target.value))
                }
                className={cn(
                  "w-28 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
              <span className="text-xs text-[#5A5650]">days</span>
              {timeWindows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWindow(idx)}
                  className="text-[#8A857D] hover:text-[#E85A6B] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addWindow}
            className="text-xs text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
          >
            + Add time window
          </button>
        </div>
      )}
    </div>
  );
}
