import { Activity, Skull, MapPin, Users, type LucideIcon } from "lucide-react";
import { useDiseaseSummary } from "../hooks/useGis";

interface DiseaseSummaryBarProps {
  conceptId: number | null;
}

export function DiseaseSummaryBar({ conceptId }: DiseaseSummaryBarProps) {
  const { data, isLoading } = useDiseaseSummary(conceptId);

  if (isLoading) {
    return (
      <div className="flex gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded bg-surface-elevated" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <Stat icon={Activity} label="Cases" value={data.total_cases.toLocaleString()} color="var(--accent)" />
      {data.total_deaths > 0 && (
        <Stat icon={Skull} label="Deaths" value={data.total_deaths.toLocaleString()} color="var(--primary)" />
      )}
      {data.total_deaths > 0 && (
        <Stat icon={Activity} label="CFR" value={`${data.case_fatality_rate}%`} color="var(--success)" />
      )}
      <Stat
        icon={MapPin}
        label="Counties"
        value={`${data.affected_counties} / ${data.total_counties}`}
        color="var(--text-muted)"
      />
      <Stat
        icon={Users}
        label="Prevalence"
        value={`${data.prevalence_per_100k.toLocaleString()} / 100K`}
        color="var(--text-ghost)"
      />
      {data.date_range.start && (
        <span className="text-[10px] text-text-ghost">
          {data.date_range.start.slice(0, 7)} — {data.date_range.end?.slice(0, 7) ?? "present"}
        </span>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="text-[10px] uppercase text-text-ghost">{label}</span>
      <span className="text-xs font-semibold text-[#E8E4DC]">{value}</span>
    </div>
  );
}
