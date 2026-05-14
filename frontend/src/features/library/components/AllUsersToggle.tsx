import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

interface AllUsersToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}

/**
 * Phase D · §6.5 — Super-admin inline "All users" toggle for library list pages.
 *
 * Renders nothing for non-super-admin callers. When toggled on, the parent
 * should pass `scope=all` to the list endpoint, which bypasses owner
 * restrictions across Drafts/Archived/All tabs.
 */
export function AllUsersToggle({
  value,
  onChange,
  className,
}: AllUsersToggleProps) {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (!hasRole("super-admin")) return null;

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
        value
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary hover:border-surface-highlight",
        className,
      )}
      title="Show items from all users (super-admin)"
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <Users size={12} />
      All users (admin)
    </label>
  );
}
