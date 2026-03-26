import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Clock,
  Download,
  Copy,
  Check,
  Info,
  GitMerge,
  BarChart3,
  FileJson,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ingestFhirBundle,
  ingestFhirBatch,
  checkFhirHealth,
  type FhirIngestResult,
  type FhirHealthStatus,
} from "../api/fhirApi";
import {
  EXAMPLE_BUNDLE,
  MAX_HISTORY,
  generateId,
  fmtNumber,
  loadHistory,
  saveHistory,
  analyzeBundle,
  analyzeNdjson,
  exportResultJson,
  type InputMode,
  type HistoryEntry,
} from "../lib/fhir-utils";
import {
  HealthBadge,
  RecordsBarChart,
  ResourcePreviewPanel,
  ErrorLog,
  MappingCoverageCard,
  IngestionHistory,
} from "../components/fhir";

// ──────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ──────────────────────────────────────────────────────────────────────────────

export default function FhirIngestionPage() {
  // ── State ──────────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>("json");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<FhirIngestResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Health check ───────────────────────────────────────────────────────
  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery<FhirHealthStatus>({
    queryKey: ["fhir-etl-health"],
    queryFn: checkFhirHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const bundleMutation = useMutation({
    mutationFn: ingestFhirBundle,
    onSuccess: (data) => handleIngestSuccess(data),
  });

  const batchMutation = useMutation({
    mutationFn: ingestFhirBatch,
    onSuccess: (data) => handleIngestSuccess(data),
  });

  const isPending = bundleMutation.isPending || batchMutation.isPending;
  const mutationError = bundleMutation.error ?? batchMutation.error;

  // ── Preview ────────────────────────────────────────────────────────────
  const preview = useMemo(() => {
    const content = inputMode === "json" ? jsonText : fileContent;
    if (!content?.trim()) return null;

    if (
      inputMode === "file" &&
      (fileName?.endsWith(".ndjson") ||
        content
          .trim()
          .split("\n")
          .filter((l) => l.trim())
          .every((line) => {
            try {
              JSON.parse(line);
              return true;
            } catch {
              return false;
            }
          }))
    ) {
      return analyzeNdjson(content);
    }

    return analyzeBundle(content);
  }, [inputMode, jsonText, fileContent, fileName]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleIngestSuccess = useCallback(
    (data: FhirIngestResult) => {
      setResult(data);
      setSelectedHistoryId(null);

      // Build resource breakdown from records
      const breakdown: Record<string, number> = {};
      for (const [table, count] of Object.entries(data.records_created)) {
        breakdown[table] = count;
      }

      const entry: HistoryEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        inputMode,
        fileName: fileName ?? undefined,
        resourceCount: data.resources_processed,
        recordsCreated: Object.values(data.records_created).reduce(
          (a, b) => a + b,
          0,
        ),
        errorCount: data.errors.length,
        status: data.status,
        elapsedSeconds: data.elapsed_seconds,
        resourceBreakdown: breakdown,
        result: data,
      };

      const updated = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(updated);
      saveHistory(updated);
    },
    [inputMode, fileName, history],
  );

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent((e.target?.result as string) ?? "");
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

  const handleIngest = useCallback(() => {
    setResult(null);
    setJsonError(null);
    setSelectedHistoryId(null);

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
        setJsonError("Invalid JSON \u2014 please check your input.");
        return;
      }
      if (typeof parsed !== "object" || parsed === null) {
        setJsonError("Input must be a JSON object.");
        return;
      }
      bundleMutation.mutate(parsed as object);
    } else {
      if (!fileContent) return;
      const trimmed = fileContent.trim();
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
  }, [inputMode, jsonText, fileContent, fileName, bundleMutation, batchMutation]);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setResult(entry.result);
    setSelectedHistoryId(entry.id);
  }, []);

  const handleHistoryDelete = useCallback(
    (id: string) => {
      const updated = history.filter((h) => h.id !== id);
      setHistory(updated);
      saveHistory(updated);
      if (selectedHistoryId === id) {
        setResult(null);
        setSelectedHistoryId(null);
      }
    },
    [history, selectedHistoryId],
  );

  const handleHistoryClear = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    if (selectedHistoryId) {
      setResult(null);
      setSelectedHistoryId(null);
    }
  }, [selectedHistoryId]);

  const handleLoadExample = useCallback(() => {
    setInputMode("json");
    setJsonText(EXAMPLE_BUNDLE);
    setJsonError(null);
    setResult(null);
  }, []);

  const handleCopyResult = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const totalRecords = result
    ? Object.values(result.records_created).reduce((a, b) => a + b, 0)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#F0EDE8]">
              FHIR Ingestion
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30">
              FHIR R4
            </span>
          </div>
          <p className="mt-1 text-sm text-[#8A857D]">
            Convert FHIR R4 Bundle or NDJSON resources into OMOP CDM records via
            the FhirToCdm service
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {healthLoading ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#232328] text-[#8A857D]">
              <Loader2 size={10} className="animate-spin" />
              Checking...
            </span>
          ) : (
            <HealthBadge status={healthData} />
          )}
          <button
            type="button"
            onClick={() => void refetchHealth()}
            title="Refresh health"
            className="p-1.5 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(155,27,48,0.12)]">
            <GitMerge size={20} className="text-[#9B1B30]" />
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: input + preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Input card */}
          <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
            {/* Tab strip */}
            <div className="flex items-center justify-between border-b border-[#232328]">
              <div className="flex">
                {(["json", "file"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setInputMode(mode);
                      setResult(null);
                      setJsonError(null);
                      setSelectedHistoryId(null);
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
              <button
                type="button"
                onClick={handleLoadExample}
                className="mr-3 text-[11px] text-[#5A5650] hover:text-[#C9A227] transition-colors flex items-center gap-1"
              >
                <FileJson size={11} />
                Load example
              </button>
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
                    placeholder="Paste a FHIR R4 Bundle JSON here..."
                    rows={16}
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
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors py-12",
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
                            {fileName.endsWith(".ndjson")
                              ? "NDJSON batch mode"
                              : "Bundle mode"}{" "}
                            &mdash; click to replace
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
                            .json (Bundle) or .ndjson (one resource per line)
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

              {/* Action buttons */}
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap size={15} />
                      Ingest Resources
                    </>
                  )}
                </button>

                {result && !isPending && (
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setSelectedHistoryId(null);
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

          {/* Resource preview */}
          {preview && !result && !isPending && (
            <ResourcePreviewPanel preview={preview} />
          )}
        </div>

        {/* Right: history */}
        <div className="space-y-4">
          <IngestionHistory
            history={history}
            onSelect={handleHistorySelect}
            onDelete={handleHistoryDelete}
            onClear={handleHistoryClear}
            selectedId={selectedHistoryId}
          />

          {/* Quick links */}
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Related
            </h4>
            <Link
              to="/admin/fhir-connections"
              className="flex items-center gap-2 text-xs text-[#C9A227] hover:text-[#D4AF40] transition-colors"
            >
              <ArrowRight size={11} />
              FHIR Server Connections
            </Link>
            <Link
              to="/admin/fhir-sync-monitor"
              className="flex items-center gap-2 text-xs text-[#C9A227] hover:text-[#D4AF40] transition-colors"
            >
              <ArrowRight size={11} />
              FHIR Sync Monitor
            </Link>
            <Link
              to="/admin/fhir-export"
              className="flex items-center gap-2 text-xs text-[#C9A227] hover:text-[#D4AF40] transition-colors"
            >
              <ArrowRight size={11} />
              FHIR Export
            </Link>
            <Link
              to="/etl-tools"
              className="flex items-center gap-2 text-xs text-[#60A5FA] hover:text-[#93B8F9] transition-colors"
            >
              <ArrowRight size={11} />
              ETL Tools (Synthea, BlackRabbit)
            </Link>
          </div>
        </div>
      </div>

      {/* ── Loading state ──────────────────────────────────────────── */}
      {isPending && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <Loader2 size={32} className="animate-spin text-[#9B1B30] mb-4" />
          <p className="text-sm text-[#C5C0B8] font-medium">
            Processing FHIR resources...
          </p>
          <p className="text-xs text-[#8A857D] mt-1">
            Converting to OMOP CDM records. This may take a moment for large
            bundles.
          </p>
        </div>
      )}

      {/* ── Mutation error ─────────────────────────────────────────── */}
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

      {/* ── Results Dashboard ──────────────────────────────────────── */}
      {result && !isPending && (
        <div className="space-y-5">
          {/* Results header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#F0EDE8]">
                Ingestion Results
              </h2>
              {selectedHistoryId && (
                <span className="text-xs text-[#5A5650] flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(
                    history.find((h) => h.id === selectedHistoryId)
                      ?.timestamp ?? "",
                  ).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyResult}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E2E35] bg-[#1C1C20] px-3 py-1.5 text-xs text-[#C5C0B8] hover:bg-[#232328] transition-colors"
              >
                {copied ? <Check size={12} className="text-[#2DD4BF]" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => exportResultJson(result)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E2E35] bg-[#1C1C20] px-3 py-1.5 text-xs text-[#C5C0B8] hover:bg-[#232328] transition-colors"
              >
                <Download size={12} />
                Export
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Status
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold capitalize",
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
                FHIR Resources
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#F0EDE8]">
                {fmtNumber(result.resources_processed)}
              </p>
            </div>

            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                CDM Records
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#2DD4BF]">
                {fmtNumber(totalRecords)}
              </p>
            </div>

            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Elapsed
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#A78BFA]">
                {result.elapsed_seconds.toFixed(2)}s
              </p>
            </div>
          </div>

          {/* Coverage + bar chart row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <MappingCoverageCard result={result} />
            <div className="lg:col-span-2">
              {totalRecords > 0 && (
                <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden h-full">
                  <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center gap-2">
                    <BarChart3 size={14} className="text-[#8A857D]" />
                    <h4 className="text-sm font-medium text-[#F0EDE8]">
                      CDM Records by Table
                    </h4>
                  </div>
                  <div className="p-4">
                    <RecordsBarChart records={result.records_created} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error log */}
          <ErrorLog errors={result.errors} />

          {/* Success notice */}
          {result.errors.length === 0 && totalRecords > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-4 py-3">
              <CheckCircle2 size={15} className="shrink-0 text-[#2DD4BF]" />
              <p className="text-sm text-[#2DD4BF]">
                All {fmtNumber(result.resources_processed)} resources ingested
                successfully &mdash; {fmtNumber(totalRecords)} CDM records
                created across{" "}
                {
                  Object.keys(result.records_created).filter(
                    (k) => result.records_created[k] > 0,
                  ).length
                }{" "}
                tables.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!result && !isPending && !mutationError && !preview && (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
            <GitMerge size={28} className="text-[#8A857D]" />
          </div>
          <h3 className="text-[#F0EDE8] font-semibold text-lg">
            Ready to ingest FHIR resources
          </h3>
          <p className="text-sm text-[#8A857D] mt-1 text-center max-w-lg">
            Paste a FHIR R4 Bundle JSON or upload a .json/.ndjson file. Resources
            are converted to OMOP CDM records (person, condition_occurrence,
            drug_exposure, etc.) via the FhirToCdm service.
          </p>
          <button
            type="button"
            onClick={handleLoadExample}
            className="mt-4 inline-flex items-center gap-2 text-xs text-[#C9A227] hover:text-[#D4AF40] transition-colors"
          >
            <FileJson size={13} />
            Load example Bundle
          </button>
          {history.length > 0 && (
            <p className="text-xs text-[#5A5650] mt-3">
              Or select a previous ingestion from the history panel.
            </p>
          )}
        </div>
      )}

      {/* ── Footer info ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-[#5A5660]">
        <span className="flex items-center gap-1">
          <Info size={11} />
          Supports FHIR R4 resources: Patient, Condition, MedicationRequest,
          Procedure, Observation, Encounter, and more
        </span>
      </div>
    </div>
  );
}
