import type { DqDelta } from "../../../types/ares";

interface DqDeltaTableProps {
  deltas: DqDelta[];
  releaseName: string;
}

const STATUS_CONFIG: Record<
  DqDelta["delta_status"],
  { label: string; bg: string; text: string }
> = {
  new: { label: "NEW", bg: "bg-primary/20", text: "text-critical" },
  existing: { label: "EXISTING", bg: "bg-accent/20", text: "text-accent" },
  resolved: { label: "RESOLVED", bg: "bg-success/20", text: "text-success" },
  stable: { label: "STABLE", bg: "bg-surface-highlight/30", text: "text-text-muted" },
};

export default function DqDeltaTable({ deltas, releaseName }: DqDeltaTableProps) {
  if (deltas.length === 0) {
    return (
      <div className="py-8 text-center text-text-ghost">
        No delta data available for this release.
      </div>
    );
  }

  const grouped = {
    new: deltas.filter((d) => d.delta_status === "new"),
    existing: deltas.filter((d) => d.delta_status === "existing"),
    resolved: deltas.filter((d) => d.delta_status === "resolved"),
    stable: deltas.filter((d) => d.delta_status === "stable"),
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">Delta Report: {releaseName}</h3>
        <div className="flex gap-3 text-[11px]">
          <span className="text-critical">{grouped.new.length} new</span>
          <span className="text-accent">{grouped.existing.length} existing</span>
          <span className="text-success">{grouped.resolved.length} resolved</span>
          <span className="text-text-muted">{grouped.stable.length} stable</span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-overlay">
            <tr className="border-b border-border-subtle">
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">Status</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">Check ID</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">Current</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">Previous</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((delta) => {
              const config = STATUS_CONFIG[delta.delta_status];
              return (
                <tr key={delta.id} className="border-b border-border-subtle hover:bg-surface-raised">
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${config.bg} ${config.text}`}>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{delta.check_id}</td>
                  <td className="px-3 py-2">
                    <span className={delta.current_passed ? "text-success" : "text-critical"}>
                      {delta.current_passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {delta.previous_passed === null ? (
                      <span className="text-text-ghost">N/A</span>
                    ) : (
                      <span className={delta.previous_passed ? "text-success" : "text-critical"}>
                        {delta.previous_passed ? "PASS" : "FAIL"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
