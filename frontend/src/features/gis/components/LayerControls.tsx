import type { AdminLevel, ChoroplethMetric, Country } from "../types";

interface LayerControlsProps {
  level: AdminLevel;
  onLevelChange: (level: AdminLevel) => void;
  metric: ChoroplethMetric;
  onMetricChange: (metric: ChoroplethMetric) => void;
  countryCode: string | null;
  onCountryChange: (code: string | null) => void;
  countries: Country[];
}

const LEVEL_OPTIONS: { value: AdminLevel; label: string }[] = [
  { value: "ADM0", label: "Countries" },
  { value: "ADM1", label: "States / Provinces" },
  { value: "ADM2", label: "Districts / Counties" },
  { value: "ADM3", label: "Sub-districts" },
];

const METRIC_OPTIONS: { value: ChoroplethMetric; label: string }[] = [
  { value: "patient_count", label: "Patient Count" },
  { value: "condition_prevalence", label: "Condition Prevalence" },
  { value: "incidence_rate", label: "Incidence Rate" },
  { value: "exposure_value", label: "Exposure Value" },
  { value: "mortality_rate", label: "Mortality Rate" },
];

export function LayerControls({
  level,
  onLevelChange,
  metric,
  onMetricChange,
  countryCode,
  onCountryChange,
  countries,
}: LayerControlsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#232328] bg-[#141418] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        Map Controls
      </h3>

      <div>
        <label className="mb-1 block text-xs text-[#8A857D]">Boundary Level</label>
        <select
          value={level}
          onChange={(e) => onLevelChange(e.target.value as AdminLevel)}
          className="w-full rounded border border-[#232328] bg-[#0E0E11] px-2 py-1.5 text-sm text-[#E8E4DC] focus:border-[#C9A227] focus:outline-none"
        >
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[#8A857D]">Metric</label>
        <select
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as ChoroplethMetric)}
          className="w-full rounded border border-[#232328] bg-[#0E0E11] px-2 py-1.5 text-sm text-[#E8E4DC] focus:border-[#C9A227] focus:outline-none"
        >
          {METRIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[#8A857D]">Country</label>
        <select
          value={countryCode ?? ""}
          onChange={(e) => onCountryChange(e.target.value || null)}
          className="w-full rounded border border-[#232328] bg-[#0E0E11] px-2 py-1.5 text-sm text-[#E8E4DC] focus:border-[#C9A227] focus:outline-none"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.boundaries})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
