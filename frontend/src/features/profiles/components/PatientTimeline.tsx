import { useState, useMemo, useRef, useCallback, useEffect, useId } from "react";
import { Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicalEvent, ClinicalDomain, ObservationPeriod } from "../types/profile";

// ---------------------------------------------------------------------------
// Domain configuration
// ---------------------------------------------------------------------------

const DOMAIN_CONFIG: Record<
  ClinicalDomain,
  { label: string; color: string; order: number }
> = {
  condition: { label: "Conditions", color: "#E85A6B", order: 0 },
  drug: { label: "Drugs", color: "#2DD4BF", order: 1 },
  procedure: { label: "Procedures", color: "#C9A227", order: 2 },
  measurement: { label: "Measurements", color: "#818CF8", order: 3 },
  observation: { label: "Observations", color: "#94A3B8", order: 4 },
  visit: { label: "Visits", color: "#F59E0B", order: 5 },
};

const ALL_DOMAINS: ClinicalDomain[] = [
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(d: string): number {
  return new Date(d).getTime();
}

function formatTimelineDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatTooltipDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Human-readable duration between two ISO date strings */
function formatDuration(startDate: string, endDate: string): string {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return "";
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return "same day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 12) return months === 1 ? "1 month" : `${months} months`;
  const years = Math.round(days / 365.25);
  return years === 1 ? "1 year" : `${years} years`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PatientTimelineProps {
  events: ClinicalEvent[];
  observationPeriods?: ObservationPeriod[];
  onEventClick?: (event: ClinicalEvent) => void;
}

const LANE_HEIGHT = 28;
const EVENT_HEIGHT = 6;
const MIN_EVENT_WIDTH = 4;
const TIMELINE_PADDING = 60;
const LABEL_WIDTH = 148;

export function PatientTimeline({ events, observationPeriods = [], onEventClick }: PatientTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsedDomains, setCollapsedDomains] = useState<Set<ClinicalDomain>>(new Set());
  const [hiddenDomains, setHiddenDomains] = useState<Set<ClinicalDomain>>(new Set());
  const [tooltip, setTooltip] = useState<{
    event: ClinicalEvent;
    x: number;
    y: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Unique IDs for SVG defs to avoid conflicts with multiple instances
  const instanceId = useId();
  const clipId = `chart-clip-${instanceId}`;
  const hatchId = `gap-hatch-${instanceId}`;

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const panStart = useRef(0);
  const hasSetInitialView = useRef(false);

  // Responsive SVG width via ResizeObserver
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Use measured width if available, otherwise fallback
  const svgWidth = containerWidth > 0 ? Math.round(containerWidth) : 900;
  const chartWidth = svgWidth - LABEL_WIDTH - TIMELINE_PADDING;

  // Keyboard navigation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el && !el.contains(e.target as Node)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPanOffset((p) => p + 80);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPanOffset((p) => p - 80);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(10, z * 1.2));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.5, z / 1.2));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Smart initial zoom: show last 5 years for long histories
  useEffect(() => {
    if (hasSetInitialView.current || events.length === 0) return;
    hasSetInitialView.current = true;
    const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;
    const totalMs = timeMax - timeMin;
    if (totalMs <= FIVE_YEARS_MS) return;
    const z = Math.min(totalMs / FIVE_YEARS_MS, 10);
    // pan so that timeMax is at the right edge of the chart
    const pan = chartWidth * (1 - z);
    setZoom(z);
    setPanOffset(pan);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Group events by domain (respecting hidden)
  const domainEvents = useMemo(() => {
    const grouped: Record<ClinicalDomain, ClinicalEvent[]> = {
      condition: [],
      drug: [],
      procedure: [],
      measurement: [],
      observation: [],
      visit: [],
    };
    for (const ev of events) {
      if (grouped[ev.domain] && !hiddenDomains.has(ev.domain)) {
        grouped[ev.domain].push(ev);
      }
    }
    return grouped;
  }, [events, hiddenDomains]);

  // Compute time bounds from ALL events (including hidden — so axis stays stable)
  const { timeMin, timeMax } = useMemo(() => {
    if (events.length === 0) {
      const now = Date.now();
      return { timeMin: now - 365 * 24 * 60 * 60 * 1000, timeMax: now };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const ev of events) {
      const start = parseDate(ev.start_date);
      if (start < min) min = start;
      if (start > max) max = start;
      if (ev.end_date) {
        const end = parseDate(ev.end_date);
        if (end > max) max = end;
      }
    }
    // Add obs period bounds too
    for (const op of observationPeriods) {
      const s = parseDate(op.start_date);
      const e = parseDate(op.end_date);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    const range = max - min || 365 * 24 * 60 * 60 * 1000;
    return { timeMin: min - range * 0.03, timeMax: max + range * 0.03 };
  }, [events, observationPeriods]);

  const timeRange = timeMax - timeMin;

  // Active (non-hidden, non-empty) domains
  const activeDomains = useMemo(
    () =>
      ALL_DOMAINS
        .filter((d) => domainEvents[d].length > 0)
        .sort((a, b) => DOMAIN_CONFIG[a].order - DOMAIN_CONFIG[b].order),
    [domainEvents],
  );

  // All domains that have any events (even if hidden) for toggle buttons
  const allPresentDomains = useMemo(
    () =>
      ALL_DOMAINS.filter(
        (d) => events.filter((e) => e.domain === d).length > 0,
      ),
    [events],
  );

  const toggleCollapse = (domain: ClinicalDomain) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const toggleHide = (domain: ClinicalDomain) => {
    setHiddenDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  let yOffset = 34; // Space for time axis
  const lanePositions: { domain: ClinicalDomain; y: number; height: number }[] = [];
  for (const domain of activeDomains) {
    const isCollapsed = collapsedDomains.has(domain);
    const eventCount = domainEvents[domain].length;
    const rows = isCollapsed ? 0 : Math.min(Math.ceil(eventCount / 4), 10);
    const height = isCollapsed ? LANE_HEIGHT : LANE_HEIGHT + rows * (EVENT_HEIGHT + 2);
    lanePositions.push({ domain, y: yOffset, height });
    yOffset += height + 2;
  }

  const svgHeight = Math.max(yOffset + 10, 120);

  // Convert time to x position with zoom and pan
  const timeToX = useCallback(
    (t: number) => {
      const normalized = (t - timeMin) / timeRange;
      return LABEL_WIDTH + (normalized * chartWidth * zoom + panOffset);
    },
    [timeMin, timeRange, chartWidth, zoom, panOffset],
  );

  // Generate time axis ticks
  const ticks = useMemo(() => {
    const count = Math.max(4, Math.floor(chartWidth / 110));
    const result: { x: number; label: string }[] = [];
    for (let i = 0; i <= count; i++) {
      const t = timeMin + (timeRange * i) / count;
      const x = timeToX(t);
      if (x >= LABEL_WIDTH && x <= svgWidth - 10) {
        result.push({ x, label: formatTimelineDate(t) });
      }
    }
    return result;
  }, [timeMin, timeRange, timeToX, chartWidth, svgWidth]);

  // Year quick-nav
  const years = useMemo(() => {
    const startYear = new Date(timeMin).getFullYear();
    const endYear = new Date(timeMax).getFullYear();
    const result: number[] = [];
    for (let y = startYear; y <= endYear; y++) result.push(y);
    return result;
  }, [timeMin, timeMax]);

  // Event density strip — monthly buckets across the full time range
  const densityBuckets = useMemo(() => {
    const spanMs = timeMax - timeMin;
    // Choose bucket size: monthly for spans < 10yr, quarterly for longer
    const bucketMs = spanMs > 10 * 365.25 * 24 * 60 * 60 * 1000
      ? 90 * 24 * 60 * 60 * 1000   // ~quarterly
      : 30 * 24 * 60 * 60 * 1000;  // ~monthly
    const bucketCount = Math.ceil(spanMs / bucketMs);
    const counts = new Array<number>(bucketCount).fill(0);
    for (const ev of events) {
      const t = parseDate(ev.start_date);
      const idx = Math.min(Math.floor((t - timeMin) / bucketMs), bucketCount - 1);
      if (idx >= 0) counts[idx]++;
    }
    const maxCount = Math.max(...counts, 1);
    return counts.map((count, i) => ({
      x1: LABEL_WIDTH + ((i * bucketMs) / spanMs) * chartWidth,
      x2: LABEL_WIDTH + (((i + 1) * bucketMs) / spanMs) * chartWidth,
      intensity: count / maxCount,
      count,
    }));
  }, [events, timeMin, timeMax, chartWidth]);

  // Minimap viewport: which portion of the full history is currently visible
  const minimapViewport = useMemo(() => {
    const leftNorm = Math.max(0, Math.min(1, -panOffset / (chartWidth * zoom)));
    const rightNorm = Math.max(0, Math.min(1, (chartWidth - panOffset) / (chartWidth * zoom)));
    return {
      x1: LABEL_WIDTH + leftNorm * chartWidth,
      x2: LABEL_WIDTH + rightNorm * chartWidth,
    };
  }, [zoom, panOffset, chartWidth]);

  // Click on minimap to center that time position in the main view
  const handleMinimapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (svgWidth / rect.width);
    const norm = (clickX - LABEL_WIDTH) / chartWidth;
    if (norm < 0 || norm > 1) return;
    const targetPanX = norm * chartWidth * zoom;
    setPanOffset(chartWidth / 2 - targetPanX);
  }, [zoom, svgWidth, chartWidth]);

  const jumpToYear = (year: number) => {
    const yearMs = new Date(`${year}-01-01`).getTime();
    const normalized = (yearMs - timeMin) / timeRange;
    const targetX = normalized * chartWidth * zoom;
    // Center year in view: pan so targetX is at mid-chart
    const midChart = chartWidth / 2;
    setPanOffset(midChart - targetX);
  };

  // Observation period x-spans
  const obsPeriodBands = useMemo(() => {
    return observationPeriods.map((op) => ({
      x1: timeToX(parseDate(op.start_date)),
      x2: timeToX(parseDate(op.end_date)),
      label: op.period_type ?? "",
    }));
  }, [observationPeriods, timeToX]);

  // Today marker
  const todayX = useMemo(() => {
    const now = Date.now();
    if (now < timeMin || now > timeMax) return null;
    return timeToX(now);
  }, [timeMin, timeMax, timeToX]);

  // Search: which events match?
  const matchingEventKey = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const set = new Set<ClinicalEvent>();
    for (const ev of events) {
      if (ev.concept_name.toLowerCase().includes(q)) set.add(ev);
    }
    return set;
  }, [events, searchQuery]);

  // Wheel zoom — only when Ctrl/Cmd is held; otherwise let the page scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return; // let normal scroll bubble up
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(10, zoom * delta));
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const cursorX = e.clientX - rect.left - LABEL_WIDTH;
      const newPan = panOffset - cursorX * (newZoom / zoom - 1);
      setPanOffset(newPan);
    }
    setZoom(newZoom);
  };

  // Toolbar zoom in/out buttons
  const handleZoomIn = () => setZoom((z) => Math.min(10, z * 1.3));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z / 1.3));

  // Drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = e.clientX;
    panStart.current = panOffset;
    // Hide tooltip while dragging
    setTooltip(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPanOffset(panStart.current + (e.clientX - dragStart.current));
  };

  const handleMouseUp = () => { isDragging.current = false; };

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No clinical events to display</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#1C1C20] border-b border-[#232328] flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8A857D]">
            {events.length} events · {activeDomains.length} domains
          </span>
          {observationPeriods.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/20">
              {observationPeriods.length} obs. period{observationPeriods.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search
              size={11}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Highlight events..."
              className={cn(
                "w-44 rounded-md border border-[#323238] bg-[#0E0E11] pl-7 pr-2 py-1 text-xs",
                "text-[#F0EDE8] placeholder:text-[#5A5650]",
                "focus:border-[#C9A227] focus:outline-none",
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#F0EDE8]"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Zoom controls: -, percentage, +, Reset */}
          <div className="flex items-center gap-0.5 rounded-md border border-[#323238] bg-[#0E0E11]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1.5 text-[#8A857D] hover:text-[#F0EDE8] disabled:text-[#323238] disabled:cursor-not-allowed transition-colors"
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] text-[#5A5650] w-8 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 10}
              className="p-1.5 text-[#8A857D] hover:text-[#F0EDE8] disabled:text-[#323238] disabled:cursor-not-allowed transition-colors"
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setZoom(1); setPanOffset(0); }}
            className="text-[10px] text-[#8A857D] hover:text-[#F0EDE8] transition-colors px-2 py-1 rounded border border-[#323238]"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Domain filter toggles */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-[#151518] border-b border-[#232328] overflow-x-auto">
        <span className="text-[10px] text-[#5A5650] shrink-0 mr-1">Domains:</span>
        {allPresentDomains.map((domain) => {
          const cfg = DOMAIN_CONFIG[domain];
          const hidden = hiddenDomains.has(domain);
          const count = events.filter((e) => e.domain === domain).length;
          return (
            <button
              key={domain}
              type="button"
              onClick={() => toggleHide(domain)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-all shrink-0",
                hidden
                  ? "border-[#323238] text-[#5A5650] bg-transparent"
                  : "border-opacity-30 text-opacity-90",
              )}
              style={
                hidden
                  ? {}
                  : {
                      backgroundColor: `${cfg.color}15`,
                      color: cfg.color,
                      borderColor: `${cfg.color}40`,
                    }
              }
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Event density / minimap strip — click to jump */}
      <div className="relative bg-[#0E0E11] border-b border-[#1C1C20]" style={{ height: 32 }}>
        <svg
          width="100%"
          height={32}
          viewBox={`0 0 ${svgWidth} 32`}
          preserveAspectRatio="none"
          className="cursor-pointer"
          onClick={handleMinimapClick}
        >
          {densityBuckets.map((bucket, i) => (
            <rect
              key={i}
              x={bucket.x1}
              y={0}
              width={Math.max(bucket.x2 - bucket.x1 - 0.5, 0.5)}
              height={32}
              fill="#2DD4BF"
              opacity={0.08 + bucket.intensity * 0.55}
            />
          ))}
          {/* Viewport indicator */}
          <rect
            x={minimapViewport.x1}
            y={1}
            width={Math.max(minimapViewport.x2 - minimapViewport.x1, 4)}
            height={30}
            fill="white"
            opacity={0.05}
            rx={1}
          />
          <rect
            x={minimapViewport.x1}
            y={1}
            width={Math.max(minimapViewport.x2 - minimapViewport.x1, 4)}
            height={30}
            fill="none"
            stroke="white"
            strokeWidth={0.8}
            opacity={0.25}
            rx={1}
          />
          {/* Axis line */}
          <line x1={LABEL_WIDTH} x2={svgWidth} y1={31} y2={31} stroke="#1C1C20" strokeWidth={1} />
          {/* Label */}
          <text x={4} y={19} className="fill-[#3A3A40]" style={{ fontSize: 8 }}>
            activity
          </text>
        </svg>
      </div>

      {/* Year quick-nav */}
      {years.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-1.5 bg-[#0E0E11] border-b border-[#1C1C20] overflow-x-auto">
          <span className="text-[10px] text-[#5A5650] shrink-0 mr-1">Jump:</span>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => jumpToYear(y)}
              className="text-[10px] text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] px-1.5 py-0.5 rounded transition-colors shrink-0"
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* SVG Timeline */}
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing"
        tabIndex={0}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="select-none"
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={LABEL_WIDTH}
                y={0}
                width={chartWidth + TIMELINE_PADDING}
                height={svgHeight}
              />
            </clipPath>
            {/* Hatch pattern for gaps between obs periods */}
            <pattern
              id={hatchId}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="#232328"
                strokeWidth={1.5}
              />
            </pattern>
          </defs>

          {/* Observation period bands (behind everything) */}
          <g clipPath={`url(#${clipId})`}>
            {obsPeriodBands.map((band, i) => {
              const bw = Math.max(band.x2 - band.x1, 2);
              return (
                <rect
                  key={i}
                  x={band.x1}
                  y={28}
                  width={bw}
                  height={svgHeight - 28}
                  fill="#2DD4BF"
                  opacity={0.05}
                />
              );
            })}
          </g>

          {/* Time axis */}
          <g clipPath={`url(#${clipId})`}>
            <line
              x1={LABEL_WIDTH}
              x2={svgWidth}
              y1={26}
              y2={26}
              stroke="#323238"
              strokeWidth={1}
            />
            {ticks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={22}
                  y2={30}
                  stroke="#5A5650"
                  strokeWidth={1}
                />
                <text
                  x={tick.x}
                  y={18}
                  textAnchor="middle"
                  className="fill-[#8A857D]"
                  style={{ fontSize: 9 }}
                >
                  {tick.label}
                </text>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={30}
                  y2={svgHeight}
                  stroke="#1C1C20"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
              </g>
            ))}

            {/* Today marker */}
            {todayX != null && (
              <g>
                <line
                  x1={todayX}
                  x2={todayX}
                  y1={26}
                  y2={svgHeight}
                  stroke="#C9A227"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                <text
                  x={todayX + 3}
                  y={18}
                  className="fill-[#C9A227]"
                  style={{ fontSize: 8 }}
                >
                  Today
                </text>
              </g>
            )}
          </g>

          {/* Swim lanes */}
          {lanePositions.map(({ domain, y, height }) => {
            const config = DOMAIN_CONFIG[domain];
            const isCollapsed = collapsedDomains.has(domain);
            const domEvts = domainEvents[domain];

            return (
              <g key={domain}>
                {/* Lane background */}
                <rect
                  x={0}
                  y={y}
                  width={svgWidth}
                  height={height}
                  fill={`${config.color}04`}
                />
                <line
                  x1={0}
                  x2={svgWidth}
                  y1={y}
                  y2={y}
                  stroke="#1C1C20"
                  strokeWidth={1}
                />

                {/* Domain label (clickable to collapse) */}
                <g
                  className="cursor-pointer"
                  onClick={() => toggleCollapse(domain)}
                >
                  <rect
                    x={0}
                    y={y}
                    width={LABEL_WIDTH}
                    height={LANE_HEIGHT}
                    fill="transparent"
                  />
                  <text
                    x={10}
                    y={y + LANE_HEIGHT / 2 + 4}
                    className="fill-[#5A5650]"
                    style={{ fontSize: 8 }}
                  >
                    {isCollapsed ? "\u25B6" : "\u25BC"}
                  </text>
                  <rect
                    x={22}
                    y={y + LANE_HEIGHT / 2 - 4}
                    width={8}
                    height={8}
                    rx={2}
                    fill={config.color}
                  />
                  <text
                    x={36}
                    y={y + LANE_HEIGHT / 2 + 3}
                    className="fill-[#C5C0B8]"
                    style={{ fontSize: 10, fontWeight: 500 }}
                  >
                    {config.label}
                  </text>
                  <text
                    x={LABEL_WIDTH - 6}
                    y={y + LANE_HEIGHT / 2 + 3}
                    textAnchor="end"
                    className="fill-[#5A5650]"
                    style={{ fontSize: 9 }}
                  >
                    {domEvts.length}
                  </text>
                </g>

                {/* Events */}
                {!isCollapsed && (
                  <g clipPath={`url(#${clipId})`}>
                    {domEvts.map((ev, evIdx) => {
                      const startX = timeToX(parseDate(ev.start_date));
                      const endX = ev.end_date
                        ? timeToX(parseDate(ev.end_date))
                        : startX + MIN_EVENT_WIDTH;
                      const w = Math.max(endX - startX, MIN_EVENT_WIDTH);
                      const row = evIdx % 10;
                      const evY = y + LANE_HEIGHT + row * (EVENT_HEIGHT + 2);

                      const isSingleDay = !ev.end_date || w <= MIN_EVENT_WIDTH + 2;
                      const isMatch =
                        matchingEventKey != null
                          ? matchingEventKey.has(ev)
                          : true;
                      const opacity = matchingEventKey != null
                        ? isMatch
                          ? 1.0
                          : 0.15
                        : 0.75;

                      // Hit target padding — expands the hoverable area
                      const HIT_PAD = 6;

                      return (
                        <g
                          key={evIdx}
                          onMouseEnter={(e) => {
                            if (isDragging.current) return;
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltip({
                                event: ev,
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                              });
                            }
                          }}
                          onMouseMove={(e) => {
                            if (isDragging.current) return;
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltip({
                                event: ev,
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                              });
                            }
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          onClick={() => onEventClick?.(ev)}
                          className="cursor-pointer"
                          opacity={opacity}
                        >
                          {/* Invisible expanded hit target for easier hovering */}
                          {isSingleDay ? (
                            <circle
                              cx={startX}
                              cy={evY + EVENT_HEIGHT / 2}
                              r={EVENT_HEIGHT / 2 + HIT_PAD}
                              fill="transparent"
                            />
                          ) : (
                            <rect
                              x={startX - HIT_PAD}
                              y={evY - HIT_PAD}
                              width={w + HIT_PAD * 2}
                              height={EVENT_HEIGHT + HIT_PAD * 2}
                              fill="transparent"
                            />
                          )}
                          {/* Visible event shape */}
                          {isSingleDay ? (
                            <circle
                              cx={startX}
                              cy={evY + EVENT_HEIGHT / 2}
                              r={EVENT_HEIGHT / 2}
                              fill={config.color}
                            />
                          ) : (
                            <rect
                              x={startX}
                              y={evY}
                              width={w}
                              height={EVENT_HEIGHT}
                              rx={2}
                              fill={config.color}
                            />
                          )}
                          {/* Search highlight ring */}
                          {isMatch && matchingEventKey != null && (
                            isSingleDay ? (
                              <circle
                                cx={startX}
                                cy={evY + EVENT_HEIGHT / 2}
                                r={EVENT_HEIGHT / 2 + 2}
                                fill="none"
                                stroke={config.color}
                                strokeWidth={1}
                                opacity={0.6}
                              />
                            ) : (
                              <rect
                                x={startX - 1}
                                y={evY - 1}
                                width={w + 2}
                                height={EVENT_HEIGHT + 2}
                                rx={3}
                                fill="none"
                                stroke={config.color}
                                strokeWidth={1}
                                opacity={0.6}
                              />
                            )
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })}

          {/* Obs period border lines (on top) */}
          <g clipPath={`url(#${clipId})`}>
            {obsPeriodBands.map((band, i) => (
              <g key={i}>
                <line
                  x1={band.x1}
                  x2={band.x1}
                  y1={28}
                  y2={svgHeight}
                  stroke="#2DD4BF"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.3}
                />
                <line
                  x1={band.x2}
                  x2={band.x2}
                  y1={28}
                  y2={svgHeight}
                  stroke="#2DD4BF"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.3}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Tooltip — clamped to stay within the container */}
      {tooltip && !isDragging.current && (() => {
        const ev = tooltip.event;
        const TOOLTIP_W = 260;
        const TOOLTIP_OFFSET = 14;
        const containerW = containerRef.current?.clientWidth ?? svgWidth;
        const leftPos = tooltip.x + TOOLTIP_OFFSET + TOOLTIP_W > containerW
          ? tooltip.x - TOOLTIP_W - TOOLTIP_OFFSET
          : tooltip.x + TOOLTIP_OFFSET;
        const duration = ev.end_date && ev.end_date !== ev.start_date
          ? formatDuration(ev.start_date, ev.end_date)
          : null;
        return (
          <div
            className="absolute pointer-events-none z-50"
            style={{ left: Math.max(4, leftPos), top: tooltip.y - 10 }}
          >
            <div className="rounded-lg bg-[#0E0E11] border border-[#323238] px-3 py-2 shadow-xl" style={{ maxWidth: TOOLTIP_W }}>
              <p className="text-xs font-semibold text-[#F0EDE8]">
                {ev.concept_name}
              </p>
              <div className="mt-1 space-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] text-[#8A857D]">
                    <span
                      className="inline-block w-2 h-2 rounded-sm mr-1"
                      style={{ backgroundColor: DOMAIN_CONFIG[ev.domain].color }}
                    />
                    {DOMAIN_CONFIG[ev.domain].label}
                  </p>
                  {ev.concept_id != null && (
                    <p className="text-[10px] text-[#3A3A40] font-mono tabular-nums">
                      #{ev.concept_id}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-[#8A857D]">
                  {formatTooltipDate(ev.start_date)}
                  {ev.end_date && ev.end_date !== ev.start_date &&
                    ` \u2013 ${formatTooltipDate(ev.end_date)}`}
                  {duration && (
                    <span className="ml-1 text-[#5A5650]">({duration})</span>
                  )}
                </p>
                {ev.value != null && (
                  <p className="text-[10px] text-[#C9A227]">
                    {String(ev.value)}
                    {ev.unit ? ` ${ev.unit}` : ""}
                  </p>
                )}
                {ev.vocabulary && (
                  <p className="text-[10px] text-[#5A5650]">
                    {ev.vocabulary}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Legend + keyboard hint */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-[#232328] bg-[#1C1C20]">
        <div className="flex flex-wrap gap-3">
          {activeDomains.map((domain) => {
            const config = DOMAIN_CONFIG[domain];
            return (
              <div key={domain} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-[10px] text-[#8A857D]">
                  {config.label} ({domainEvents[domain].length})
                </span>
              </div>
            );
          })}
          {observationPeriods.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#2DD4BF] opacity-30" />
              <span className="text-[10px] text-[#8A857D]">Obs. period</span>
            </div>
          )}
        </div>
        <span className="text-[10px] text-[#3A3A40]">
          Ctrl+scroll to zoom · Drag to pan · Arrow keys · +/- keys · Click event for details
        </span>
      </div>
    </div>
  );
}
