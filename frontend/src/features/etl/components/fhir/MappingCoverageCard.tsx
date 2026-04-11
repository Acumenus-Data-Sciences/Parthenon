import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FhirIngestResult } from "../../api/fhirApi";

export function MappingCoverageCard({ result }: { result: FhirIngestResult }) {
  const totalRecords = Object.values(result.records_created).reduce(
    (a, b) => a + b,
    0,
  );
  const ratio =
    result.resources_processed > 0
      ? totalRecords / result.resources_processed
      : 0;
  const errorRate =
    result.resources_processed > 0
      ? result.errors.length / result.resources_processed
      : 0;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-text-muted" />
        <h4 className="text-sm font-medium text-text-primary">Mapping Coverage</h4>
      </div>

      <div className="space-y-2">
        {/* Records per resource ratio */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">CDM records / FHIR resource</span>
          <span className="text-xs font-mono font-semibold text-text-primary">
            {ratio.toFixed(2)}x
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(ratio * 33, 100)}%`,
              backgroundColor: ratio >= 1 ? "var(--success)" : "var(--accent)",
            }}
          />
        </div>

        {/* Success rate */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-text-muted">Success rate</span>
          <span
            className={cn(
              "text-xs font-mono font-semibold",
              errorRate === 0
                ? "text-success"
                : errorRate < 0.1
                  ? "text-accent"
                  : "text-critical",
            )}
          >
            {((1 - errorRate) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(1 - errorRate) * 100}%`,
              backgroundColor:
                errorRate === 0
                  ? "var(--success)"
                  : errorRate < 0.1
                    ? "var(--accent)"
                    : "var(--critical)",
            }}
          />
        </div>

        {/* CDM table count */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-text-muted">CDM tables populated</span>
          <span className="text-xs font-mono font-semibold text-info">
            {Object.keys(result.records_created).filter((k) => result.records_created[k] > 0).length}
          </span>
        </div>
      </div>
    </div>
  );
}
