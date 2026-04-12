import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ingestFhirBundle,
  ingestFhirBatch,
  checkFhirHealth,
  type FhirIngestResult,
  type FhirHealthStatus,
} from "../api/fhirApi";

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const CDM_TABLE_ORDER = [
  "person",
  "visit_occurrence",
  "condition_occurrence",
  "drug_exposure",
  "procedure_occurrence",
  "measurement",
  "observation",
];

const CDM_TABLE_COLORS: Record<string, string> = {
  person: "var(--success)",
  visit_occurrence: "var(--info)",
  condition_occurrence: "var(--domain-procedure)",
  drug_exposure: "var(--accent)",
  procedure_occurrence: "var(--domain-observation)",
  measurement: "var(--success)",
  observation: "var(--domain-device)",
};

const EXAMPLE_BUNDLE = `{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "example-patient-1",
        "gender": "female",
        "birthDate": "1985-04-12",
        "name": [{ "family": "Smith", "given": ["Jane"] }]
      }
    },
    {
      "resource": {
        "resourceType": "Condition",
        "subject": { "reference": "Patient/example-patient-1" },
        "code": {
          "coding": [{ "system": "http://snomed.info/sct", "code": "73211009" }]
        },
        "onsetDateTime": "2020-03-15"
      }
    }
  ]
}`;

type InputMode = "json" | "file";

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: FhirHealthStatus | undefined; isLoading: boolean; isError: boolean } & { isLoading: boolean; isError: boolean }) {
  if (status === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-elevated text-text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
        Unknown
      </span>
    );
  }

  const isHealthy = status.status === "ok" || status.status === "healthy";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        isHealthy
          ? "bg-success/15 text-success"
          : "bg-critical/15 text-critical",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isHealthy ? "bg-success animate-pulse" : "bg-critical",
        )}
      />
      {isHealthy ? "Service Online" : "Service Offline"}
    </span>
  );
}

interface RecordsBarChartProps {
  records: Record<string, number>;
}

function RecordsBarChart({ records }: RecordsBarChartProps) {
  const entries = CDM_TABLE_ORDER.filter((t) => (records[t] ?? 0) > 0)
    .map((t) => ({ table: t, count: records[t] ?? 0 }));

  // Include any tables returned from API that aren't in the predefined order
  const extraEntries = Object.entries(records)
    .filter(([t, n]) => !CDM_TABLE_ORDER.includes(t) && n > 0)
    .map(([table, count]) => ({ table, count }));

  const allEntries = [...entries, ...extraEntries];
  if (allEntries.length === 0) return null;

  const max = Math.max(...allEntries.map((e) => e.count), 1);

  return (
    <div className="space-y-2">
      {allEntries.map(({ table, count }) => {
        const pct = Math.max((count / max) * 100, 2);
        const color = CDM_TABLE_COLORS[table] ?? "var(--text-muted)";
        return (
          <div key={table} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-xs text-text-secondary font-mono truncate">
              {table}
            </span>
            <div className="flex-1 h-4 rounded bg-surface-overlay overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="w-12 shrink-0 text-right text-xs tabular-nums font-semibold"
              style={{ color }}
            >
              {count.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ErrorLogProps {
  errors: FhirIngestResult["errors"];
}

function ErrorLog({ errors }: ErrorLogProps) {
  const [open, setOpen] = useState(false);

  if (errors.length === 0) return null;

  return (
    <div className="rounded-lg border border-critical/30 bg-critical/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <AlertTriangle size={14} className="shrink-0 text-critical" />
        <span className="flex-1 text-sm font-medium text-critical">
          {errors.length} resource{errors.length !== 1 ? "s" : ""} failed
        </span>
        {open ? (
          <ChevronDown size={14} className="text-critical" />
        ) : (
          <ChevronRight size={14} className="text-critical" />
        )}
      </button>

      {open && (
        <div className="border-t border-critical/20 px-4 py-3 space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-critical/20 text-critical font-mono">
                {err.resource_type}
              </span>
              <span className="text-text-secondary leading-relaxed">{err.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Panel
// ──────────────────────────────────────────────────────────────────────────────

export default function FhirIngestionPanel() {
  const [inputMode, setInputMode] = useState<InputMode>("json");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<FhirIngestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Health check (auto-refresh every 30 s) ─────────────────────────────────
  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useQuery<FhirHealthStatus>({
    queryKey: ["fhir-etl-health"],
    queryFn: checkFhirHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  // ── Ingest mutations ───────────────────────────────────────────────────────
  const bundleMutation = useMutation({
    mutationFn: ingestFhirBundle,
    onSuccess: (data) => setResult(data),
  });

  const batchMutation = useMutation({
    mutationFn: ingestFhirBatch,
    onSuccess: (data) => setResult(data),
  });

  const isPending = bundleMutation.isPending || batchMutation.isPending;
  const mutationError = bundleMutation.error ?? batchMutation.error;

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent(e.target?.result as string ?? "");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Validate & ingest ──────────────────────────────────────────────────────
  const handleIngest = () => {
    setResult(null);
    setJsonError(null);

    if (inputMode === "json") {
      const raw = jsonText.trim();
      if (!raw) {
        setJsonError("Please enter a FHIR Bundle JSON.");
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setJsonError("Invalid JSON — please check your input.");
        return;
      }
      if (typeof parsed !== "object" || parsed === null) {
        setJsonError("Input must be a JSON object.");
        return;
      }
      bundleMutation.mutate(parsed as object);
    } else {
      // file mode
      if (!fileContent) {
        return;
      }
      const trimmed = fileContent.trim();
      // Detect NDJSON (multiple lines each being JSON) vs single Bundle
      const isNdjson =
        fileName?.endsWith(".ndjson") ||
        trimmed
          .split("\n")
          .filter((l) => l.trim())
          .every((line) => {
            try {
              JSON.parse(line);
              return true;
            } catch {
              return false;
            }
          });

      if (isNdjson) {
        batchMutation.mutate(trimmed);
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          bundleMutation.reset();
          batchMutation.reset();
          setJsonError("Could not parse file as JSON or NDJSON.");
          return;
        }
        bundleMutation.mutate(parsed as object);
      }
    }
  };

  const totalRecords = result
    ? Object.values(result.records_created).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">
              FHIR → OMOP Ingestion
            </h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold tracking-wider bg-accent/15 text-accent border border-accent/30">
              FHIR R4
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Convert FHIR Bundle or NDJSON resources into OMOP CDM records
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {healthLoading ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-elevated text-text-muted">
              <Loader2 size={10} className="animate-spin" />
              Checking…
            </span>
          ) : (
            <HealthBadge
              status={healthData}
              isLoading={healthLoading}
              isError={healthError}
            />
          )}
          <button
            type="button"
            onClick={() => void refetchHealth()}
            title="Refresh health"
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Input Mode Tabs ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        {/* Tab strip */}
        <div className="flex border-b border-border-default">
          {(["json", "file"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setInputMode(mode);
                setResult(null);
                setJsonError(null);
              }}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2",
                inputMode === mode
                  ? "border-primary text-text-primary bg-surface-overlay"
                  : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-overlay",
              )}
            >
              {mode === "json" ? (
                <FileText size={14} />
              ) : (
                <Upload size={14} />
              )}
              {mode === "json" ? "Paste JSON" : "Upload File"}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="p-4">
          {inputMode === "json" ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                FHIR Bundle JSON
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                placeholder={EXAMPLE_BUNDLE}
                rows={14}
                spellCheck={false}
                className={cn(
                  "w-full rounded-md border bg-surface-base px-3 py-2.5 font-mono text-xs text-text-secondary placeholder-[#3A3A40] outline-none resize-y transition-colors",
                  jsonError
                    ? "border-critical/60 focus:border-critical"
                    : "border-border-default focus:border-primary",
                )}
              />
              {jsonError && (
                <p className="flex items-center gap-1.5 text-xs text-critical">
                  <AlertTriangle size={12} />
                  {jsonError}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                FHIR File (.json or .ndjson)
              </label>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors py-10",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : fileName
                      ? "border-success/40 bg-success/5"
                      : "border-surface-highlight bg-surface-base hover:border-text-ghost hover:bg-surface-overlay",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.ndjson"
                  className="hidden"
                  onChange={handleFileInput}
                />

                {fileName ? (
                  <>
                    <CheckCircle2 size={28} className="text-success" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-text-primary">
                        {fileName}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Click to replace
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="text-text-ghost" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-text-secondary">
                        Drop a FHIR file here
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        or click to browse — .json (Bundle) or .ndjson (batch)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {jsonError && (
                <p className="flex items-center gap-1.5 text-xs text-critical">
                  <AlertTriangle size={12} />
                  {jsonError}
                </p>
              )}
            </div>
          )}

          {/* Ingest button */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleIngest}
              disabled={
                isPending ||
                (inputMode === "json" ? !jsonText.trim() : !fileContent)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Processing FHIR resources…
                </>
              ) : (
                <>
                  <Activity size={15} />
                  Ingest
                </>
              )}
            </button>

            {result && !isPending && (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  bundleMutation.reset();
                  batchMutation.reset();
                }}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Clear results
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mutation error ───────────────────────────────────────────── */}
      {mutationError && (
        <div className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3">
          <XCircle size={15} className="mt-0.5 shrink-0 text-critical" />
          <div className="text-sm">
            <p className="font-medium text-critical">Ingestion failed</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {mutationError instanceof Error
                ? mutationError.message
                : "An unexpected error occurred. Check the service logs."}
            </p>
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Status
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold capitalize",
                  result.status === "ok" || result.status === "success"
                    ? "text-success"
                    : result.status === "partial"
                      ? "text-accent"
                      : "text-critical",
                )}
              >
                {result.status}
              </p>
            </div>

            <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Resources Processed
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {result.resources_processed.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                CDM Records Created
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-success">
                {totalRecords.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Elapsed
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {result.elapsed_seconds.toFixed(2)}s
              </p>
            </div>
          </div>

          {/* Per-table bar chart */}
          {totalRecords > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-raised p-4">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                CDM Records by Table
              </h3>
              <RecordsBarChart records={result.records_created} />
            </div>
          )}

          {/* Error log */}
          <ErrorLog errors={result.errors} />

          {/* Success notice */}
          {result.errors.length === 0 && totalRecords > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3">
              <CheckCircle2 size={15} className="shrink-0 text-success" />
              <p className="text-sm text-success">
                All resources ingested successfully — {totalRecords.toLocaleString()} CDM records created.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Footer link ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-text-ghost">
        <Activity size={11} />
        <span>Configure FHIR Server connections in</span>
        <Link
          to="/admin/fhir-connections"
          className="inline-flex items-center gap-0.5 text-accent hover:text-accent-light transition-colors"
        >
          Admin → FHIR Connections
          <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
