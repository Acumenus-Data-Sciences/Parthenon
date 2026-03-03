import { Link } from "react-router-dom";
import type { ClinicalEvent, ClinicalDomain } from "../types/profile";

const DOMAIN_COLORS: Record<ClinicalDomain, string> = {
  condition: "#E85A6B",
  drug: "#2DD4BF",
  procedure: "#C9A227",
  measurement: "#818CF8",
  observation: "#94A3B8",
  visit: "#F59E0B",
};

const DOMAIN_LABELS: Record<ClinicalDomain, string> = {
  condition: "Condition",
  drug: "Drug",
  procedure: "Procedure",
  measurement: "Measurement",
  observation: "Observation",
  visit: "Visit",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ClinicalEventCardProps {
  event: ClinicalEvent;
}

export function ClinicalEventCard({ event }: ClinicalEventCardProps) {
  const color = DOMAIN_COLORS[event.domain] ?? "#8A857D";
  const label = DOMAIN_LABELS[event.domain] ?? event.domain;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-3 hover:bg-[#1A1A1E] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Concept name — links to vocabulary browser */}
          {event.concept_id ? (
            <Link
              to={`/vocabulary?concept=${event.concept_id}`}
              className="text-sm font-medium text-[#F0EDE8] hover:text-[#C9A227] transition-colors truncate block"
              title={`View concept ${event.concept_id} in Vocabulary Browser`}
            >
              {event.concept_name}
            </Link>
          ) : (
            <p className="text-sm font-medium text-[#F0EDE8] truncate">
              {event.concept_name}
            </p>
          )}

          {/* Dates */}
          <p className="mt-1 text-xs text-[#8A857D]">
            {formatDate(event.start_date)}
            {event.end_date && ` - ${formatDate(event.end_date)}`}
          </p>

          {/* Value + Unit for measurements */}
          {event.value != null && (
            <p className="mt-1 text-xs text-[#C9A227]">
              Value: {event.value}
              {event.unit ? ` ${event.unit}` : ""}
            </p>
          )}

          {/* Type name */}
          {event.type_name && (
            <p className="mt-0.5 text-[10px] text-[#5A5650]">
              {event.type_name}
            </p>
          )}
        </div>

        {/* Domain badge */}
        <span
          className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `${color}15`,
            color,
            border: `1px solid ${color}30`,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
