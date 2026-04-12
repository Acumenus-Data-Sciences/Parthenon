import { useState } from "react";
import { Clock, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreToGrade } from "../lib/profiler-utils";
import type { ProfileSummary } from "../api";

// Grade letter → approximate numeric score for display badge
function gradeToScore(grade: string): number {
  switch (grade.toUpperCase()) {
    case "A": return 0.02;
    case "B": return 0.10;
    case "C": return 0.22;
    case "D": return 0.40;
    case "F": return 0.60;
    default: return 0.50;
  }
}

export function ScanHistorySidebar({
  profiles,
  onSelect,
  onDelete,
  onCompare,
  selectedId,
}: {
  profiles: ProfileSummary[];
  onSelect: (profile: ProfileSummary) => void;
  onDelete: (profileId: number) => void;
  onCompare: (currentId: number, baselineId: number) => void;
  selectedId: number | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());

  if (profiles.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-surface-overlay border-b border-border-default text-left"
      >
        <Clock size={14} className="text-text-muted" />
        <span className="flex-1 text-sm font-medium text-text-primary">
          Scan History
        </span>
        <span className="text-[11px] text-text-ghost">{profiles.length}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-text-muted" />
        ) : (
          <ChevronDown size={14} className="text-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="max-h-[400px] overflow-y-auto">
          {compareIds.size === 2 && (
            <div className="px-3 py-2 border-b border-border-default">
              <button
                type="button"
                onClick={() => {
                  const ids = Array.from(compareIds);
                  const sorted = profiles
                    .filter((p) => ids.includes(p.id))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  if (sorted.length === 2) {
                    onCompare(sorted[0].id, sorted[1].id);
                  }
                  setCompareIds(new Set());
                }}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg font-medium transition-colors"
              >
                Compare Selected
              </button>
            </div>
          )}
          {profiles.map((profile) => {
            const grade = scoreToGrade(gradeToScore(profile.overall_grade));
            return (
              <div
                key={profile.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle cursor-pointer hover:bg-surface-overlay transition-colors",
                  selectedId === profile.id && "bg-surface-overlay border-l-2 border-l-primary",
                )}
                onClick={() => onSelect(profile)}
              >
                <input
                  type="checkbox"
                  checked={compareIds.has(profile.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const next = new Set(compareIds);
                    if (e.target.checked) {
                      if (next.size < 2) next.add(profile.id);
                    } else {
                      next.delete(profile.id);
                    }
                    setCompareIds(next);
                  }}
                  className="w-4 h-4 rounded border-border-hover bg-transparent accent-teal-500 shrink-0"
                  title="Select for comparison"
                />
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: grade.bg, color: grade.color }}
                >
                  {profile.overall_grade}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {profile.table_count} tables &middot; {profile.overall_grade}
                  </p>
                  <p className="text-[10px] text-text-ghost">
                    {new Date(profile.created_at).toLocaleString()} &mdash;{" "}
                    {profile.scan_time_seconds.toFixed(1)}s
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(profile.id);
                  }}
                  className="p-1 rounded hover:bg-surface-accent text-text-ghost hover:text-critical transition-colors"
                  title="Delete scan"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
