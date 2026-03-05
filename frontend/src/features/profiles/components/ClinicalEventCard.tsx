import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
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

function RangeStatus({
  value,
  rangeLow,
  rangeHigh,
}: {
  value: number;
  rangeLow: number | null | undefined;
  rangeHigh: number | null | undefined;
}) {
  if (rangeLow == null || rangeHigh == null) return null;
  if (value < rangeLow) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-[#818CF8]">
        <TrendingDown size={10} /> Below range ({rangeLow})
      </span>
    );
  }
  if (value > rangeHigh) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-[#E85A6B]">
        <TrendingUp size={10} /> Above range ({rangeHigh})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-[#22C55E]">
      <Minus size={10} /> Normal ({rangeLow}–{rangeHigh})
    </span>
  );
}

interface ClinicalEventCardProps {
  event: ClinicalEvent;
}

export function ClinicalEventCard({ event }: ClinicalEventCardProps) {
  const color = DOMAIN_COLORS[event.domain] ?? "#8A857D";
  const label = DOMAIN_LABELS[event.domain] ?? event.domain;

  const numericValue =
    typeof event.value === "number" ? event.value : null;

  const displayValue =
    numericValue != null
      ? `${numericValue}${event.unit ? ` ${event.unit}` : ""}`
      : event.value_as_concept && event.value_as_concept !== ""
        ? event.value_as_concept
        : event.value_as_string && event.value_as_string !== ""
          ? event.value_as_string
          : null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-3 hover:bg-[#1A1A1E] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {/* Concept name */}
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
          <p className="text-xs text-[#8A857D]">
            {formatDate(event.start_date)}
            {event.end_date && event.end_date !== event.start_date
              ? ` – ${formatDate(event.end_date)}`
              : ""}
          </p>

          {/* Value (measurements, observations) */}
          {displayValue && (
            <p className="text-xs font-semibold text-[#C9A227]">
              {displayValue}
            </p>
          )}

          {/* Reference range status (measurements) */}
          {numericValue != null && (
            <RangeStatus
              value={numericValue}
              rangeLow={event.range_low}
              rangeHigh={event.range_high}
            />
          )}

          {/* Drug-specific details */}
          {event.domain === "drug" && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {event.route && (
                <p className="text-[10px] text-[#8A857D]">
                  Route: {event.route}
                </p>
              )}
              {event.days_supply != null && event.days_supply > 0 && (
                <p className="text-[10px] text-[#8A857D]">
                  {event.days_supply}d supply
                </p>
              )}
              {event.quantity != null && event.quantity > 0 && (
                <p className="text-[10px] text-[#8A857D]">
                  Qty: {event.quantity}
                </p>
              )}
            </div>
          )}

          {/* Procedure quantity */}
          {event.domain === "procedure" && event.quantity != null && event.quantity > 1 && (
            <p className="text-[10px] text-[#8A857D]">Qty: {event.quantity}</p>
          )}

          {/* Type name */}
          {event.type_name && (
            <p className="text-[10px] text-[#5A5650]">{event.type_name}</p>
          )}

          {/* Vocabulary */}
          {event.vocabulary && (
            <p className="text-[10px] text-[#3A3A40]">{event.vocabulary}</p>
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
