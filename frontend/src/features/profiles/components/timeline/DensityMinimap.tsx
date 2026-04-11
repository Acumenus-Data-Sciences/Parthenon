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
    <div className="relative bg-surface-base border-b border-surface-overlay" style={{ height: 32 }}>
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
        <line x1={LABEL_WIDTH} x2={svgWidth} y1={31} y2={31} stroke="var(--surface-overlay)" strokeWidth={1} />
        {/* Label */}
        <text x={4} y={19} className="fill-surface-highlight" style={{ fontSize: 8 }}>
          activity
        </text>
      </svg>
    </div>
  );
}
