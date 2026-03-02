import { type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChipProps {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  onToggle?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function FilterChip({
  label,
  active,
  icon,
  onToggle,
  onRemove,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={cn("filter-chip", active && "active", className)}
      onClick={onToggle}
    >
      {icon}
      {label}
      {onRemove && active && (
        <span
          className="chip-close"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          role="button"
          aria-label={`Remove ${label}`}
        >
          <X size={12} />
        </span>
      )}
    </button>
  );
}
