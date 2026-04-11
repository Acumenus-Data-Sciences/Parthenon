import type { ClusterInfo } from "../../api/chromaStudioApi";

interface ClusterProfileProps {
  cluster: ClusterInfo | null;
  accentColor?: string;
}

export default function ClusterProfile({
  cluster,
  accentColor = "var(--accent)",
}: ClusterProfileProps) {
  if (! cluster) {
    return (
      <div className="text-sm text-text-ghost">Select a cluster to inspect its dominant metadata.</div>
    );
  }

  return (
    <div className="space-y-3 rounded border border-border-default bg-surface-base p-3">
      <div>
        <div className="text-sm font-semibold text-text-primary">{cluster.label}</div>
        {cluster.summary?.subtitle && (
          <div className="mt-1 text-xs text-text-ghost">{cluster.summary.subtitle}</div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Cluster size</span>
        <span className="font-['IBM_Plex_Mono',monospace]" style={{ color: accentColor }}>
          {cluster.size.toLocaleString()}
        </span>
      </div>

      {cluster.summary?.dominant_metadata?.length ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Dominant Metadata
          </div>
          <div className="space-y-1.5">
            {cluster.summary.dominant_metadata.map((item) => (
              <div key={`${cluster.id}:${item.key}`} className="rounded bg-[#111216] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-text-muted">{item.label}</span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-ghost">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-text-secondary">{item.display_value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {cluster.summary?.representative_titles?.length ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Representative Titles
          </div>
          <div className="space-y-1">
            {cluster.summary.representative_titles.map((title) => (
              <div key={`${cluster.id}:${title}`} className="rounded bg-[#111216] px-2 py-1.5 text-sm text-text-secondary">
                {title}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
