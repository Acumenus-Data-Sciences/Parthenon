import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useValidateImport } from "../../hooks/useGisImport";
import type { ValidationResult } from "../../types/gisImport";

interface Props {
  importId: number;
  onComplete: (result: ValidationResult) => void;
  onBack: () => void;
}

export function ValidateStep({ importId, onComplete, onBack }: Props) {
  const validate = useValidateImport();

  useEffect(() => {
    if (!validate.data && !validate.isPending && !validate.isError) {
      validate.mutate(importId);
    }
  }, [importId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (validate.isPending) {
    return (
      <div className="flex flex-col items-center py-8">
        <Loader2 className="mb-2 h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-text-muted">Validating...</p>
      </div>
    );
  }

  if (validate.isError) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Validation failed: {validate.error instanceof Error ? validate.error.message : "Unknown error"}
      </div>
    );
  }

  const result = validate.data;
  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="rounded border border-border-default bg-surface-base p-4">
        <h3 className="mb-3 text-sm font-medium text-[#E8E4DC]">Validation Results</h3>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total Rows" value={result.total_rows} />
          <Stat label="Unique Geographies" value={result.unique_geographies} />
          <Stat label="Matched" value={result.matched} color="text-green-400" />
          <Stat label="Unmatched (stubs)" value={result.unmatched} color={result.unmatched > 0 ? "text-amber-400" : "text-green-400"} />
          <Stat label="Match Rate" value={`${result.match_rate}%`} />
          <Stat label="Geography Type" value={result.location_type} />
        </div>
      </div>

      {result.unmatched > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-300">
            <p>{result.unmatched} geographies not found in the database. Stub entries will be created (no boundary geometry).</p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded border border-surface-highlight px-4 py-2 text-sm text-text-muted hover:border-text-ghost"
        >
          Back to Mapping
        </button>
        <button
          onClick={() => onComplete(result)}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90"
        >
          Proceed with Import
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-text-ghost">{label}</p>
      <p className={`text-lg font-semibold ${color ?? "text-[#E8E4DC]"}`}>{value}</p>
    </div>
  );
}
