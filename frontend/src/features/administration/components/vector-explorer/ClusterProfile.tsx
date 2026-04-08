import type { ClusterInfo } from "../../api/chromaStudioApi";

interface ClusterProfileProps {
  cluster: ClusterInfo | null;
  accentColor?: string;
}

export default function ClusterProfile({
  cluster,
  accentColor = "#C9A227",
}: ClusterProfileProps) {
  if (! cluster) {
    return (
      <div className="text-sm text-[#5A5650]">Select a cluster to inspect its dominant metadata.</div>
    );
  }

  return (
    <div className="space-y-3 rounded border border-[#232328] bg-[#0E0E11] p-3">
      <div>
        <div className="text-sm font-semibold text-[#F0EDE8]">{cluster.label}</div>
        {cluster.summary?.subtitle && (
          <div className="mt-1 text-xs text-[#5A5650]">{cluster.summary.subtitle}</div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8A857D]">Cluster size</span>
        <span className="font-['IBM_Plex_Mono',monospace]" style={{ color: accentColor }}>
          {cluster.size.toLocaleString()}
        </span>
      </div>

      {cluster.summary?.dominant_metadata?.length ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
            Dominant Metadata
          </div>
          <div className="space-y-1.5">
            {cluster.summary.dominant_metadata.map((item) => (
              <div key={`${cluster.id}:${item.key}`} className="rounded bg-[#111216] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#8A857D]">{item.label}</span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[#5A5650]">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-[#C5C0B8]">{item.display_value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {cluster.summary?.representative_titles?.length ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
            Representative Titles
          </div>
          <div className="space-y-1">
            {cluster.summary.representative_titles.map((title) => (
              <div key={`${cluster.id}:${title}`} className="rounded bg-[#111216] px-2 py-1.5 text-sm text-[#C5C0B8]">
                {title}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
