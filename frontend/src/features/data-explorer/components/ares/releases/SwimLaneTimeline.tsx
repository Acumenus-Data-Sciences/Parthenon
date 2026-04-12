import type { SwimLaneEntry } from "../../../types/ares";

interface SwimLaneTimelineProps {
  data: SwimLaneEntry[];
}

const LANE_COLORS = [
  "var(--success)", "var(--accent)", "var(--primary)", "var(--domain-observation)", "var(--domain-procedure)",
  "var(--warning)", "var(--success)", "var(--domain-observation)", "#EF4444", "var(--info)",
];

export default function SwimLaneTimeline({ data }: SwimLaneTimelineProps) {
  if (data.length === 0) {
    return <p className="text-center text-xs text-text-ghost">No release data available.</p>;
  }

  // Compute global date range
  const allDates = data.flatMap((lane) => lane.releases.map((r) => new Date(r.date).getTime()));
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const range = maxDate - minDate || 1;

  return (
    <div className="space-y-3">
      {data.map((lane, laneIdx) => (
        <div key={lane.source_id} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-xs text-text-muted" title={lane.source_name}>
            {lane.source_name}
          </div>
          <div className="relative h-8 flex-1 rounded bg-surface-overlay">
            {lane.releases.map((release) => {
              const ts = new Date(release.date).getTime();
              const pct = ((ts - minDate) / range) * 100;
              const color = LANE_COLORS[laneIdx % LANE_COLORS.length];

              return (
                <div
                  key={release.id}
                  className="group absolute top-1/2 -translate-y-1/2"
                  style={{ left: `${Math.min(Math.max(pct, 1), 99)}%` }}
                >
                  <div
                    className="h-4 w-4 rounded-full border-2 transition-transform group-hover:scale-125"
                    style={{ backgroundColor: color, borderColor: `${color}66` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-surface-base px-2 py-1 text-[10px] text-text-secondary opacity-0 shadow-lg group-hover:opacity-100 transition-opacity border border-border-subtle">
                    {release.name}
                    <br />
                    <span className="text-text-ghost">{new Date(release.date).toLocaleDateString()}</span>
                    <br />
                    <span className="text-text-ghost">{release.type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {/* Date axis */}
      <div className="flex items-center gap-3">
        <div className="w-32 shrink-0" />
        <div className="flex flex-1 justify-between text-[9px] text-text-ghost">
          <span>{new Date(minDate).toLocaleDateString()}</span>
          <span>{new Date(maxDate).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
