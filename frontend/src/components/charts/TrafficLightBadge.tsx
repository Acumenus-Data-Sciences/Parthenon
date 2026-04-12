import { cn } from "@/lib/utils";

export type TrafficLightColor = "green" | "amber" | "red";

/** Threshold-based props: compute color from value */
interface ThresholdProps {
  value: number;
  thresholds: { green: number; amber: number };
  label: string;
  higherIsBetter?: boolean;
  color?: never;
  className?: string;
}

/** Direct color props: color is provided directly */
interface DirectColorProps {
  color: TrafficLightColor;
  label: string;
  value?: never;
  thresholds?: never;
  higherIsBetter?: never;
  className?: string;
}

export type TrafficLightBadgeProps = ThresholdProps | DirectColorProps;

export type TrafficLevel = "green" | "amber" | "red";

const LEVEL_CONFIG: Record<
  TrafficLevel,
  { dot: string; text: string; verdict: string }
> = {
  green: {
    dot: "bg-success",
    text: "text-success",
    verdict: "Good",
  },
  amber: {
    dot: "bg-accent",
    text: "text-accent",
    verdict: "Acceptable",
  },
  red: {
    dot: "bg-critical",
    text: "text-critical",
    verdict: "Poor",
  },
};

/**
 * Determine traffic light level based on value vs thresholds.
 * When higherIsBetter is true (default), value >= green → green, >= amber → amber, else red.
 * When higherIsBetter is false, value <= green → green, <= amber → amber, else red.
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

export function TrafficLightBadge(props: TrafficLightBadgeProps) {
  const { label, className } = props;
  const level: TrafficLevel =
    "color" in props && props.color != null
      ? props.color
      : getLevel(props.value, props.thresholds, props.higherIsBetter ?? true);
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
        {"color" in props && props.color != null ? label : `${label}: ${config.verdict}`}
      </span>
    </span>
  );
}
