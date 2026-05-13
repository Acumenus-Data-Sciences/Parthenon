import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// 4-stop micro-pipeline glyph used in Asset Matrix rows and Cohort Triptych
// cards to render the asset state-machine progression:
//
//   ● ─ ● ─ ● ─ ○      (filled = reached, hollow = not yet)
//   d   v   m   l
//
// Steps: draft → verified → materialized → linked. The `blocked` flag colors
// the current step crimson — this is the lone justified crimson use in v2
// (asset blocked, equivalent to a build error). See
// docs/lineage/design/specs/2026-05-12-studies-design-workbench-redesign.md.

export type PipelineGlyphState = "draft" | "verified" | "materialized" | "linked";

interface PipelineGlyphProps {
  /** Which step the asset has reached. */
  state: PipelineGlyphState;
  /** Optional override — for tooling that needs to render a specific blocked dot. */
  blocked?: boolean;
  /** Size variant — 'sm' for inline table cells, 'md' for triptych cards. */
  size?: "sm" | "md";
}

interface StopMeta {
  key: PipelineGlyphState;
  label: string;
  /** Short letter under the dot. */
  glyph: string;
}

const STOPS: ReadonlyArray<StopMeta> = [
  { key: "draft", label: "Draft", glyph: "d" },
  { key: "verified", label: "Verified", glyph: "v" },
  { key: "materialized", label: "Materialized", glyph: "m" },
  { key: "linked", label: "Linked", glyph: "l" },
];

const STATE_INDEX: Record<PipelineGlyphState, number> = {
  draft: 0,
  verified: 1,
  materialized: 2,
  linked: 3,
};

export function PipelineGlyph({ state, blocked = false, size = "sm" }: PipelineGlyphProps): JSX.Element {
  const reachedIndex = STATE_INDEX[state];
  const ariaLabel = blocked
    ? `Pipeline blocked at ${STOPS[reachedIndex].label}`
    : `Pipeline reached ${STOPS[reachedIndex].label}`;

  // Phase 5 motion polish: when the glyph's state advances, animate the
  // newly-reached dot with a 300 ms materialize sweep. Purely visual.
  const previousState = useRef<PipelineGlyphState | null>(null);
  const [sweeping, setSweeping] = useState(false);
  useEffect(() => {
    const prev = previousState.current;
    if (prev != null && STATE_INDEX[state] > STATE_INDEX[prev]) {
      setSweeping(true);
      const timer = window.setTimeout(() => setSweeping(false), 320);
      previousState.current = state;
      return () => window.clearTimeout(timer);
    }
    previousState.current = state;
    return undefined;
  }, [state]);

  return (
    <span
      className={cn("pipeline-glyph", size === "md" ? "md" : "sm")}
      role="img"
      aria-label={ariaLabel}
    >
      {STOPS.map((stop, index) => {
        const isReached = index < reachedIndex;
        const isActive = index === reachedIndex;
        const dotClass = blocked && isActive
          ? "blocked"
          : isActive
            ? "active"
            : isReached
              ? "done"
              : "todo";
        const showSweep = sweeping && isActive && !blocked;

        return (
          <span key={stop.key} className="stop">
            <span className={cn("dot", dotClass, showSweep && "sweeping")} aria-hidden="true" />
            <span className="label wb-mono" aria-hidden="true">{stop.glyph}</span>
            {index < STOPS.length - 1 ? (
              <span
                className={cn("connector", isReached ? "done" : "todo")}
                aria-hidden="true"
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
