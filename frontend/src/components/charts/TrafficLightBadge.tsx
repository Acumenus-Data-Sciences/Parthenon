import { cn } from "@/lib/utils";

export interface TrafficLightBadgeProps {
  value: number;
  thresholds: { green: number; amber: number };
  label: string;
  higherIsBetter?: boolean;
  className?: string;
}

export type TrafficLevel = "green" | "amber" | "red";

const LEVEL_CONFIG: Record<
  TrafficLevel,
  { dot: string; text: string; verdict: string }
> = {
  green: {
    dot: "bg-[#2DD4BF]",
    text: "text-[#2DD4BF]",
    verdict: "Good",
  },
  amber: {
    dot: "bg-[#C9A227]",
    text: "text-[#C9A227]",
    verdict: "Acceptable",
  },
  red: {
    dot: "bg-[#E85A6B]",
    text: "text-[#E85A6B]",
    verdict: "Poor",
  },
};

/**
 * Determine traffic light level based on value vs thresholds.
 * When higherIsBetter is true (default), value >= green -> green, >= amber -> amber, else red.
 * When higherIsBetter is false, value <= green -> green, <= amber -> amber, else red.
 */
export function getLevel(
  value: number,
  thresholds: { green: number; amber: number },
  higherIsBetter = true,
): TrafficLevel {
  if (higherIsBetter) {
    if (value >= thresholds.green) return "green";
    if (value >= thresholds.amber) return "amber";
    return "red";
  }
  // Lower is better
  if (value <= thresholds.green) return "green";
  if (value <= thresholds.amber) return "amber";
  return "red";
}

export function TrafficLightBadge({
  value,
  thresholds,
  label,
  higherIsBetter = true,
  className,
}: TrafficLightBadgeProps) {
  const level = getLevel(value, thresholds, higherIsBetter);
  const config = LEVEL_CONFIG[level];

  return (
    <span
      data-testid="traffic-light-badge"
      className={cn(
        "inline-flex items-center gap-2 text-sm",
        className,
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", config.dot)} />
      <span className={cn("font-medium", config.text)}>
        {label}: {config.verdict}
      </span>
    </span>
  );
}
