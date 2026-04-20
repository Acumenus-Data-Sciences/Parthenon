import { useState, useMemo, useRef, useCallback, useEffect, useId } from "react";
import type { ClinicalEvent, ClinicalDomain, ObservationPeriod } from "../types/profile";
import {
  DOMAIN_CONFIG,
  ALL_DOMAINS,
  LANE_HEIGHT,
  EVENT_HEIGHT,
  EVENT_GAP,
  MIN_EVENT_WIDTH,
  TIMELINE_PADDING,
  LABEL_WIDTH,
  parseDate,
  formatTimelineDate,
  packDomainEvents,
  type PackedEvent,
} from "../lib/timeline-utils";
import {
  TimelineToolbar,
  DomainFilterBar,
  DensityMinimap,
  EventTooltip,
  TimelineLegend,
} from "./timeline";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PatientTimelineProps {
  events: ClinicalEvent[];
  observationPeriods?: ObservationPeriod[];
  onEventClick?: (event: ClinicalEvent) => void;
}

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

  // Pre-compute packed layouts per domain — row assignments + actual row count
  const packedLayouts = useMemo(() => {
    const layouts: Record<ClinicalDomain, { packed: PackedEvent[]; rowCount: number }> = {
      condition: { packed: [], rowCount: 0 },
      drug: { packed: [], rowCount: 0 },
      procedure: { packed: [], rowCount: 0 },
      measurement: { packed: [], rowCount: 0 },
      observation: { packed: [], rowCount: 0 },
      visit: { packed: [], rowCount: 0 },
    };
    for (const domain of ALL_DOMAINS) {
      if (domainEvents[domain].length > 0) {
        layouts[domain] = packDomainEvents(domainEvents[domain], timeRange);
      }
    }
    return layouts;
  }, [domainEvents, timeRange]);

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
    // Use actual row count from packing algorithm instead of guessing
    const rows = isCollapsed ? 0 : packedLayouts[domain].rowCount;
    const height = isCollapsed ? LANE_HEIGHT : LANE_HEIGHT + rows * (EVENT_HEIGHT + EVENT_GAP);
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
  const handleReset = () => { setZoom(1); setPanOffset(0); };

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
      <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-surface-highlight bg-[var(--patient-timeline-panel-bg)]">
        <p className="text-sm text-text-muted">No clinical events to display</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-border-default bg-[var(--patient-timeline-panel-bg)] overflow-hidden">
      <TimelineToolbar
        eventCount={events.length}
        activeDomainCount={activeDomains.length}
        observationPeriods={observationPeriods}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
      />

      <DomainFilterBar
        allPresentDomains={allPresentDomains}
        hiddenDomains={hiddenDomains}
        events={events}
        onToggleHide={toggleHide}
      />

      <DensityMinimap
        svgWidth={svgWidth}
        densityBuckets={densityBuckets}
        minimapViewport={minimapViewport}
        onMinimapClick={handleMinimapClick}
      />

      {/* Year quick-nav */}
      {years.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-1.5 bg-[var(--patient-timeline-track-bg)] border-b border-border-subtle overflow-x-auto">
          <span className="text-[10px] text-text-ghost shrink-0 mr-1">Jump:</span>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => jumpToYear(y)}
              className="text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-elevated px-1.5 py-0.5 rounded transition-colors shrink-0"
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* SVG Timeline */}
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing bg-[var(--patient-timeline-track-bg)]"
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
                stroke="var(--surface-elevated)"
                strokeWidth={1.5}
              />
            </pattern>
          </defs>

          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="var(--patient-timeline-track-bg)" />

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
                  fill="var(--success)"
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
              stroke="var(--surface-highlight)"
              strokeWidth={1}
            />
            {ticks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={22}
                  y2={30}
                  stroke="var(--text-ghost)"
                  strokeWidth={1}
                />
                <text
                  x={tick.x}
                  y={18}
                  textAnchor="middle"
                  className="fill-text-ghost"
                  style={{ fontSize: 9 }}
                >
                  {tick.label}
                </text>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={30}
                  y2={svgHeight}
                  stroke="var(--surface-overlay)"
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
                  stroke="var(--accent)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                <text
                  x={todayX + 3}
                  y={18}
                  className="fill-accent"
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
                  fill={config.color}
                  opacity="var(--patient-timeline-lane-opacity)"
                />
                <line
                  x1={0}
                  x2={svgWidth}
                  y1={y}
                  y2={y}
                  stroke="var(--surface-overlay)"
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
                    className="fill-text-muted"
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
                    className="fill-text-ghost"
                    style={{ fontSize: 10, fontWeight: 500 }}
                  >
                    {config.label}
                  </text>
                  <text
                    x={LABEL_WIDTH - 6}
                    y={y + LANE_HEIGHT / 2 + 3}
                    textAnchor="end"
                    className="fill-text-muted"
                    style={{ fontSize: 9 }}
                  >
                    {domEvts.length}
                  </text>
                </g>

                {/* Events — rendered from packed layout (non-overlapping rows) */}
                {!isCollapsed && (
                  <g clipPath={`url(#${clipId})`}>
                    {packedLayouts[domain].packed.map((pe, peIdx) => {
                      const ev = pe.event;
                      const startX = timeToX(pe.startMs);
                      const endX = ev.end_date
                        ? timeToX(pe.endMs)
                        : startX + MIN_EVENT_WIDTH;
                      const w = Math.max(endX - startX, MIN_EVENT_WIDTH);
                      const evY = y + LANE_HEIGHT + pe.row * (EVENT_HEIGHT + EVENT_GAP);

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

                      // Hit target: use full row height for easier hovering
                      const hitH = EVENT_HEIGHT + EVENT_GAP;

                      return (
                        <g
                          key={peIdx}
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
                          {/* Invisible hit target — full row height, wider than visible shape */}
                          <rect
                            x={startX - 4}
                            y={evY - 1}
                            width={Math.max(w + 8, 16)}
                            height={hitH}
                            fill="transparent"
                          />
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
                  stroke="var(--success)"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.3}
                />
                <line
                  x1={band.x2}
                  x2={band.x2}
                  y1={28}
                  y2={svgHeight}
                  stroke="var(--success)"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.3}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && !isDragging.current && (
        <EventTooltip
          event={tooltip.event}
          x={tooltip.x}
          y={tooltip.y}
          containerWidth={containerRef.current?.clientWidth ?? svgWidth}
        />
      )}

      <TimelineLegend
        activeDomains={activeDomains}
        domainEvents={domainEvents}
        observationPeriods={observationPeriods}
      />
    </div>
  );
}
