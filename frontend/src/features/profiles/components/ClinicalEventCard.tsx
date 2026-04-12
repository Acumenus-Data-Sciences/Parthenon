import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp, Minus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicalEvent, ClinicalDomain } from "../types/profile";

const DOMAIN_COLORS: Record<ClinicalDomain, string> = {
  condition: "var(--critical)",
  drug: "var(--success)",
  procedure: "var(--accent)",
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
      <span className="inline-flex items-center gap-0.5 text-[10px] text-info">
        <TrendingDown size={10} /> Below range ({rangeLow})
      </span>
    );
  }
  if (value > rangeHigh) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-critical">
        <TrendingUp size={10} /> Above range ({rangeHigh})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-success">
      <Minus size={10} /> Normal ({rangeLow}–{rangeHigh})
    </span>
  );
}

interface ClinicalEventCardProps {
  event: ClinicalEvent;
}

// ---------------------------------------------------------------------------
// Grouped concept card — collapses multiple occurrences of the same concept
// ---------------------------------------------------------------------------

interface GroupedConceptCardProps {
  conceptId: number | null;
  conceptName: string;
  domain: ClinicalDomain;
  events: ClinicalEvent[];
  firstDate: string;
  lastDate: string;
}

export function GroupedConceptCard({
  conceptId,
  conceptName,
  domain,
  events,
  firstDate,
  lastDate,
}: GroupedConceptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = DOMAIN_COLORS[domain] ?? "var(--text-muted)";
  const label = DOMAIN_LABELS[domain] ?? domain;
  const count = events.length;
  const latestWithValue = domain === "measurement" ? events.find((e) => e.value != null) : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised">
      <div
        className={cn(
          "flex items-start justify-between gap-3 p-3 transition-colors",
          count > 1 && "cursor-pointer hover:bg-surface-overlay",
        )}
        onClick={() => count > 1 && setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          {conceptId ? (
            <Link
              to={`/vocabulary?concept=${conceptId}`}
              className="text-sm font-medium text-text-primary hover:text-accent transition-colors truncate block"
              onClick={(e) => e.stopPropagation()}
            >
              {conceptName}
            </Link>
          ) : (
            <p className="text-sm font-medium text-text-primary truncate">{conceptName}</p>
          )}
          <p className="text-xs text-text-muted">
            {count === 1 || firstDate === lastDate
              ? formatDate(firstDate)
              : `${formatDate(firstDate)} – ${formatDate(lastDate)}`}
          </p>
          {latestWithValue?.value != null && (
            <p className="text-xs font-semibold text-accent">
              Latest: {String(latestWithValue.value)}
              {latestWithValue.unit ? ` ${latestWithValue.unit}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {count > 1 && (
            <span className="text-[10px] text-text-muted bg-surface-elevated rounded-full px-2 py-0.5">
              {count}×
            </span>
          )}
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${color}15`,
              color,
              border: `1px solid ${color}30`,
            }}
          >
            {label}
          </span>
          {count > 1 && (
            <ChevronDown
              size={12}
              className={cn(
                "text-text-ghost transition-transform shrink-0",
                expanded && "rotate-180",
              )}
            />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-default px-3 py-2 space-y-1">
          {events.map((ev, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-text-muted">
              <span>
                {formatDate(ev.start_date)}
                {ev.end_date && ev.end_date !== ev.start_date
                  ? ` – ${formatDate(ev.end_date)}`
                  : ""}
              </span>
              {ev.value != null && (
                <span className="text-accent">
                  {String(ev.value)}
                  {ev.unit ? ` ${ev.unit}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual event card
// ---------------------------------------------------------------------------

export function ClinicalEventCard({ event }: ClinicalEventCardProps) {
  const color = DOMAIN_COLORS[event.domain] ?? "var(--text-muted)";
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
    <div className="rounded-lg border border-border-default bg-surface-raised p-3 hover:bg-surface-overlay transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {/* Concept name */}
          {event.concept_id ? (
            <Link
              to={`/vocabulary?concept=${event.concept_id}`}
              className="text-sm font-medium text-text-primary hover:text-accent transition-colors truncate block"
              title={`View concept ${event.concept_id} in Vocabulary Browser`}
            >
              {event.concept_name}
            </Link>
          ) : (
            <p className="text-sm font-medium text-text-primary truncate">
              {event.concept_name}
            </p>
          )}

          {/* Dates */}
          <p className="text-xs text-text-muted">
            {formatDate(event.start_date)}
            {event.end_date && event.end_date !== event.start_date
              ? ` – ${formatDate(event.end_date)}`
              : ""}
          </p>

          {/* Value (measurements, observations) */}
          {displayValue && (
            <p className="text-xs font-semibold text-accent">
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
                <p className="text-[10px] text-text-muted">
                  Route: {event.route}
                </p>
              )}
              {event.days_supply != null && event.days_supply > 0 && (
                <p className="text-[10px] text-text-muted">
                  {event.days_supply}d supply
                </p>
              )}
              {event.quantity != null && event.quantity > 0 && (
                <p className="text-[10px] text-text-muted">
                  Qty: {event.quantity}
                </p>
              )}
            </div>
          )}

          {/* Procedure quantity */}
          {event.domain === "procedure" && event.quantity != null && event.quantity > 1 && (
            <p className="text-[10px] text-text-muted">Qty: {event.quantity}</p>
          )}

          {/* Type name */}
          {event.type_name && (
            <p className="text-[10px] text-text-ghost">{event.type_name}</p>
          )}

          {/* Vocabulary */}
          {event.vocabulary && (
            <p className="text-[10px] text-surface-highlight">{event.vocabulary}</p>
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
