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
  person: "#2DD4BF",
  visit_occurrence: "#60A5FA",
  condition_occurrence: "#F472B6",
  drug_exposure: "#C9A227",
  procedure_occurrence: "#A78BFA",
  measurement: "#34D399",
  observation: "#FB923C",
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#232328] text-[#8A857D]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8A857D]" />
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
          ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
          : "bg-[#E85A6B]/15 text-[#E85A6B]",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isHealthy ? "bg-[#2DD4BF] animate-pulse" : "bg-[#E85A6B]",
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
        const color = CDM_TABLE_COLORS[table] ?? "#8A857D";
        return (
          <div key={table} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-xs text-[#C5C0B8] font-mono truncate">
              {table}
            </span>
            <div className="flex-1 h-4 rounded bg-[#1C1C20] overflow-hidden">
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
    <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <AlertTriangle size={14} className="shrink-0 text-[#E85A6B]" />
        <span className="flex-1 text-sm font-medium text-[#E85A6B]">
          {errors.length} resource{errors.length !== 1 ? "s" : ""} failed
        </span>
        {open ? (
          <ChevronDown size={14} className="text-[#E85A6B]" />
        ) : (
          <ChevronRight size={14} className="text-[#E85A6B]" />
        )}
      </button>

      {open && (
        <div className="border-t border-[#E85A6B]/20 px-4 py-3 space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#E85A6B]/20 text-[#E85A6B] font-mono">
                {err.resource_type}
              </span>
              <span className="text-[#C5C0B8] leading-relaxed">{err.message}</span>
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
            <h2 className="text-xl font-bold text-[#F0EDE8]">
              FHIR → OMOP Ingestion
            </h2>
            <span className="px-2 py-0.5 rounded text-xs font-bold tracking-wider bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30">
              FHIR R4
            </span>
          </div>
          <p className="mt-1 text-sm text-[#8A857D]">
            Convert FHIR Bundle or NDJSON resources into OMOP CDM records
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {healthLoading ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#232328] text-[#8A857D]">
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
            className="p-1.5 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Input Mode Tabs ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        {/* Tab strip */}
        <div className="flex border-b border-[#232328]">
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
                  ? "border-[#9B1B30] text-[#F0EDE8] bg-[#1C1C20]"
                  : "border-transparent text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1A1A1E]",
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
              <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
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
                  "w-full rounded-md border bg-[#0E0E11] px-3 py-2.5 font-mono text-xs text-[#C5C0B8] placeholder-[#3A3A40] outline-none resize-y transition-colors",
                  jsonError
                    ? "border-[#E85A6B]/60 focus:border-[#E85A6B]"
                    : "border-[#232328] focus:border-[#9B1B30]",
                )}
              />
              {jsonError && (
                <p className="flex items-center gap-1.5 text-xs text-[#E85A6B]">
                  <AlertTriangle size={12} />
                  {jsonError}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
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
                    ? "border-[#9B1B30] bg-[#9B1B30]/5"
                    : fileName
                      ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/5"
                      : "border-[#323238] bg-[#0E0E11] hover:border-[#5A5660] hover:bg-[#1A1A1E]",
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
                    <CheckCircle2 size={28} className="text-[#2DD4BF]" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#F0EDE8]">
                        {fileName}
                      </p>
                      <p className="mt-0.5 text-xs text-[#8A857D]">
                        Click to replace
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="text-[#5A5660]" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#C5C0B8]">
                        Drop a FHIR file here
                      </p>
                      <p className="mt-0.5 text-xs text-[#8A857D]">
                        or click to browse — .json (Bundle) or .ndjson (batch)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {jsonError && (
                <p className="flex items-center gap-1.5 text-xs text-[#E85A6B]">
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
              className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-semibold text-[#F0EDE8] hover:bg-[#B82D42] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                className="text-xs text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
              >
                Clear results
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mutation error ───────────────────────────────────────────── */}
      {mutationError && (
        <div className="flex items-start gap-2 rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 px-4 py-3">
          <XCircle size={15} className="mt-0.5 shrink-0 text-[#E85A6B]" />
          <div className="text-sm">
            <p className="font-medium text-[#E85A6B]">Ingestion failed</p>
            <p className="mt-0.5 text-xs text-[#C5C0B8]">
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
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Status
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold capitalize",
                  result.status === "ok" || result.status === "success"
                    ? "text-[#2DD4BF]"
                    : result.status === "partial"
                      ? "text-[#C9A227]"
                      : "text-[#E85A6B]",
                )}
              >
                {result.status}
              </p>
            </div>

            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Resources Processed
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#F0EDE8]">
                {result.resources_processed.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                CDM Records Created
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#2DD4BF]">
                {totalRecords.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Elapsed
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#F0EDE8]">
                {result.elapsed_seconds.toFixed(2)}s
              </p>
            </div>
          </div>

          {/* Per-table bar chart */}
          {totalRecords > 0 && (
            <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
                CDM Records by Table
              </h3>
              <RecordsBarChart records={result.records_created} />
            </div>
          )}

          {/* Error log */}
          <ErrorLog errors={result.errors} />

          {/* Success notice */}
          {result.errors.length === 0 && totalRecords > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-4 py-3">
              <CheckCircle2 size={15} className="shrink-0 text-[#2DD4BF]" />
              <p className="text-sm text-[#2DD4BF]">
                All resources ingested successfully — {totalRecords.toLocaleString()} CDM records created.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Footer link ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-[#5A5660]">
        <Activity size={11} />
        <span>Configure FHIR Server connections in</span>
        <Link
          to="/admin/fhir-connections"
          className="inline-flex items-center gap-0.5 text-[#C9A227] hover:text-[#D4AF40] transition-colors"
        >
          Admin → FHIR Connections
          <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
