import { useMemo } from "react";
import {
  Activity,
  Pill,
  Stethoscope,
  FlaskConical,
  Eye,
  CalendarRange,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { PatientProfile } from "../types/profile";
import type { ProfileStats } from "../api/profileApi";

interface PatientSummaryStatsProps {
  profile: PatientProfile;
  /** Optional real totals from the stats endpoint (may exceed loaded counts if capped). */
  stats?: ProfileStats;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}

function StatPill({ icon, label, value, sub, color }: StatPillProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#151518] px-4 py-3 shrink-0">
      <div
        className="flex items-center justify-center w-8 h-8 rounded-md"
        style={{ backgroundColor: `${color}18` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight" style={{ color }}>
          {value}
        </p>
        {sub && <p className="text-[10px] text-[#5A5650] leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

export function PatientSummaryStats({ profile, stats: domainStats }: PatientSummaryStatsProps) {
  const stats = useMemo(() => {
    const { conditions, drugs, procedures, measurements, observations, visits, observation_periods } =
      profile;

    // Use real totals from stats endpoint when available (loaded counts may be capped at 2000)
    const conditionTotal = domainStats?.condition ?? conditions.length;
    const drugTotal = domainStats?.drug ?? drugs.length;
    const measurementTotal = domainStats?.measurement ?? measurements.length;
    const visitTotal = domainStats?.visit ?? visits.length;
    const observationTotal = domainStats?.observation ?? observations.length;

    const totalEvents =
      conditionTotal +
      drugTotal +
      (domainStats?.procedure ?? procedures.length) +
      measurementTotal +
      observationTotal +
      visitTotal;

    const uniqueConditions = new Set(conditions.map((e) => e.concept_id)).size;
    const uniqueDrugs = new Set(drugs.map((e) => e.concept_id)).size;

    // Observation span
    let obsSpanDays: number | null = null;
    let obsCoverage = "";
    if (observation_periods.length > 0) {
      const sorted = [...observation_periods].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      obsSpanDays = daysBetween(first.start_date, last.end_date);
      obsCoverage = `${formatDate(first.start_date)} – ${formatDate(last.end_date)}`;
    }

    // Last event date
    const allDates = [
      ...conditions,
      ...drugs,
      ...procedures,
      ...measurements,
      ...observations,
      ...visits,
    ]
      .map((e) => e.start_date)
      .filter(Boolean)
      .sort();
    const lastEventDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;

    return {
      totalEvents,
      uniqueConditions,
      uniqueDrugs,
      obsSpanDays,
      obsCoverage,
      visitCount: visitTotal,
      measurementCount: measurementTotal,
      observationCount: observationTotal,
      lastEventDate,
    };
  }, [profile, domainStats]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <StatPill
        icon={<Activity size={16} />}
        label="Total Events"
        value={stats.totalEvents.toLocaleString()}
        color="#2DD4BF"
      />
      <StatPill
        icon={<CalendarRange size={16} />}
        label="Obs. Span"
        value={
          stats.obsSpanDays != null
            ? `${stats.obsSpanDays.toLocaleString()}d`
            : "N/A"
        }
        sub={stats.obsCoverage || undefined}
        color="#818CF8"
      />
      <StatPill
        icon={<Stethoscope size={16} />}
        label="Conditions"
        value={stats.uniqueConditions}
        sub={`${profile.conditions.length} occurrences`}
        color="#E85A6B"
      />
      <StatPill
        icon={<Pill size={16} />}
        label="Drugs"
        value={stats.uniqueDrugs}
        sub={`${profile.drugs.length} exposures`}
        color="#2DD4BF"
      />
      <StatPill
        icon={<TrendingUp size={16} />}
        label="Visits"
        value={stats.visitCount}
        color="#F59E0B"
      />
      <StatPill
        icon={<FlaskConical size={16} />}
        label="Labs"
        value={stats.measurementCount.toLocaleString()}
        color="#818CF8"
      />
      {stats.lastEventDate && (
        <StatPill
          icon={<Clock size={16} />}
          label="Last Activity"
          value={new Date(stats.lastEventDate).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })}
          color="#C9A227"
        />
      )}
      <StatPill
        icon={<Eye size={16} />}
        label="Observations"
        value={stats.observationCount.toLocaleString()}
        color="#94A3B8"
      />
    </div>
  );
}
