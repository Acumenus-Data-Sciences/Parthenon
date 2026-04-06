import { History } from "lucide-react";
import type { WikiActivityItem } from "../../types/wiki";

export function WikiActivityFeed({ activity }: { activity: WikiActivityItem[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#15151a]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Activity</h2>
      </div>
      <div className="max-h-[26rem] overflow-y-auto px-4 py-3">
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wiki activity yet.</p>
        ) : (
          <div className="space-y-3">
            {activity.map((item) => (
              <div key={`${item.timestamp}-${item.target}-${item.action}`} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{item.action}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{item.target}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
