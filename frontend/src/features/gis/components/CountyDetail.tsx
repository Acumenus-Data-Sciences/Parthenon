import { X, Users, Activity, Skull, Building2, type LucideIcon } from "lucide-react";
import { useCountyDetail } from "../hooks/useGis";
import { useTranslation } from "react-i18next";

interface CountyDetailProps {
  gadmGid: string;
  conceptId: number;
  onClose: () => void;
}

export function CountyDetail({ gadmGid, conceptId, onClose }: CountyDetailProps) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useCountyDetail(gadmGid, conceptId);

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg border border-border-default bg-surface-raised p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-elevated" />
        <div className="h-20 animate-pulse rounded bg-surface-elevated" />
      </div>
    );
  }

  if (!data) return null;

  const m = data.metrics;

  return (
    <div className="space-y-3 rounded-lg border border-border-default bg-surface-raised p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {data.name} {t("gis.countyDetail.county")}
          </h3>
          {data.area_km2 && (
            <p className="text-xs text-text-ghost">{data.area_km2.toLocaleString()} km²{/* i18n-exempt: measurement unit */}</p>
          )}
        </div>
        <button onClick={onClose} className="text-text-ghost hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {m.covid_cases && (
          <MetricCard icon={Activity} label={t("gis.countyDetail.cases")} value={m.covid_cases.value} color="var(--accent)" />
        )}
        {m.covid_deaths && (
          <MetricCard icon={Skull} label={t("gis.countyDetail.deaths")} value={m.covid_deaths.value} color="var(--primary)" />
        )}
        {m.covid_cfr && (
          <MetricCard icon={Activity} label={t("gis.countyDetail.cfr")} value={`${m.covid_cfr.rate}%`} color="var(--success)" />
        )}
        {m.covid_hospitalization && (
          <MetricCard icon={Building2} label={t("gis.countyDetail.hospitalized")} value={m.covid_hospitalization.value} color="var(--text-muted)" />
        )}
        {m.patient_count && (
          <MetricCard icon={Users} label={t("gis.countyDetail.population")} value={m.patient_count.value} color="var(--text-ghost)" />
        )}
      </div>

      {/* Demographics */}
      {data.demographics.age_groups.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("gis.countyDetail.ageDistributionCovid")}
          </span>
          <div className="space-y-1">
            {data.demographics.age_groups.map((ag) => {
              const maxCount = Math.max(...data.demographics.age_groups.map((a) => a.count));
              const pct = maxCount > 0 ? (ag.count / maxCount) * 100 : 0;
              return (
                <div key={ag.group} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-right text-text-muted">{ag.group}</span>
                  <div className="flex-1 rounded-full bg-surface-elevated">
                    <div
                      className="h-2 rounded-full bg-accent/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-text-ghost">{ag.count.toLocaleString()}</span>
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
            <span key={g.gender} className="text-xs text-text-muted">
              {g.gender}: <span className="font-medium text-text-primary">{g.count.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {/* Mini timeline sparkline */}
      {data.timeline.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("gis.countyDetail.monthlyCases")}
          </span>
          <div className="flex items-end gap-px" style={{ height: 40 }}>
            {data.timeline
              .filter((t) => t.metric === "covid_cases_monthly")
              .map((timelinePoint) => {
                const max = Math.max(
                  ...data.timeline.filter((x) => x.metric === "covid_cases_monthly").map((x) => x.value)
                );
                const h = max > 0 ? (timelinePoint.value / max) * 100 : 0;
                return (
                  <div
                    key={timelinePoint.period}
                    className="flex-1 rounded-t bg-accent/40 hover:bg-accent/70"
                    style={{ height: `${h}%` }}
                    title={t("gis.countyDetail.casesTitle", {
                      period: timelinePoint.period,
                      count: timelinePoint.value.toLocaleString(),
                    })}
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
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
}) {
  const display = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="rounded border border-border-default bg-surface-base p-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color }} />
        <span className="text-[10px] uppercase text-text-ghost">{label}</span>
      </div>
      <p className="mt-0.5 text-lg font-semibold text-text-primary">{display}</p>
    </div>
  );
}
