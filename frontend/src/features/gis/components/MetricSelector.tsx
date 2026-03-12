import type { CdmMetricType } from "../types";

interface MetricSelectorProps {
  value: CdmMetricType;
  onChange: (metric: CdmMetricType) => void;
}

const METRICS: { value: CdmMetricType; label: string; description: string }[] = [
  { value: "cases", label: "Cases", description: "Total confirmed cases" },
  { value: "deaths", label: "Deaths", description: "Associated mortality" },
  { value: "cfr", label: "CFR %", description: "Case fatality rate (deaths / cases)" },
  { value: "hospitalization", label: "Hospitalized", description: "Inpatient admissions" },
  { value: "patient_count", label: "Population", description: "Total patients per county" },
];

export function MetricSelector({ value, onChange }: MetricSelectorProps) {
  return (
    <div className="space-y-1.5 rounded-lg border border-[#232328] bg-[#18181B] p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        Metric
      </span>
      <div className="flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            title={m.description}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              value === m.value
                ? "bg-[#C9A227]/20 text-[#C9A227] font-medium"
                : "bg-[#232328] text-[#5A5650] hover:text-[#8A857D]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
