import { User, Calendar, MapPin, Heart } from "lucide-react";
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

export function PatientDemographicsCard({
  demographics,
  observationPeriods,
}: PatientDemographicsCardProps) {
  const age = computeAge(demographics.year_of_birth);

  const earliestObs = observationPeriods.length > 0
    ? observationPeriods.reduce((a, b) =>
        new Date(a.start_date) < new Date(b.start_date) ? a : b,
      )
    : null;
  const latestObs = observationPeriods.length > 0
    ? observationPeriods.reduce((a, b) =>
        new Date(a.end_date) > new Date(b.end_date) ? a : b,
      )
    : null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2DD4BF]/10">
          <User size={18} className="text-[#2DD4BF]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#F0EDE8]">
            Person #{demographics.person_id}
          </h2>
          <p className="text-xs text-[#8A857D]">Patient Profile</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Gender */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
            <Heart size={10} />
            Gender
          </div>
          <p className="text-sm font-medium text-[#F0EDE8]">
            {demographics.gender || "Unknown"}
          </p>
        </div>

        {/* Age / Year of Birth */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
            <Calendar size={10} />
            Age / Birth Year
          </div>
          <p className="text-sm font-medium text-[#F0EDE8]">
            {age} yrs ({demographics.year_of_birth})
          </p>
        </div>

        {/* Race */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
            <MapPin size={10} />
            Race
          </div>
          <p className="text-sm font-medium text-[#F0EDE8]">
            {demographics.race || "Unknown"}
          </p>
        </div>

        {/* Ethnicity */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
            <MapPin size={10} />
            Ethnicity
          </div>
          <p className="text-sm font-medium text-[#F0EDE8]">
            {demographics.ethnicity || "Unknown"}
          </p>
        </div>

        {/* Observation Period */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
            <Calendar size={10} />
            Observation Period
          </div>
          <p className="text-sm font-medium text-[#F0EDE8]">
            {earliestObs && latestObs
              ? `${formatDate(earliestObs.start_date)} - ${formatDate(latestObs.end_date)}`
              : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
