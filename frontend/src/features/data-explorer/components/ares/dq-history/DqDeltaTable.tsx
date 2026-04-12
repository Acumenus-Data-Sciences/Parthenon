import type { DqDelta } from "../../../types/ares";

interface DqDeltaTableProps {
  deltas: DqDelta[];
  releaseName: string;
}

const STATUS_CONFIG: Record<
  DqDelta["delta_status"],
  { label: string; bg: string; text: string }
> = {
  new: { label: "NEW", bg: "bg-[#9B1B30]/20", text: "text-[#e85d75]" },
  existing: { label: "EXISTING", bg: "bg-[#C9A227]/20", text: "text-[#C9A227]" },
  resolved: { label: "RESOLVED", bg: "bg-[#2DD4BF]/20", text: "text-[#2DD4BF]" },
  stable: { label: "STABLE", bg: "bg-[#333]/30", text: "text-[#888]" },
};

export default function DqDeltaTable({ deltas, releaseName }: DqDeltaTableProps) {
  if (deltas.length === 0) {
    return (
      <div className="py-8 text-center text-[#555]">
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
          <span className="text-[#e85d75]">{grouped.new.length} new</span>
          <span className="text-[#C9A227]">{grouped.existing.length} existing</span>
          <span className="text-[#2DD4BF]">{grouped.resolved.length} resolved</span>
          <span className="text-[#888]">{grouped.stable.length} stable</span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#1a1a22]">
            <tr className="border-b border-[#252530]">
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Status</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Check ID</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Current</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Previous</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((delta) => {
              const config = STATUS_CONFIG[delta.delta_status];
              return (
                <tr key={delta.id} className="border-b border-[#1a1a22] hover:bg-[#151518]">
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${config.bg} ${config.text}`}>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[#ccc]">{delta.check_id}</td>
                  <td className="px-3 py-2">
                    <span className={delta.current_passed ? "text-[#2DD4BF]" : "text-[#e85d75]"}>
                      {delta.current_passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {delta.previous_passed === null ? (
                      <span className="text-[#555]">N/A</span>
                    ) : (
                      <span className={delta.previous_passed ? "text-[#2DD4BF]" : "text-[#e85d75]"}>
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
