// Plan 16-04 owns this component. Plan 16-05 creates this minimal scaffold
// so FinnGenGwasResultsPage composition compiles while Plan 04 runs in
// parallel; the merger should prefer Plan 04's richer implementation (wraps
// the extended ManhattanPlot, exposes the thinning banner, ErrorBoundary,
// EmptyState, and peak-click hit detection).
//
// Shape contract (stable between plans): accepts runId + onPeakClick callback
// that receives (chrom, pos) when a peak on the Canvas is clicked.
import { useManhattanData, isManhattanInFlight } from "../../hooks/useManhattanData";
import { EmptyState } from "@/components/ui/EmptyState";

export interface FinnGenManhattanPanelProps {
  runId: string;
  onPeakClick: (chrom: string, pos: number) => void;
}

export function FinnGenManhattanPanel({
  runId,
  onPeakClick: _onPeakClick,
}: FinnGenManhattanPanelProps): JSX.Element {
  const { data, isLoading, isError } = useManhattanData(runId);

  if (isLoading) {
    return (
      <section
        aria-label="Manhattan plot"
        className="rounded-lg border border-border bg-surface p-4"
      >
        <p className="text-xs text-text-muted">Loading Manhattan plot…</p>
      </section>
    );
  }

  if (isError) {
    return <EmptyState title="Failed to load Manhattan plot" />;
  }

  if (isManhattanInFlight(data)) {
    return (
      <EmptyState
        title="GWAS run still processing"
        message={data.message ?? "Check back in ~30 seconds."}
      />
    );
  }

  return (
    <section
      aria-label="Manhattan plot"
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="mb-2 text-sm font-semibold">Manhattan plot</h2>
      <p className="text-xs text-text-muted">
        {data
          ? `${data.variants.length.toLocaleString()} variants (Plan 04 will wire canvas render + peak click)`
          : "No data"}
      </p>
    </section>
  );
}
