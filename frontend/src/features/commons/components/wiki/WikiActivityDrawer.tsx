import { History, X } from "lucide-react";
import type { WikiActivityItem } from "../../types/wiki";

const ACTION_COLORS: Record<string, string> = {
  ingest: "text-[#2DD4BF]",
  lint: "text-[#C9A227]",
  query: "text-[#60A5FA]",
};

export function WikiActivityDrawer({
  activity, onNavigate, onClose,
}: {
  activity: WikiActivityItem[];
  onNavigate: (slug: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="flex h-full w-full max-w-sm flex-col border-l border-[#232328] bg-[#151518] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#232328] bg-[#1C1C20] px-4 py-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#2DD4BF]" />
            <h2 className="text-sm font-semibold text-[#F0EDE8]">Activity</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#8A857D] transition-colors hover:text-[#F0EDE8]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History size={28} className="mb-3 text-[#323238]" />
              <p className="text-sm text-[#8A857D]">No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((item) => (
                <button
                  key={`${item.timestamp}-${item.target}-${item.action}`}
                  type="button"
                  onClick={() => { onNavigate(item.target); onClose(); }}
                  className="w-full rounded-lg border border-[#232328] bg-[#1A1A1E] p-3 text-left transition-colors hover:bg-[#1C1C20]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${ACTION_COLORS[item.action] ?? "text-[#2DD4BF]"}`}>
                      {item.action}
                    </p>
                    <p className="text-[10px] text-[#5A5650]">{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                  <p className="mt-1.5 text-sm text-[#8A857D]">{item.message}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
