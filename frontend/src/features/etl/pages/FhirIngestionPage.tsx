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
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ArrowRight,
  RefreshCw,
  Activity,
  Clock,
  Trash2,
  Download,
  Copy,
  Check,
  Info,
  GitMerge,
  BarChart3,
  FileJson,
  Search,
  X,
  Layers,
  Zap,
  Shield,
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

const HISTORY_KEY = "parthenon:fhir-ingestion:history";
const MAX_HISTORY = 30;

const CDM_TABLE_ORDER = [
  "person",
  "visit_occurrence",
  "condition_occurrence",
  "drug_exposure",
  "procedure_occurrence",
  "measurement",
  "observation",
  "device_exposure",
  "specimen",
  "death",
  "note",
  "cost",
];

const CDM_TABLE_COLORS: Record<string, string> = {
  person: "#2DD4BF",
  visit_occurrence: "#60A5FA",
  condition_occurrence: "#F472B6",
  drug_exposure: "#C9A227",
  procedure_occurrence: "#A78BFA",
  measurement: "#34D399",
  observation: "#FB923C",
  device_exposure: "#818CF8",
  specimen: "#F9A8D4",
  death: "#94A3B8",
  note: "#67E8F9",
  cost: "#FCD34D",
};

const FHIR_RESOURCE_ICONS: Record<string, string> = {
  Patient: "\u{1F9D1}",
  Condition: "\u{1FA7A}",
  MedicationRequest: "\u{1F48A}",
  Procedure: "\u{1FA78}",
  Observation: "\u{1F52C}",
  Encounter: "\u{1F3E5}",
  DiagnosticReport: "\u{1F4CB}",
  Immunization: "\u{1F489}",
  AllergyIntolerance: "\u26A0\uFE0F",
  CarePlan: "\u{1F4DD}",
  Claim: "\u{1F4B5}",
  Device: "\u{1FA7C}",
};

type InputMode = "json" | "file";

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
          "coding": [{ "system": "http://snomed.info/sct", "code": "73211009", "display": "Diabetes mellitus" }]
        },
        "onsetDateTime": "2020-03-15"
      }
    },
    {
      "resource": {
        "resourceType": "MedicationRequest",
        "subject": { "reference": "Patient/example-patient-1" },
        "medicationCodeableConcept": {
          "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "860975" }]
        },
        "authoredOn": "2020-03-15"
      }
    }
  ]
}`;

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  timestamp: string;
  inputMode: InputMode;
  fileName?: string;
  resourceCount: number;
  recordsCreated: number;
  errorCount: number;
  status: string;
  elapsedSeconds: number;
  resourceBreakdown: Record<string, number>;
  result: FhirIngestResult;
}

interface ResourcePreview {
  resourceType: string;
  count: number;
  hasId: number;
  hasCoding: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function analyzeBundle(raw: string): ResourcePreview[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    let resources: unknown[] = [];

    if (parsed.resourceType === "Bundle" && Array.isArray(parsed.entry)) {
      resources = parsed.entry
        .map((e: { resource?: unknown }) => e.resource)
        .filter(Boolean);
    } else if (parsed.resourceType) {
      resources = [parsed];
    }

    if (resources.length === 0) return null;

    const map = new Map<string, { count: number; hasId: number; hasCoding: number }>();

    for (const r of resources) {
      const res = r as Record<string, unknown>;
      const type = (res.resourceType as string) ?? "Unknown";
      const entry = map.get(type) ?? { count: 0, hasId: 0, hasCoding: 0 };
      entry.count++;
      if (res.id) entry.hasId++;
      // Check for any coded field
      const hasCode =
        res.code && typeof res.code === "object" && Array.isArray((res.code as { coding?: unknown[] }).coding);
      if (hasCode) entry.hasCoding++;
      map.set(type, entry);
    }

    return Array.from(map.entries())
      .map(([resourceType, stats]) => ({ resourceType, ...stats }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return null;
  }
}

function analyzeNdjson(raw: string): ResourcePreview[] | null {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const map = new Map<string, { count: number; hasId: number; hasCoding: number }>();
  let validCount = 0;

  for (const line of lines) {
    try {
      const res = JSON.parse(line) as Record<string, unknown>;
      if (!res.resourceType) continue;
      validCount++;
      const type = res.resourceType as string;
      const entry = map.get(type) ?? { count: 0, hasId: 0, hasCoding: 0 };
      entry.count++;
      if (res.id) entry.hasId++;
      const hasCode =
        res.code && typeof res.code === "object" && Array.isArray((res.code as { coding?: unknown[] }).coding);
      if (hasCode) entry.hasCoding++;
      map.set(type, entry);
    } catch {
      // skip invalid lines
    }
  }

  if (validCount === 0) return null;

  return Array.from(map.entries())
    .map(([resourceType, stats]) => ({ resourceType, ...stats }))
    .sort((a, b) => b.count - a.count);
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: FhirHealthStatus | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#232328] text-[#8A857D]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8A857D]" />
        Checking...
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

function RecordsBarChart({ records }: { records: Record<string, number> }) {
  const ordered = CDM_TABLE_ORDER.filter((t) => (records[t] ?? 0) > 0).map(
    (t) => ({ table: t, count: records[t] ?? 0 }),
  );
  const extra = Object.entries(records)
    .filter(([t, n]) => !CDM_TABLE_ORDER.includes(t) && n > 0)
    .map(([table, count]) => ({ table, count }));
  const all = [...ordered, ...extra];
  if (all.length === 0) return null;
  const max = Math.max(...all.map((e) => e.count), 1);

  return (
    <div className="space-y-2">
      {all.map(({ table, count }) => {
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
              {fmtNumber(count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ResourcePreviewPanel({ preview }: { preview: ResourcePreview[] }) {
  const totalResources = preview.reduce((s, p) => s + p.count, 0);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#8A857D]" />
          <h4 className="text-sm font-medium text-[#F0EDE8]">Resource Preview</h4>
        </div>
        <span className="text-xs text-[#8A857D]">
          {fmtNumber(totalResources)} resource{totalResources !== 1 ? "s" : ""} detected
        </span>
      </div>
      <div className="divide-y divide-[#1C1C20]">
        {preview.map((p) => {
          const icon = FHIR_RESOURCE_ICONS[p.resourceType] ?? "\u{1F4C4}";
          const idPct = p.count > 0 ? Math.round((p.hasId / p.count) * 100) : 0;
          const codePct = p.count > 0 ? Math.round((p.hasCoding / p.count) * 100) : 0;
          return (
            <div
              key={p.resourceType}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="text-base w-6 text-center">{icon}</span>
              <span className="flex-1 text-sm font-medium text-[#F0EDE8]">
                {p.resourceType}
              </span>
              <span className="text-xs tabular-nums text-[#C5C0B8] font-semibold w-12 text-right">
                {fmtNumber(p.count)}
              </span>
              <div className="flex items-center gap-3 text-[10px] text-[#8A857D] w-40 justify-end">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded",
                    idPct === 100
                      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : idPct > 0
                        ? "bg-[#C9A227]/10 text-[#C9A227]"
                        : "bg-[#E85A6B]/10 text-[#E85A6B]",
                  )}
                >
                  {idPct}% IDs
                </span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded",
                    codePct === 100
                      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : codePct > 0
                        ? "bg-[#C9A227]/10 text-[#C9A227]"
                        : "bg-[#232328] text-[#5A5650]",
                  )}
                >
                  {codePct}% coded
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorLog({ errors }: { errors: FhirIngestResult["errors"] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (errors.length === 0) return null;

  const filtered = search
    ? errors.filter(
        (e) =>
          e.resource_type.toLowerCase().includes(search.toLowerCase()) ||
          e.message.toLowerCase().includes(search.toLowerCase()),
      )
    : errors;

  // Group by resource type
  const grouped = new Map<string, typeof errors>();
  for (const err of filtered) {
    const arr = grouped.get(err.resource_type) ?? [];
    arr.push(err);
    grouped.set(err.resource_type, arr);
  }

  return (
    <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 overflow-hidden">
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
        <div className="border-t border-[#E85A6B]/20">
          {/* Search within errors */}
          {errors.length > 5 && (
            <div className="px-4 py-2 border-b border-[#E85A6B]/10">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5650]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter errors..."
                  className="w-full rounded bg-[#0E0E11] border border-[#E85A6B]/20 pl-7 pr-7 py-1.5 text-xs text-[#C5C0B8] placeholder:text-[#5A5650] outline-none focus:border-[#E85A6B]/40"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="px-4 py-3 space-y-3 max-h-[300px] overflow-y-auto">
            {Array.from(grouped.entries()).map(([type, errs]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[#E85A6B]">
                    {FHIR_RESOURCE_ICONS[type] ?? "\u{1F4C4}"} {type}
                  </span>
                  <span className="text-[10px] text-[#8A857D]">
                    ({errs.length} error{errs.length !== 1 ? "s" : ""})
                  </span>
                </div>
                {errs.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs ml-4 mb-1"
                  >
                    <XCircle size={10} className="mt-0.5 shrink-0 text-[#E85A6B]/60" />
                    <span className="text-[#C5C0B8] leading-relaxed">
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length === 0 && search && (
              <p className="text-xs text-[#8A857D] text-center py-2">
                No errors matching &quot;{search}&quot;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MappingCoverageCard({ result }: { result: FhirIngestResult }) {
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
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-[#8A857D]" />
        <h4 className="text-sm font-medium text-[#F0EDE8]">Mapping Coverage</h4>
      </div>

      <div className="space-y-2">
        {/* Records per resource ratio */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#8A857D]">CDM records / FHIR resource</span>
          <span className="text-xs font-mono font-semibold text-[#F0EDE8]">
            {ratio.toFixed(2)}x
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#232328] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(ratio * 33, 100)}%`,
              backgroundColor: ratio >= 1 ? "#2DD4BF" : "#C9A227",
            }}
          />
        </div>

        {/* Success rate */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#8A857D]">Success rate</span>
          <span
            className={cn(
              "text-xs font-mono font-semibold",
              errorRate === 0
                ? "text-[#2DD4BF]"
                : errorRate < 0.1
                  ? "text-[#C9A227]"
                  : "text-[#E85A6B]",
            )}
          >
            {((1 - errorRate) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#232328] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(1 - errorRate) * 100}%`,
              backgroundColor:
                errorRate === 0
                  ? "#2DD4BF"
                  : errorRate < 0.1
                    ? "#C9A227"
                    : "#E85A6B",
            }}
          />
        </div>

        {/* CDM table count */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#8A857D]">CDM tables populated</span>
          <span className="text-xs font-mono font-semibold text-[#60A5FA]">
            {Object.keys(result.records_created).filter((k) => result.records_created[k] > 0).length}
          </span>
        </div>
      </div>
    </div>
  );
}

function IngestionHistory({
  history,
  onSelect,
  onDelete,
  onClear,
  selectedId,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  selectedId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  if (history.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-[#1C1C20] border-b border-[#232328] text-left"
      >
        <Clock size={14} className="text-[#8A857D]" />
        <span className="flex-1 text-sm font-medium text-[#F0EDE8]">
          Ingestion History
        </span>
        <span className="text-[11px] text-[#5A5650]">{history.length}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-[#8A857D]" />
        ) : (
          <ChevronDown size={14} className="text-[#8A857D]" />
        )}
      </button>

      {expanded && (
        <div className="max-h-[420px] overflow-y-auto">
          {history.map((entry) => {
            const isSuccess =
              entry.status === "ok" || entry.status === "success";
            const isPartial = entry.status === "partial";

            return (
              <div
                key={entry.id}
                onClick={() => onSelect(entry)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border-b border-[#1C1C20] cursor-pointer hover:bg-[#1C1C20] transition-colors",
                  selectedId === entry.id &&
                    "bg-[#1C1C20] border-l-2 border-l-[#9B1B30]",
                )}
              >
                {isSuccess ? (
                  <CheckCircle2 size={14} className="shrink-0 text-[#2DD4BF]" />
                ) : isPartial ? (
                  <AlertTriangle size={14} className="shrink-0 text-[#C9A227]" />
                ) : (
                  <XCircle size={14} className="shrink-0 text-[#E85A6B]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-[#F0EDE8] truncate">
                      {entry.resourceCount} resources \u2192{" "}
                      {fmtNumber(entry.recordsCreated)} records
                    </p>
                    {entry.errorCount > 0 && (
                      <span className="text-[10px] text-[#E85A6B]">
                        {entry.errorCount} err
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#5A5650]">
                    {new Date(entry.timestamp).toLocaleString()}
                    {entry.fileName && ` \u2014 ${entry.fileName}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                  className="p-1 rounded hover:bg-[#2E2E35] text-[#5A5650] hover:text-[#E85A6B] transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          <div className="px-4 py-2 border-t border-[#232328]">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-[#5A5650] hover:text-[#E85A6B] transition-colors"
            >
              Clear all history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Export helpers
// ──────────────────────────────────────────────────────────────────────────────

function exportResultJson(result: FhirIngestResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fhir-ingest-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

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
                            \u2014 click to replace
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
              ETL Tools (Synthea, WhiteRabbit)
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
                successfully \u2014 {fmtNumber(totalRecords)} CDM records
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
