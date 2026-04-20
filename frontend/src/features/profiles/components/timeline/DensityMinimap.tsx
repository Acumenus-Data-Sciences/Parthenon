import type React from "react";
import { LABEL_WIDTH } from "../../lib/timeline-utils";

interface DensityBucket {
  x1: number;
  x2: number;
  intensity: number;
  count: number;
}

interface MinimapViewport {
  x1: number;
  x2: number;
}

interface DensityMinimapProps {
  svgWidth: number;
  densityBuckets: DensityBucket[];
  minimapViewport: MinimapViewport;
  onMinimapClick: (e: React.MouseEvent<SVGSVGElement>) => void;
}

export type { DensityBucket, MinimapViewport };

export function DensityMinimap({
  svgWidth,
  densityBuckets,
  minimapViewport,
  onMinimapClick,
}: DensityMinimapProps) {
  return (
    <div className="relative bg-[var(--patient-timeline-track-bg)] border-b border-border-subtle" style={{ height: 32 }}>
      <svg
        width="100%"
        height={32}
        viewBox={`0 0 ${svgWidth} 32`}
        preserveAspectRatio="none"
        className="cursor-pointer"
        onClick={onMinimapClick}
      >
        {densityBuckets.map((bucket, i) => (
          <rect
            key={i}
            x={bucket.x1}
            y={0}
            width={Math.max(bucket.x2 - bucket.x1 - 0.5, 0.5)}
            height={32}
            fill="var(--success)"
            opacity={0.08 + bucket.intensity * 0.55}
          />
        ))}
        {/* Viewport indicator */}
        <rect
          x={minimapViewport.x1}
          y={1}
          width={Math.max(minimapViewport.x2 - minimapViewport.x1, 4)}
          height={30}
          fill="var(--patient-timeline-viewport-fill)"
          rx={1}
        />
        <rect
          x={minimapViewport.x1}
          y={1}
          width={Math.max(minimapViewport.x2 - minimapViewport.x1, 4)}
          height={30}
          fill="none"
          stroke="var(--patient-timeline-viewport-stroke)"
          strokeWidth={0.8}
          rx={1}
        />
        {/* Axis line */}
        <line x1={LABEL_WIDTH} x2={svgWidth} y1={31} y2={31} stroke="var(--surface-overlay)" strokeWidth={1} />
        {/* Label */}
        <text x={4} y={19} className="fill-text-muted" style={{ fontSize: 8 }}>
          activity
        </text>
      </svg>
    </div>
  );
}
