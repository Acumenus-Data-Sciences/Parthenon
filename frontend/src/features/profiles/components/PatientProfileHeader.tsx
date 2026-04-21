import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatDate as formatAppDate } from "@/i18n/format";
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
import { getProfileGenderLabel } from "../lib/i18n";

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
  return formatAppDate(iso, {
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
        "inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-base px-2.5 py-1.5 shrink-0 transition-colors",
        onClick && "cursor-pointer hover:border-surface-highlight hover:bg-surface-overlay",
        !onClick && "cursor-default",
      )}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-ghost">
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
    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
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
  const { t } = useTranslation("app");
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
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
      {/* Row 1: Identity + demographics */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Avatar */}
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-success/10 shrink-0">
          <User size={16} className="text-success" />
        </div>

        {/* Name + ID */}
        <div className="shrink-0">
          <h2 className="text-base font-bold text-text-primary leading-tight">
            {demographics.patient_name ||
              t("profiles.header.fallbackName", {
                id: demographics.person_id,
              })}
          </h2>
          {demographics.patient_name && (
            <span className="text-[10px] text-text-ghost">
              {t("profiles.common.personLabel", { id: demographics.person_id })}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-surface-elevated shrink-0 hidden sm:block" />

        {/* Demographic badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <DemoBadge
            icon={<Heart size={10} />}
            text={`${getProfileGenderLabel(t, demographics.gender)} · ${
              demographics.death_date
                ? t("profiles.header.demographics.yearsAtDeath", {
                    count: age,
                  })
                : t("profiles.header.demographics.years", {
                    count: age,
                  })
            } (${demographics.year_of_birth})`}
          />
          <DemoBadge
            icon={<Globe size={10} />}
            text={
              demographics.race || t("profiles.header.demographics.unknownRace")
            }
          />
          <DemoBadge
            icon={<Calendar size={10} />}
            text={
              demographics.ethnicity ||
              t("profiles.header.demographics.unknownEthnicity")
            }
          />
          {locationStr && (
            <DemoBadge
              icon={<MapPin size={10} />}
              text={`${locationStr}${
                demographics.county
                  ? ` ${t("profiles.header.demographics.county", {
                      county: demographics.county,
                    })}`
                  : ""
              }`}
            />
          )}
          {obsSpan && (
            <DemoBadge
              icon={<Clock size={10} />}
              text={`${t("profiles.header.demographics.observationSpan", {
                count: obsSpan.days,
              })} · ${obsSpan.range}`}
            />
          )}
        </div>

        {/* Death badge (right-aligned) */}
        {demographics.death_date && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-critical/10 px-2.5 py-0.5 text-[10px] font-semibold text-critical border border-critical/20 shrink-0">
            {t("profiles.header.demographics.deceased", {
              date: formatDate(demographics.death_date),
            })}
            {demographics.cause_of_death && (
              <span className="font-normal text-critical/70">
                {` ${demographics.cause_of_death}`}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Row 2: Compact stat pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        <MiniStat
          icon={<Activity size={12} />}
          label={t("profiles.header.stats.events")}
          value={stats.totalEvents}
          color="var(--success)"
          onClick={onDrillDown ? () => onDrillDown("list", "all") : undefined}
        />
        <MiniStat
          icon={<CalendarRange size={12} />}
          label={t("profiles.header.stats.observationSpan")}
          value={
            obsSpan
              ? t("profiles.header.demographics.observationSpan", {
                  count: obsSpan.days,
                })
              : t("profiles.common.notAvailable")
          }
          color="var(--info)"
        />
        <MiniStat
          icon={<Stethoscope size={12} />}
          label={t("profiles.header.stats.conditions")}
          value={stats.uniqueConditions}
          color="var(--critical)"
          onClick={onDrillDown ? () => onDrillDown("list", "condition") : undefined}
        />
        <MiniStat
          icon={<Pill size={12} />}
          label={t("profiles.header.stats.drugs")}
          value={stats.uniqueDrugs}
          color="var(--success)"
          onClick={onDrillDown ? () => onDrillDown("list", "drug") : undefined}
        />
        <MiniStat
          icon={<TrendingUp size={12} />}
          label={t("profiles.header.stats.visits")}
          value={stats.visitCount}
          color="var(--warning)"
          onClick={onDrillDown ? () => onDrillDown("visits") : undefined}
        />
        <MiniStat
          icon={<FlaskConical size={12} />}
          label="Labs"
          value={stats.measurementCount}
          color="var(--info)"
          onClick={onDrillDown ? () => onDrillDown("labs") : undefined}
        />
        <MiniStat
          icon={<Eye size={12} />}
          label="Observations"
          value={stats.observationCount}
          color="var(--text-muted)"
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
            color="var(--accent)"
          />
        )}
      </div>
    </div>
  );
}
