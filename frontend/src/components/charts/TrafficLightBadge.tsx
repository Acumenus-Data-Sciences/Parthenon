import { cn } from "@/lib/utils";

export type TrafficLightColor = "green" | "amber" | "red";

interface TrafficLightBadgeProps {
  color: TrafficLightColor;
  label: string;
  className?: string;
}

const colorMap: Record<TrafficLightColor, { bg: string; text: string; dot: string }> = {
  green: {
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  red: {
    bg: "bg-red-500/10 border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-400",
  },
};

export function TrafficLightBadge({ color, label, className }: TrafficLightBadgeProps) {
  const styles = colorMap[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles.bg,
        styles.text,
        className,
      )}
      data-testid="traffic-light-badge"
      data-color={color}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}
