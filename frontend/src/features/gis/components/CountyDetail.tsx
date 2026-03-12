import { X, Users, Activity, Skull, Building2 } from "lucide-react";
import { useCountyDetail } from "../hooks/useGis";

interface CountyDetailProps {
  gadmGid: string;
  conceptId: number;
  onClose: () => void;
}

export function CountyDetail({ gadmGid, conceptId, onClose }: CountyDetailProps) {
  const { data, isLoading } = useCountyDetail(gadmGid, conceptId);

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg border border-[#232328] bg-[#18181B] p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-[#232328]" />
        <div className="h-20 animate-pulse rounded bg-[#232328]" />
      </div>
    );
  }

  if (!data) return null;

  const m = data.metrics;

  return (
    <div className="space-y-3 rounded-lg border border-[#232328] bg-[#18181B] p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#E8E4DC]">{data.name} County</h3>
          {data.area_km2 && (
            <p className="text-xs text-[#5A5650]">{data.area_km2.toLocaleString()} km²</p>
          )}
        </div>
        <button onClick={onClose} className="text-[#5A5650] hover:text-[#E8E4DC]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {m.covid_cases && (
          <MetricCard icon={Activity} label="Cases" value={m.covid_cases.value} color="#C9A227" />
        )}
        {m.covid_deaths && (
          <MetricCard icon={Skull} label="Deaths" value={m.covid_deaths.value} color="#9B1B30" />
        )}
        {m.covid_cfr && (
          <MetricCard icon={Activity} label="CFR" value={`${m.covid_cfr.rate}%`} color="#2DD4BF" />
        )}
        {m.covid_hospitalization && (
          <MetricCard icon={Building2} label="Hospitalized" value={m.covid_hospitalization.value} color="#8A857D" />
        )}
        {m.patient_count && (
          <MetricCard icon={Users} label="Population" value={m.patient_count.value} color="#5A5650" />
        )}
      </div>

      {/* Demographics */}
      {data.demographics.age_groups.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
            Age Distribution (COVID)
          </span>
          <div className="space-y-1">
            {data.demographics.age_groups.map((ag) => {
              const maxCount = Math.max(...data.demographics.age_groups.map((a) => a.count));
              const pct = maxCount > 0 ? (ag.count / maxCount) * 100 : 0;
              return (
                <div key={ag.group} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-right text-[#8A857D]">{ag.group}</span>
                  <div className="flex-1 rounded-full bg-[#232328]">
                    <div
                      className="h-2 rounded-full bg-[#C9A227]/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-[#5A5650]">{ag.count.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gender */}
      {data.demographics.gender.length > 0 && (
        <div className="flex gap-3">
          {data.demographics.gender.map((g) => (
            <span key={g.gender} className="text-xs text-[#8A857D]">
              {g.gender}: <span className="font-medium text-[#E8E4DC]">{g.count.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {/* Mini timeline sparkline */}
      {data.timeline.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
            Monthly Cases
          </span>
          <div className="flex items-end gap-px" style={{ height: 40 }}>
            {data.timeline
              .filter((t) => t.metric === "covid_cases_monthly")
              .map((t) => {
                const max = Math.max(
                  ...data.timeline.filter((x) => x.metric === "covid_cases_monthly").map((x) => x.value)
                );
                const h = max > 0 ? (t.value / max) * 100 : 0;
                return (
                  <div
                    key={t.period}
                    className="flex-1 rounded-t bg-[#C9A227]/40 hover:bg-[#C9A227]/70"
                    style={{ height: `${h}%` }}
                    title={`${t.period}: ${t.value.toLocaleString()} cases`}
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  const display = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="rounded border border-[#232328] bg-[#0E0E11] p-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color }} />
        <span className="text-[10px] uppercase text-[#5A5650]">{label}</span>
      </div>
      <p className="mt-0.5 text-lg font-semibold text-[#E8E4DC]">{display}</p>
    </div>
  );
}
