import type { QualityReport, ProjectionStats } from "../../api/chromaStudioApi";

interface QualitySummaryProps {
  quality: QualityReport;
  stats: ProjectionStats;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  onToggle: (layer: "outliers" | "duplicates" | "orphans") => void;
}

export default function QualitySummary({ quality, stats, qaLayers, onToggle }: QualitySummaryProps) {
  const items = [
    { key: "outliers" as const, label: "Outliers", count: quality.outlier_ids.length, color: "#E85A6B" },
    { key: "duplicates" as const, label: "Duplicate pairs", count: quality.duplicate_pairs.length, color: "#F59E0B" },
    { key: "orphans" as const, label: "Orphans", count: quality.orphan_ids.length, color: "#5A5650" },
  ];

  function handleExport() {
    const rows = [
      ["id", "type", "detail"],
      ...quality.outlier_ids.map((id) => [id, "outlier", ""]),
      ...quality.duplicate_pairs.map(([a, b]) => [a, "duplicate", `pair: ${b}`]),
      ...quality.duplicate_pairs.map(([a, b]) => [b, "duplicate", `pair: ${a}`]),
      ...quality.orphan_ids.map((id) => [id, "orphan", ""]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quality-report-${stats.sampled}-samples.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onToggle(item.key)}
          className={`flex items-center gap-1.5 text-xs transition-opacity ${
            qaLayers[item.key] ? "opacity-100" : "opacity-40"
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span className="text-[#C5C0B8]">{item.count}</span>
          <span className="text-[#5A5650]">{item.label}</span>
        </button>
      ))}
      <span className="text-xs text-[#5A5650]">
        out of {stats.sampled.toLocaleString()} sampled
      </span>
      <button
        onClick={handleExport}
        className="ml-auto text-xs text-[#C9A227] hover:text-[#C9A227]/80"
      >
        Export CSV
      </button>
    </div>
  );
}
