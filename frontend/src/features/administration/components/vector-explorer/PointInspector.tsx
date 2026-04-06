import type { ProjectedPoint3D } from "../../api/chromaStudioApi";

interface PointInspectorProps {
  points: ProjectedPoint3D[];
  selectedIds: Set<string>;
  accentColor?: string;
  outlierIds?: Set<string>;
  duplicateIds?: Set<string>;
  orphanIds?: Set<string>;
}

export default function PointInspector({
  points,
  selectedIds,
  accentColor = "#2DD4BF",
  outlierIds,
  duplicateIds,
  orphanIds,
}: PointInspectorProps) {
  const selected = points.filter((p) => selectedIds.has(p.id));

  if (selected.length === 0) {
    return (
      <div className="text-sm text-[#5A5650]">Click a point to inspect.</div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.map((point) => {
        const flags: string[] = [];
        if (outlierIds?.has(point.id)) flags.push("Outlier");
        if (duplicateIds?.has(point.id)) flags.push("Duplicate");
        if (orphanIds?.has(point.id)) flags.push("Orphan");

        return (
          <div key={point.id} className="rounded border border-[#232328] bg-[#0E0E11] p-3">
            <div className="font-['IBM_Plex_Mono',monospace] text-xs" style={{ color: accentColor }}>
              {point.id}
            </div>
            {flags.length > 0 && (
              <div className="mt-1 flex gap-1">
                {flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: f === "Outlier" ? "#E85A6B20" : f === "Duplicate" ? "#F59E0B20" : "#5A565020",
                      color: f === "Outlier" ? "#E85A6B" : f === "Duplicate" ? "#F59E0B" : "#5A5650",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
            {Object.keys(point.metadata).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(point.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-[#8A857D]">{k}</span>
                    <span className="max-w-[60%] truncate text-[#C5C0B8]">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">
              ({point.x.toFixed(3)}, {point.y.toFixed(3)}, {point.z.toFixed(3)})
            </div>
          </div>
        );
      })}
    </div>
  );
}
