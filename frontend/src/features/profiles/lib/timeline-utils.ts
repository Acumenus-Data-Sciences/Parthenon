import i18next from "i18next";
import { formatDate as formatAppDate } from "@/i18n/format";
import type { ClinicalDomain, ClinicalEvent } from "../types/profile";

// ---------------------------------------------------------------------------
// Domain configuration
// ---------------------------------------------------------------------------

export const DOMAIN_CONFIG: Record<
  ClinicalDomain,
  { copyKey: string; color: string; order: number }
> = {
  condition: { copyKey: "condition", color: "var(--critical)", order: 0 },
  drug: { copyKey: "drug", color: "var(--success)", order: 1 },
  procedure: { copyKey: "procedure", color: "var(--accent)", order: 2 },
  measurement: { copyKey: "measurement", color: "var(--info)", order: 3 },
  observation: { copyKey: "observation", color: "var(--text-muted)", order: 4 },
  visit: { copyKey: "visit", color: "var(--warning)", order: 5 },
};

export const ALL_DOMAINS: ClinicalDomain[] = [
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const LANE_HEIGHT = 28;
export const EVENT_HEIGHT = 8;
export const EVENT_GAP = 3;
export const MIN_EVENT_WIDTH = 4;
export const MAX_ROWS = 12;
export const TIMELINE_PADDING = 60;
export const LABEL_WIDTH = 148;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseDate(d: string): number {
  return new Date(d).getTime();
}

export function formatTimelineDate(ms: number): string {
  return formatAppDate(ms, {
    month: "short",
    year: "numeric",
  });
}

export function formatTooltipDate(d: string): string {
  return formatAppDate(d, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getTimelineDomainLabel(domain: ClinicalDomain): string {
  return i18next.t(`app:profiles.common.domains.${DOMAIN_CONFIG[domain].copyKey}`);
}

/** Human-readable duration between two ISO date strings */
export function formatDuration(startDate: string, endDate: string): string {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return "";
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return i18next.t("app:profiles.timeline.duration.sameDay");
  if (days === 1) return i18next.t("app:profiles.timeline.duration.oneDay");
  if (days < 30) {
    return i18next.t("app:profiles.timeline.duration.days", { count: days });
  }
  const months = Math.round(days / 30.44);
  if (months < 12) {
    return months === 1
      ? i18next.t("app:profiles.timeline.duration.oneMonth")
      : i18next.t("app:profiles.timeline.duration.months", { count: months });
  }
  const years = Math.round(days / 365.25);
  return years === 1
    ? i18next.t("app:profiles.timeline.duration.oneYear")
    : i18next.t("app:profiles.timeline.duration.years", { count: years });
}

// ---------------------------------------------------------------------------
// Lane packing — greedy interval scheduling to avoid overlap
// ---------------------------------------------------------------------------

export interface PackedEvent {
  event: ClinicalEvent;
  row: number;
  startMs: number;
  endMs: number;
}

/**
 * Pack events into non-overlapping rows using greedy interval scheduling.
 * Events are sorted by start time, then assigned to the first row where they
 * don't overlap with any existing event. A minimum time gap prevents point
 * events from stacking on top of each other visually.
 */
export function packDomainEvents(
  events: ClinicalEvent[],
  timeRange: number,
): { packed: PackedEvent[]; rowCount: number } {
  if (events.length === 0) return { packed: [], rowCount: 0 };

  // Minimum gap in ms — ensures point events don't overlap visually.
  // ~0.8% of total time range ~ MIN_EVENT_WIDTH at 1x zoom on a typical screen.
  const minGapMs = timeRange * 0.008;

  const items = events.map((ev) => ({
    event: ev,
    startMs: parseDate(ev.start_date),
    endMs: ev.end_date ? parseDate(ev.end_date) : parseDate(ev.start_date),
  }));
  // Sort by start time, ties broken by shorter events first (point events before spans)
  items.sort((a, b) => a.startMs - b.startMs || (a.endMs - a.startMs) - (b.endMs - b.startMs));

  // rowEnds[r] = the effective end time of the last event placed in row r
  const rowEnds: number[] = [];
  const packed: PackedEvent[] = [];

  for (const item of items) {
    const effectiveEnd = Math.max(item.endMs, item.startMs + minGapMs);
    let assignedRow = -1;

    // Find first row where this event doesn't overlap
    for (let r = 0; r < rowEnds.length; r++) {
      if (rowEnds[r] <= item.startMs) {
        assignedRow = r;
        break;
      }
    }

    // No existing row fits — create a new one if under MAX_ROWS
    if (assignedRow === -1) {
      if (rowEnds.length < MAX_ROWS) {
        assignedRow = rowEnds.length;
        rowEnds.push(0);
      } else {
        // Overflow: assign to row with the earliest end time (least-recently-used)
        assignedRow = 0;
        let minEnd = rowEnds[0];
        for (let r = 1; r < MAX_ROWS; r++) {
          if (rowEnds[r] < minEnd) {
            minEnd = rowEnds[r];
            assignedRow = r;
          }
        }
      }
    }

    rowEnds[assignedRow] = effectiveEnd;
    packed.push({ ...item, row: assignedRow });
  }

  return { packed, rowCount: rowEnds.length };
}
