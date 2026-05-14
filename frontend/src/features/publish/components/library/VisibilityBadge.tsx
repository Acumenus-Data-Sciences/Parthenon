import { Lock, Users } from "lucide-react";
import type { PublicationDraftVisibility } from "../../types/publish";

interface VisibilityBadgeProps {
  visibility: PublicationDraftVisibility;
}

export function VisibilityBadge({ visibility }: VisibilityBadgeProps) {
  if (visibility === "private") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-primary/60">
        <Lock size={10} />Private
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
      <Users size={10} />Study
    </span>
  );
}
