import type { QueueStatus } from "../types";
import { tAuto } from "@/i18n/autoUserFacing";

const STATUS_STYLES: Record<QueueStatus, { bg: string; fg: string; label: string }> = {
  pending: {
    bg: "bg-[#9B1B30]/15",
    fg: "text-[#FCA5A5]",
    label: tAuto("pending_96f608c1"),
  },
  approved: {
    bg: "bg-[#2DD4BF]/15",
    fg: "text-[#5EEAD4]",
    label: tAuto("approved_41b81eb8"),
  },
  rejected: {
    bg: "bg-zinc-700/30",
    fg: "text-zinc-300",
    label: tAuto("rejected_27eeb7a2"),
  },
  escalated: {
    bg: "bg-[#C9A227]/15",
    fg: "text-[#FBE187]",
    label: tAuto("escalated_aff666f4"),
  },
};

interface StatusPillProps {
  status: QueueStatus;
  count?: number;
  size?: "sm" | "md";
}

export function StatusPill({ status, count, size = "md" }: StatusPillProps) {
  const styles = STATUS_STYLES[status];
  const padding = size === "sm" ? "px-2 py-0.5" : "px-3 py-1";
  const fontSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${padding} ${fontSize} font-medium ${styles.bg} ${styles.fg}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {styles.label}
      {count !== undefined && (
        <span className="ml-1 font-mono tabular-nums text-current/80">
          {count}
        </span>
      )}
    </span>
  );
}
