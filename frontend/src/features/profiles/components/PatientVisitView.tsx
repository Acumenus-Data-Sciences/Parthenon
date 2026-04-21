import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Hospital } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate as formatAppDate } from "@/i18n/format";
import { getProfileDomainLabel } from "../lib/i18n";
import type { ClinicalEvent, ClinicalDomain } from "../types/profile";

interface PatientVisitViewProps {
  events: ClinicalEvent[];
}

const DOMAIN_CONFIG: Record<
  ClinicalDomain,
  { color: string }
> = {
  condition: { color: "var(--critical)" },
  drug: { color: "var(--success)" },
  procedure: { color: "var(--accent)" },
  measurement: { color: "var(--info)" },
  observation: { color: "var(--text-muted)" },
  visit: { color: "var(--warning)" },
};

function formatDate(iso: string): string {
  return formatAppDate(iso, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(start: string, end: string): number {
  const d = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, d);
}

interface VisitGroup {
  visit: ClinicalEvent;
  events: ClinicalEvent[];
}

function DomainTag({
  domain,
  count,
}: {
  domain: ClinicalDomain;
  count: number;
}) {
  const { t } = useTranslation("app");
  const cfg = DOMAIN_CONFIG[domain];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
      style={{
        backgroundColor: `${cfg.color}15`,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
      }}
    >
      {getProfileDomainLabel(t, domain, true)} ({count})
    </span>
  );
}

function EventRow({ event }: { event: ClinicalEvent }) {
  const { t } = useTranslation("app");
  const cfg = DOMAIN_CONFIG[event.domain];
  const showValue =
    event.value != null ||
    (event.value_as_concept && event.value_as_concept !== "");

  return (
    <div className="flex items-start gap-3 py-1.5 border-t border-border-subtle">
      <span
        className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: cfg.color, marginTop: 5 }}
      />
      <div className="flex-1 min-w-0">
        {event.concept_id ? (
          <Link
            to={`/vocabulary?concept=${event.concept_id}`}
            className="text-xs text-text-primary hover:text-accent transition-colors"
          >
            {event.concept_name}
          </Link>
        ) : (
          <span className="text-xs text-text-primary">{event.concept_name}</span>
        )}
        {showValue && (
          <span className="ml-2 text-[10px] text-accent">
            {event.value != null ? String(event.value) : ""}
            {event.unit ? ` ${event.unit}` : ""}
            {event.value_as_concept && event.value_as_concept !== ""
              ? ` (${event.value_as_concept})`
              : ""}
          </span>
        )}
        {event.route && (
          <span className="ml-2 text-[10px] text-text-ghost">
            {t("profiles.events.viaRoute", { route: event.route })}
          </span>
        )}
      </div>
      <div className="text-[10px] text-text-ghost shrink-0">
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px]"
          style={{
            backgroundColor: `${cfg.color}10`,
            color: cfg.color,
          }}
        >
          {getProfileDomainLabel(t, event.domain)}
        </span>
      </div>
    </div>
  );
}

function VisitCard({ visitGroup }: { visitGroup: VisitGroup }) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(false);
  const { visit, events } = visitGroup;

  const durationDays = visit.end_date
    ? daysBetween(visit.start_date, visit.end_date)
    : 0;

  // Group events by domain (excluding visit events)
  const byDomain = useMemo(() => {
    const map = new Map<ClinicalDomain, ClinicalEvent[]>();
    for (const e of events) {
      if (!map.has(e.domain)) map.set(e.domain, []);
      map.get(e.domain)!.push(e);
    }
    return map;
  }, [events]);

  const domainOrder: ClinicalDomain[] = [
    "condition",
    "procedure",
    "drug",
    "measurement",
    "observation",
  ];

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-start gap-3 p-4 hover:bg-surface-overlay transition-colors text-left"
      >
        {/* Visit type icon */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--warning) 15%, transparent)" }}
        >
          <Hospital size={15} className="text-warning" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Visit name + dates */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary">
              {visit.concept_name}
            </p>
            <span className="text-xs text-text-muted shrink-0">
              {formatDate(visit.start_date)}
              {visit.end_date && visit.end_date !== visit.start_date
                ? ` – ${formatDate(visit.end_date)}`
                : ""}
              {durationDays > 0 && (
                <span className="ml-1 text-[10px] text-text-ghost">
                  {t("profiles.visits.durationDays", { count: durationDays })}
                </span>
              )}
            </span>
          </div>

          {/* Domain tags */}
          {events.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {domainOrder
                .filter((d) => byDomain.has(d))
                .map((d) => (
                  <DomainTag
                    key={d}
                    domain={d}
                    count={byDomain.get(d)!.length}
                  />
                ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-ghost mt-1">
              {t("profiles.visits.noAssociatedEvents")}
            </p>
          )}
        </div>

        {/* Expand chevron */}
        {events.length > 0 && (
          <span className="text-text-ghost shrink-0 mt-1">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
      </button>

      {/* Expanded event list */}
      {expanded && events.length > 0 && (
        <div className="px-4 pb-3 border-t border-border-default">
          {domainOrder
            .filter((d) => byDomain.has(d))
            .map((d) => {
              const cfg = DOMAIN_CONFIG[d];
              const domEvents = byDomain.get(d)!;
              return (
                <div key={d} className="mt-3">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: cfg.color }}
                  >
                    {getProfileDomainLabel(t, d, true)}
                  </p>
                  {domEvents.map((e, i) => (
                    <EventRow key={i} event={e} />
                  ))}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function PatientVisitView({ events }: PatientVisitViewProps) {
  const { t } = useTranslation("app");
  const [showUnassociated, setShowUnassociated] = useState(false);

  const { visitGroups, unassociated } = useMemo(() => {
    const visits = [...events.filter((e) => e.domain === "visit")].sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );

    const nonVisitEvents = events.filter((e) => e.domain !== "visit");

    // Bin non-visit events to visits by date containment
    const assignedIds = new Set<number>(); // event indices
    const groups: VisitGroup[] = visits.map((visit) => {
      const visitStart = new Date(visit.start_date).getTime();
      const visitEnd = visit.end_date
        ? new Date(visit.end_date).getTime()
        : visitStart;

      const binned: ClinicalEvent[] = [];
      nonVisitEvents.forEach((e, idx) => {
        if (assignedIds.has(idx)) return;
        const eDate = new Date(e.start_date).getTime();
        if (eDate >= visitStart && eDate <= visitEnd) {
          binned.push(e);
          assignedIds.add(idx);
        }
      });

      return { visit, events: binned };
    });

    const unassociated = nonVisitEvents.filter(
      (_, idx) => !assignedIds.has(idx),
    );

    return { visitGroups: groups, unassociated };
  }, [events]);

  if (visitGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <Hospital size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">{t("profiles.visits.noVisitData")}</p>
        <p className="text-xs text-text-ghost mt-1">
          {t("profiles.visits.visitOccurrencesRequired")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Visit count summary */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-text-muted">
          {unassociated.length > 0
            ? t("profiles.visits.summaryWithUnassociated", {
                visits: visitGroups.length,
                events: visitGroups.reduce((s, g) => s + g.events.length, 0),
                unassociated: unassociated.length,
              })
            : t("profiles.visits.summary", {
                visits: visitGroups.length,
                events: visitGroups.reduce((s, g) => s + g.events.length, 0),
              })}
        </span>
      </div>

      {/* Visit cards */}
      {visitGroups.map((group, i) => (
        <VisitCard key={i} visitGroup={group} />
      ))}

      {/* Unassociated events */}
      {unassociated.length > 0 && (
        <div className="rounded-lg border border-dashed border-surface-highlight bg-surface-raised overflow-hidden">
          <button
            type="button"
            onClick={() => setShowUnassociated((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay transition-colors"
          >
            <span className="text-xs text-text-muted">
              {t("profiles.visits.eventsNotAssociated", {
                count: unassociated.length,
              })}
            </span>
            {showUnassociated ? (
              <ChevronDown size={14} className="text-text-ghost" />
            ) : (
              <ChevronRight size={14} className="text-text-ghost" />
            )}
          </button>
          {showUnassociated && (
            <div className="px-4 pb-3 border-t border-border-default">
              {unassociated.map((e, i) => (
                <EventRow key={i} event={e} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
