import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RingSize = "sm" | "md" | "lg";

interface ComplianceRingProps {
  percentage: number;
  size?: RingSize;
  label?: string;
  className?: string;
}

const SIZE_CONFIG: Record<
  RingSize,
  { width: number; stroke: number; fontSize: string; labelSize: string }
> = {
  sm: { width: 56, stroke: 4, fontSize: "text-sm", labelSize: "text-[10px]" },
  md: {
    width: 80,
    stroke: 5,
    fontSize: "text-lg",
    labelSize: "text-xs",
  },
  lg: {
    width: 112,
    stroke: 6,
    fontSize: "text-2xl",
    labelSize: "text-sm",
  },
};

function getComplianceColor(pct: number): string {
  if (pct >= 80) return "#2DD4BF"; // teal
  if (pct >= 50) return "#C9A227"; // gold
  return "#9B1B30"; // crimson
}

export function ComplianceRing({
  percentage,
  size = "md",
  label,
  className,
}: ComplianceRingProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.width - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const color = getComplianceColor(clamped);

  const [animatedOffset, setAnimatedOffset] = useState(circumference);
  const mounted = useRef(false);

  useEffect(() => {
    // Animate on mount / value change
    const target = circumference - (clamped / 100) * circumference;
    if (!mounted.current) {
      // First mount: tiny delay so the browser paints the initial state
      const id = requestAnimationFrame(() => {
        setAnimatedOffset(target);
      });
      mounted.current = true;
      return () => cancelAnimationFrame(id);
    }
    setAnimatedOffset(target);
  }, [clamped, circumference]);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg
        width={config.width}
        height={config.width}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke="#232328"
          strokeWidth={config.stroke}
        />
        {/* Filled arc */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      {/* Center label */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ width: config.width, height: config.width, position: "relative", marginTop: -(config.width + 4) }}
      >
        <span
          className={cn(
            "font-bold font-['IBM_Plex_Mono',monospace]",
            config.fontSize,
          )}
          style={{ color }}
        >
          {Math.round(clamped)}%
        </span>
      </div>
      {label && (
        <span
          className={cn(
            "text-[#8A857D] font-medium text-center leading-tight",
            config.labelSize,
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
