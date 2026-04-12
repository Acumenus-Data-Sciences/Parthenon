import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  Calendar,
  Clock,
  Eye,
  FlaskConical,
  Globe,
  Heart,
  MapPin,
  Pill,
  Stethoscope,
  TrendingUp,
  User,
  CalendarRange,
} from "lucide-react";
import type { PatientProfile, ObservationPeriod } from "../types/profile";
import type { ProfileStats } from "../api/profileApi";

interface PatientProfileHeaderProps {
  profile: PatientProfile;
  stats?: ProfileStats;
  onDrillDown?: (view: string, domain?: string) => void;
}

function computeAge(yearOfBirth: number): number {
  return new Date().getFullYear() - yearOfBirth;
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

function obsSpanSummary(periods: ObservationPeriod[]): { days: number; range: string } | null {
  if (periods.length === 0) return null;
  const sorted = [...periods].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    days: daysBetween(first.start_date, last.end_date),
    range: `${formatDate(first.start_date)} \u2013 ${formatDate(last.end_date)}`,
  };
}

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  onClick?: () => void;
}

function MiniStat({ icon, label, value, color, onClick }: MiniStatProps) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-[#232328] bg-[#0E0E11] px-2.5 py-1.5 shrink-0 transition-colors",
        onClick && "cursor-pointer hover:border-[#3A3A40] hover:bg-[#1A1A1E]",
        !onClick && "cursor-default",
      )}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-[#5A5650]">
        {label}
      </span>
      <span className="text-sm font-bold leading-none" style={{ color }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </button>
  );
}

function DemoBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#8A857D]">
      {icon}
      {text}
    </span>
  );
}

export function PatientProfileHeader({
  profile,
  stats: domainStats,
  onDrillDown,
}: PatientProfileHeaderProps) {
  const { demographics, observation_periods } = profile;

  const age = demographics.death_date
    ? new Date(demographics.death_date).getFullYear() - demographics.year_of_birth
    : computeAge(demographics.year_of_birth);

  const locationParts = [
    demographics.city,
    demographics.state,
    demographics.zip,
  ].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(", ") : null;

  const obsSpan = obsSpanSummary(observation_periods);

  const stats = useMemo(() => {
    const { conditions, drugs, procedures, measurements, observations, visits } = profile;

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
      visitCount: visitTotal,
      measurementCount: measurementTotal,
      observationCount: observationTotal,
      lastEventDate,
    };
  }, [profile, domainStats]);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
      {/* Row 1: Identity + demographics */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Avatar */}
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#2DD4BF]/10 shrink-0">
          <User size={16} className="text-[#2DD4BF]" />
        </div>

        {/* Name + ID */}
        <div className="shrink-0">
          <h2 className="text-base font-bold text-[#F0EDE8] leading-tight">
            {demographics.patient_name || `Person #${demographics.person_id}`}
          </h2>
          {demographics.patient_name && (
            <span className="text-[10px] text-[#5A5650]">
              Person #{demographics.person_id}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-[#232328] shrink-0 hidden sm:block" />

        {/* Demographic badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <DemoBadge
            icon={<Heart size={10} />}
            text={`${demographics.gender || "Unknown"} \u00B7 ${demographics.death_date ? `${age} yrs at death` : `${age} yrs`} (${demographics.year_of_birth})`}
          />
          <DemoBadge
            icon={<Globe size={10} />}
            text={demographics.race || "Unknown race"}
          />
          <DemoBadge
            icon={<Calendar size={10} />}
            text={demographics.ethnicity || "Unknown ethnicity"}
          />
          {locationStr && (
            <DemoBadge
              icon={<MapPin size={10} />}
              text={`${locationStr}${demographics.county ? ` (${demographics.county} Co.)` : ""}`}
            />
          )}
          {obsSpan && (
            <DemoBadge
              icon={<Clock size={10} />}
              text={`${obsSpan.days.toLocaleString()}d obs \u00B7 ${obsSpan.range}`}
            />
          )}
        </div>

        {/* Death badge (right-aligned) */}
        {demographics.death_date && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#E85A6B]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#E85A6B] border border-[#E85A6B]/20 shrink-0">
            Deceased {formatDate(demographics.death_date)}
            {demographics.cause_of_death && (
              <span className="font-normal text-[#E85A6B]/70"> \u00B7 {demographics.cause_of_death}</span>
            )}
          </span>
        )}
      </div>

      {/* Row 2: Compact stat pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        <MiniStat
          icon={<Activity size={12} />}
          label="Events"
          value={stats.totalEvents}
          color="#2DD4BF"
          onClick={onDrillDown ? () => onDrillDown("list", "all") : undefined}
        />
        <MiniStat
          icon={<CalendarRange size={12} />}
          label="Obs Span"
          value={obsSpan ? `${obsSpan.days.toLocaleString()}d` : "N/A"}
          color="#818CF8"
        />
        <MiniStat
          icon={<Stethoscope size={12} />}
          label="Conditions"
          value={stats.uniqueConditions}
          color="#E85A6B"
          onClick={onDrillDown ? () => onDrillDown("list", "condition") : undefined}
        />
        <MiniStat
          icon={<Pill size={12} />}
          label="Drugs"
          value={stats.uniqueDrugs}
          color="#2DD4BF"
          onClick={onDrillDown ? () => onDrillDown("list", "drug") : undefined}
        />
        <MiniStat
          icon={<TrendingUp size={12} />}
          label="Visits"
          value={stats.visitCount}
          color="#F59E0B"
          onClick={onDrillDown ? () => onDrillDown("visits") : undefined}
        />
        <MiniStat
          icon={<FlaskConical size={12} />}
          label="Labs"
          value={stats.measurementCount}
          color="#818CF8"
          onClick={onDrillDown ? () => onDrillDown("labs") : undefined}
        />
        <MiniStat
          icon={<Eye size={12} />}
          label="Observations"
          value={stats.observationCount}
          color="#94A3B8"
          onClick={onDrillDown ? () => onDrillDown("list", "observation") : undefined}
        />
        {stats.lastEventDate && (
          <MiniStat
            icon={<Clock size={12} />}
            label="Last"
            value={new Date(stats.lastEventDate).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
            color="#C9A227"
          />
        )}
      </div>
    </div>
  );
}
