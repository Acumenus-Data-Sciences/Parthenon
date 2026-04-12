import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ExternalLink, Tag, Hash, Database } from "lucide-react";
import { cn } from "@/lib/utils";
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
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface ConceptDetailDrawerProps {
  event: ClinicalEvent | null;
  onClose: () => void;
}

export function ConceptDetailDrawer({ event, onClose }: ConceptDetailDrawerProps) {
  const navigate = useNavigate();

  // Close on Escape
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  if (!event) return null;

  const color = DOMAIN_COLORS[event.domain] ?? "#8A857D";
  const domainLabel = DOMAIN_LABELS[event.domain] ?? event.domain;
  const numericValue = typeof event.value === "number" ? event.value : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-80 z-50 flex flex-col bg-[#0E0E11] border-l border-[#232328] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[#232328]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
                style={{
                  backgroundColor: `${color}15`,
                  color,
                  border: `1px solid ${color}30`,
                }}
              >
                {domainLabel}
              </span>
              {event.vocabulary && (
                <span className="text-[10px] text-[#5A5650] truncate">{event.vocabulary}</span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-[#F0EDE8] leading-snug">
              {event.concept_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[#5A5650] hover:text-[#F0EDE8] transition-colors mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Concept identifiers */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
              Concept
            </h3>
            <div className="space-y-2">
              <Row icon={<Hash size={12} />} label="Concept ID" value={String(event.concept_id)} mono />
              {event.vocabulary && (
                <Row icon={<Database size={12} />} label="Vocabulary" value={event.vocabulary} />
              )}
              <Row icon={<Tag size={12} />} label="Domain" value={domainLabel} />
              {event.type_name && (
                <Row icon={<Tag size={12} />} label="Record Type" value={event.type_name} />
              )}
            </div>
          </section>

          {/* Dates */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
              Occurrence
            </h3>
            <div className="space-y-2">
              <Row label="Start Date" value={formatDate(event.start_date)} />
              {event.end_date && event.end_date !== event.start_date && (
                <Row label="End Date" value={formatDate(event.end_date)} />
              )}
              {event.occurrence_id != null && (
                <Row label="Record ID" value={String(event.occurrence_id)} mono />
              )}
            </div>
          </section>

          {/* Value (measurements/observations) */}
          {(numericValue != null || event.value_as_concept || event.value_as_string) && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                Value
              </h3>
              <div className="space-y-2">
                {numericValue != null && (
                  <div className="rounded-lg bg-[#151518] border border-[#232328] p-3">
                    <p className="text-2xl font-bold" style={{ color }}>
                      {numericValue}
                      {event.unit && (
                        <span className="text-sm font-normal text-[#8A857D] ml-1">{event.unit}</span>
                      )}
                    </p>
                    {event.range_low != null && event.range_high != null && (
                      <p className="text-xs text-[#5A5650] mt-1">
                        Reference: {event.range_low} – {event.range_high} {event.unit ?? ""}
                      </p>
                    )}
                    {event.range_low != null && event.range_high != null && (
                      <div className="mt-2">
                        {numericValue < event.range_low && (
                          <span className="text-xs text-[#818CF8]">↓ Below normal range</span>
                        )}
                        {numericValue > event.range_high && (
                          <span className="text-xs text-[#E85A6B]">↑ Above normal range</span>
                        )}
                        {numericValue >= event.range_low && numericValue <= event.range_high && (
                          <span className="text-xs text-[#22C55E]">✓ Within normal range</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {event.value_as_concept && (
                  <Row label="Value (concept)" value={event.value_as_concept} />
                )}
                {event.value_as_string && (
                  <Row label="Value (text)" value={event.value_as_string} />
                )}
              </div>
            </section>
          )}

          {/* Drug details */}
          {event.domain === "drug" && (event.route || event.days_supply != null || event.quantity != null) && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
                Exposure Details
              </h3>
              <div className="space-y-2">
                {event.route && <Row label="Route" value={event.route} />}
                {event.days_supply != null && <Row label="Days Supply" value={`${event.days_supply} days`} />}
                {event.quantity != null && <Row label="Quantity" value={String(event.quantity)} />}
              </div>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[#232328] space-y-2">
          {event.concept_id > 0 && (
            <button
              type="button"
              onClick={() => {
                navigate(`/vocabulary?concept=${event.concept_id}`);
                onClose();
              }}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
                "bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30",
                "hover:bg-[#C9A227]/20 transition-colors",
              )}
            >
              <ExternalLink size={14} />
              View in Vocabulary Browser
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-1.5 text-[11px] text-[#5A5650] shrink-0">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          "text-xs text-[#C5C0B8] text-right break-all",
          mono && "font-mono text-[#2DD4BF]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
