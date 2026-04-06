import { History } from "lucide-react";
import type { WikiActivityItem } from "../../types/wiki";

const ACTION_COLORS: Record<string, string> = {
  ingest: "text-teal-400",
  lint: "text-amber-400",
  query: "text-primary",
};

export function WikiActivityFeed({
  activity,
  onNavigate,
}: {
  activity: WikiActivityItem[];
  onNavigate: (slug: string) => void;
}) {
  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-8 w-8 text-muted-foreground/30" />
        <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Ingest a source to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {activity.map((item) => (
        <button
          key={`${item.timestamp}-${item.target}-${item.action}`}
          type="button"
          onClick={() => onNavigate(item.target)}
          className="w-full rounded-lg border border-white/[0.06] bg-black/20 p-3 text-left transition hover:border-white/[0.1] hover:bg-white/[0.02]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${ACTION_COLORS[item.action] ?? "text-primary"}`}>
              {item.action}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(item.timestamp).toLocaleString()}
            </p>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{item.message}</p>
        </button>
      ))}
    </div>
  );
}
