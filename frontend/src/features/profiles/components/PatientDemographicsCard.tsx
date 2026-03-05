import { User, Calendar, MapPin, Heart, Globe, Clock } from "lucide-react";
import type { PatientDemographics, ObservationPeriod } from "../types/profile";

interface PatientDemographicsCardProps {
  demographics: PatientDemographics;
  observationPeriods: ObservationPeriod[];
}

function computeAge(yearOfBirth: number): number {
  return new Date().getFullYear() - yearOfBirth;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24),
  );
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function Field({ icon, label, value }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-[#F0EDE8]">{value}</div>
    </div>
  );
}

export function PatientDemographicsCard({
  demographics,
  observationPeriods,
}: PatientDemographicsCardProps) {
  const age = computeAge(demographics.year_of_birth);

  // Build location string
  const locationParts = [
    demographics.city,
    demographics.state,
    demographics.zip,
  ].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(", ") : null;

  // Sort periods by start date
  const sortedPeriods = [...observationPeriods].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  const totalObsDays = sortedPeriods.reduce(
    (sum, p) => sum + daysBetween(p.start_date, p.end_date),
    0,
  );

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2DD4BF]/10">
          <User size={18} className="text-[#2DD4BF]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#F0EDE8]">
            Person #{demographics.person_id}
          </h2>
          <p className="text-xs text-[#8A857D]">Patient Demographics</p>
        </div>
      </div>

      {/* Core demographics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 pb-5 border-b border-[#232328]">
        <Field
          icon={<Heart size={10} />}
          label="Gender"
          value={demographics.gender || "Unknown"}
        />
        <Field
          icon={<Calendar size={10} />}
          label="Age / Birth Year"
          value={`${age} yrs (${demographics.year_of_birth})`}
        />
        <Field
          icon={<Globe size={10} />}
          label="Race"
          value={demographics.race || "Unknown"}
        />
        <Field
          icon={<MapPin size={10} />}
          label="Ethnicity"
          value={demographics.ethnicity || "Unknown"}
        />
      </div>

      {/* Location + observation periods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
        {/* Location */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
            <MapPin size={10} />
            Location
          </div>
          <p className="text-sm font-medium text-[#F0EDE8]">
            {locationStr ?? "Not recorded"}
          </p>
          {demographics.county && (
            <p className="text-xs text-[#5A5650]">{demographics.county} County</p>
          )}
        </div>

        {/* Observation periods */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
              <Clock size={10} />
              Observation Periods
            </div>
            {totalObsDays > 0 && (
              <span className="text-[10px] text-[#2DD4BF]">
                {totalObsDays.toLocaleString()} total days
              </span>
            )}
          </div>
          {sortedPeriods.length === 0 ? (
            <p className="text-sm text-[#5A5650]">None recorded</p>
          ) : (
            <div className="space-y-1.5">
              {sortedPeriods.map((p, i) => {
                const days = daysBetween(p.start_date, p.end_date);
                return (
                  <div key={i} className="flex items-center gap-2">
                    {/* Period bar */}
                    <div className="flex-1 relative h-4 rounded bg-[#1A1A1E] border border-[#232328] overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#2DD4BF]/20 rounded"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-[#8A857D] whitespace-nowrap">
                        {formatDate(p.start_date)} – {formatDate(p.end_date)}
                      </p>
                      <p className="text-[9px] text-[#5A5650] text-right">
                        {days}d
                        {p.period_type ? ` · ${p.period_type}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
