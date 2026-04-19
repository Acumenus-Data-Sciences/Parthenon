// Phase 16 (Plan 16-04) — FinnGenManhattanPanel: live GWAS-run Manhattan plot
// wrapper. Composes useManhattanData (with 202-polling) + ManhattanPlot
// (with preThinned + role=img + aria-label) + ErrorBoundary + EmptyState.
//
// Six visible states (per the TDD spec):
//   1. Loading — query pending
//   2. In-flight (202) — run queued/running, shows polling hint
//   3. Success — Canvas render + thinning banner (with data-thinning-banner
//      attribute for Plan 16-07 Playwright assertions, W-4)
//   4. 410 Gone — run failed, shows "Run failed" copy
//   5. 404 Not Found — run id invalid, shows "Run not found" copy
//   6. Generic error — anything else, shows "Unable to load Manhattan plot"
//
// Peak clicks map (chrom, pos) → onPeakClick. The panel also exposes a
// test-only hidden button (data-testid="__test-invoke-peak") that fires
// onPeakClick with the first variant's coordinates, so Vitest can assert
// click-forwarding without simulating canvas pixel coordinates.
import { useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmptyState } from "@/components/ui/EmptyState";
import ManhattanPlot, {
  type ManhattanPlotDataItem,
} from "@/features/investigation/components/genomic/ManhattanPlot";
import {
  isManhattanInFlight,
  isManhattanReady,
  useManhattanData,
} from "../../hooks/useManhattanData";
import type {
  ManhattanPayload,
  ManhattanVariant,
} from "../../api/gwas-results";

interface AxiosErrorLike {
  response?: { status?: number };
  message?: string;
}

function statusOf(error: unknown): number | undefined {
  return (error as AxiosErrorLike).response?.status;
}

function messageOf(error: unknown): string {
  const msg = (error as AxiosErrorLike).message;
  return typeof msg === "string" && msg.length > 0 ? msg : "Unexpected error";
}

export interface FinnGenManhattanPanelProps {
  runId: string;
  onPeakClick?: (chrom: string, pos: number) => void;
  width?: number;
  height?: number;
}

function renderError(error: unknown): JSX.Element {
  const status = statusOf(error);
  if (status === 410) {
    return (
      <EmptyState
        title="Run failed"
        message="The GWAS run did not complete. Check the run log for details."
      />
    );
  }
  if (status === 404) {
    return (
      <EmptyState
        title="Run not found"
        message="This GWAS run does not exist or was removed."
      />
    );
  }
  return (
    <EmptyState
      title="Unable to load Manhattan plot"
      message={messageOf(error)}
    />
  );
}

function renderInFlight(status: "queued" | "running"): JSX.Element {
  return (
    <EmptyState
      title="GWAS run is still processing"
      message={`Status: ${status}. Polling every 30s.`}
    />
  );
}

function reshapeVariants(payload: ManhattanPayload): ManhattanPlotDataItem[] {
  return payload.variants.map((v: ManhattanVariant) => ({
    chr: v.chrom,
    pos: v.pos,
    // Reconstruct raw p-value from neg_log_p for ManhattanPlot's existing
    // interface, but pass the pre-computed negLogP so the hook skips the
    // redundant Math.log10 on 100k+ points.
    p: Math.pow(10, -v.neg_log_p),
    negLogP: v.neg_log_p,
  }));
}

export function FinnGenManhattanPanel({
  runId,
  onPeakClick,
  width = 1200,
  height = 400,
}: FinnGenManhattanPanelProps): JSX.Element {
  const { data, isLoading, isError, error } = useManhattanData(runId);

  // Always compute the reshaped points; it's memoized and cheap, but the
  // hook must run unconditionally before any branch that bails.
  const points = useMemo<ManhattanPlotDataItem[]>(() => {
    if (isManhattanReady(data)) return reshapeVariants(data);
    return [];
  }, [data]);

  if (isLoading) {
    return (
      <EmptyState
        title="Loading Manhattan plot…"
        message="Fetching thinned summary statistics from the server."
      />
    );
  }

  if (isError) {
    return renderError(error);
  }

  if (isManhattanInFlight(data)) {
    return renderInFlight(data.status);
  }

  if (!isManhattanReady(data)) {
    // Defensive fallback — should not occur given the branches above.
    return <EmptyState title="No Manhattan data available" />;
  }

  const { thinning } = data;
  const firstVariant = data.variants[0];

  return (
    <ErrorBoundary
      fallback={
        <EmptyState
          title="Chart crashed"
          message="The Manhattan plot failed to render. Reload to retry."
        />
      }
    >
      <section
        aria-label="Manhattan plot"
        className="rounded-lg border border-border-default bg-surface-raised p-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            data-thinning-banner
            className="text-xs text-text-muted"
          >
            Displaying {thinning.variant_count_after.toLocaleString()} of{" "}
            {thinning.variant_count_before.toLocaleString()} variants (threshold
            p&lt;{thinning.threshold.toExponential(1)})
          </span>
        </div>
        <ManhattanPlot
          data={points}
          preThinned
          width={width}
          height={height}
          onPointClick={(p) => onPeakClick?.(p.chr, p.pos)}
        />
        {/*
          Test-only hook: jsdom can't compute Canvas click coordinates, so we
          expose a hidden button whose click synthesizes a peak-click for the
          first variant. Keeps the peak-forwarding contract Vitest-testable
          without mocking ManhattanPlot internals.
        */}
        {onPeakClick && firstVariant && (
          <button
            type="button"
            data-testid="__test-invoke-peak"
            aria-hidden="true"
            tabIndex={-1}
            style={{ position: "absolute", left: "-9999px" }}
            onClick={() => onPeakClick(firstVariant.chrom, firstVariant.pos)}
          >
            test-only peak trigger
          </button>
        )}
      </section>
    </ErrorBoundary>
  );
}
