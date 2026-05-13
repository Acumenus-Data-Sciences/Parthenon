import { useRef } from "react";
import { cn } from "@/lib/utils";

// 8 vertical stations with state-colored dots, progress arcs, scanlines, and
// the gold-rivet lock station (07). See
// docs/lineage/design/specs/2026-05-12-studies-design-workbench-redesign.md
// — Phase 1 ships the rail as presentational; Phase 2+ wires real
// `compilerGuidance` state in.

export type PipelineStageState =
  | "accepted"
  | "validated"
  | "review"
  | "gated"
  | "partial"
  | "not-started";

export interface PipelineStage {
  id: string;
  /** Zero-padded ordinal: "01" .. "08" */
  number: string;
  name: string;
  state: PipelineStageState;
  /** Inline detail under the name, e.g. "protocol parsed, 12 fields". */
  detail: string;
  /** Relative timestamp shown as muted mono text, e.g. "4h ago". */
  lastTouched?: string;
  /** 0..1 fraction filling the right-side progress arc. */
  progressArc?: number;
  /** Station 07 — gold-rivet ring treatment. */
  isLock?: boolean;
}

interface PipelineRailProps {
  stages: ReadonlyArray<PipelineStage>;
  activeStageId?: string;
  onSelectStage?: (id: string) => void;
}

// Map state → dot color modifier + ARIA label.
const STATE_META: Record<PipelineStageState, { dot: "teal" | "gold" | "slate"; label: string }> = {
  accepted: { dot: "gold", label: "accepted" },
  validated: { dot: "teal", label: "validated" },
  review: { dot: "gold", label: "in review" },
  partial: { dot: "gold", label: "partial" },
  gated: { dot: "slate", label: "gated" },
  "not-started": { dot: "slate", label: "not started" },
};

// Stroke color for the progress-arc ring.
const ARC_COLOR: Record<PipelineStageState, string> = {
  accepted: "#C9A227",
  validated: "#2DD4BF",
  review: "#C9A227",
  partial: "#C9A227",
  gated: "#3A3E48",
  "not-started": "#3A3E48",
};

const ARC_CIRCUMFERENCE = 2 * Math.PI * 5.5; // ≈ 34.56

function StationArc({
  state,
  progress,
}: {
  state: PipelineStageState;
  progress?: number;
}) {
  const isGated = state === "gated" || state === "not-started";
  const fraction = Math.max(0, Math.min(1, progress ?? (isGated ? 0 : 1)));
  const dash = `${ARC_CIRCUMFERENCE * fraction} ${ARC_CIRCUMFERENCE}`;

  return (
    <svg className="station-arc" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="#3A3E48" strokeWidth="1" />
      {fraction > 0 ? (
        <circle
          cx="7"
          cy="7"
          r="5.5"
          fill="none"
          stroke={ARC_COLOR[state]}
          strokeWidth="1.25"
          strokeDasharray={dash}
          transform="rotate(-90 7 7)"
        />
      ) : null}
    </svg>
  );
}

export function PipelineRail({ stages, activeStageId, onSelectStage }: PipelineRailProps) {
  // Refs to each station button for keyboard navigation.
  const stationRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = (index + 1) % stages.length;
      stationRefs.current[next]?.focus();
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = (index - 1 + stages.length) % stages.length;
      stationRefs.current[prev]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectStage?.(stages[index].id);
    }
  };

  return (
    <aside className="pane studies-v2-rail" aria-label="Pipeline Rail">
      <div className="rail-title">Pipeline</div>
      <div className="rail-spine" aria-hidden="true" />
      {stages.map((stage, index) => {
        const meta = STATE_META[stage.state];
        const isActive = activeStageId === stage.id;
        const isGated = stage.state === "gated" || stage.state === "not-started";
        const setRef = (el: HTMLButtonElement | null) => {
          stationRefs.current[index] = el;
        };

        return (
          <button
            key={stage.id}
            ref={setRef}
            type="button"
            className={cn("station", isActive && "active", isGated && "gated")}
            aria-current={isActive ? "step" : undefined}
            aria-label={`Stage ${stage.number} — ${stage.name}, ${meta.label}`}
            onClick={() => onSelectStage?.(stage.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            tabIndex={isActive || (!activeStageId && index === 0) ? 0 : -1}
          >
            <span className="station-num wb-mono">{stage.number}</span>
            {stage.isLock ? <span className="lock-rivet" aria-hidden="true" /> : null}
            <span
              className={cn("station-dot", meta.dot)}
              aria-label={meta.label}
            />
            <div className="station-row">
              <span className="station-name">{stage.name}</span>
            </div>
            <div className="station-state">
              <span className="micro">{meta.label}</span>
              {stage.detail ? <> · {stage.detail}</> : null}
            </div>
            <div className="station-time wb-mono">{stage.lastTouched ?? "—"}</div>
            <StationArc state={stage.state} progress={stage.progressArc} />
          </button>
        );
      })}
    </aside>
  );
}
