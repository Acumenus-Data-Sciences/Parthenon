import { Archive, CheckCircle2, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryStatus } from "../types";

interface Props {
  status: LibraryStatus;
  size?: "xs" | "sm";
  className?: string;
}

const META: Record<
  LibraryStatus,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  active: {
    label: "Active",
    classes: "bg-success/15 text-success ring-success/30",
    Icon: CheckCircle2,
  },
  draft: {
    label: "Draft",
    classes:
      "bg-surface-elevated text-text-secondary ring-border-default",
    Icon: FileEdit,
  },
  archived: {
    label: "Archived",
    classes: "bg-amber-500/15 text-amber-500 ring-amber-500/30",
    Icon: Archive,
  },
};

export function LifecycleStatusBadge({
  status,
  size = "sm",
  className,
}: Props) {
  const meta = META[status];
  const iconSize = size === "xs" ? 10 : 12;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1",
        size === "xs"
          ? "px-1.5 py-0.5 text-[10px]"
          : "px-2 py-0.5 text-xs",
        meta.classes,
        className,
      )}
      aria-label={`Lifecycle status: ${meta.label}`}
    >
      <meta.Icon size={iconSize} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
