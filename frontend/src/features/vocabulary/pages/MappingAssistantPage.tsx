import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Upload,
  Wand2,
  ChevronDown,
  ChevronRight,
  Download,
  Check,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Save,
  FolderOpen,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import {
  mapTerms,
  cleanTerms,
  saveMappings,
  saveProject,
  listProjects,
  loadProject,
  type MappingResult,
  type MappingCandidate,
  type CleanedTerm,
  type MapTermsParams,
  type SaveMappingEntry,
  type MappingProject,
} from "../api/ariadneApi";

// ── Constants ──────────────────────────────────────────────────────────────

const VOCABULARY_OPTIONS = [
  { value: "SNOMED", label: "SNOMED CT" },
  { value: "ICD10CM", label: "ICD-10-CM" },
  { value: "RxNorm", label: "RxNorm" },
  { value: "LOINC", label: "LOINC" },
  { value: "ICD9CM", label: "ICD-9-CM" },
  { value: "CPT4", label: "CPT-4" },
  { value: "HCPCS", label: "HCPCS" },
  { value: "MedDRA", label: "MedDRA" },
];

const DOMAIN_OPTIONS = [
  { value: "Condition", label: "Condition" },
  { value: "Drug", label: "Drug" },
  { value: "Procedure", label: "Procedure" },
  { value: "Measurement", label: "Measurement" },
  { value: "Observation", label: "Observation" },
  { value: "Device", label: "Device" },
];

// ── Helper: accepted / rejected decisions ─────────────────────────────────

type Decision = "accepted" | "rejected" | null;

// ── Confidence bar ─────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8
      ? "bg-[#2DD4BF]"
      : value >= 0.5
        ? "bg-[#C9A227]"
        : "bg-[#E85A6B]";
  const textColor =
    value >= 0.8
      ? "text-[#2DD4BF]"
      : value >= 0.5
        ? "text-[#C9A227]"
        : "text-[#E85A6B]";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-[#232328] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-[11px] font-mono tabular-nums w-8 text-right", textColor)}>
        {pct}%
      </span>
    </div>
  );
}

// ── Match type badge ───────────────────────────────────────────────────────

function MatchTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    verbatim: "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30",
    vector: "bg-[#C9A227]/15 text-[#C9A227] border-[#C9A227]/30",
    llm: "bg-[#9B1B30]/15 text-[#E85A6B] border-[#9B1B30]/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border",
        styles[type] ?? "bg-[#1C1C20] text-[#8A857D] border-[#232328]",
      )}
    >
      {type}
    </span>
  );
}

// ── Multi-select pill list ─────────────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors min-w-[160px] justify-between",
          selected.length > 0
            ? "border-[#9B1B30]/40 bg-[#9B1B30]/10 text-[#E85A6B]"
            : "border-[#232328] bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8]",
        )}
      >
        <span className="truncate">
          {selected.length === 0
            ? label
            : selected.length === 1
              ? selected[0]
              : `${selected.length} selected`}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-[#232328] bg-[#151518] shadow-xl py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#1C1C20] transition-colors"
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    selected.includes(opt.value)
                      ? "bg-[#9B1B30] border-[#9B1B30]"
                      : "border-[#3A3A40] bg-transparent",
                  )}
                >
                  {selected.includes(opt.value) && (
                    <Check className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
                <span
                  className={
                    selected.includes(opt.value)
                      ? "text-[#F0EDE8]"
                      : "text-[#C5C0B8]"
                  }
                >
                  {opt.label}
                </span>
              </button>
            ))}
            {selected.length > 0 && (
              <div className="border-t border-[#232328] mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full px-3 py-1.5 text-xs text-[#5A5650] hover:text-[#C5C0B8] text-left transition-colors"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Candidate expand panel ─────────────────────────────────────────────────

function CandidatePanel({
  candidates,
}: {
  candidates: MappingCandidate[];
}) {
  if (candidates.length === 0) {
    return (
      <div className="px-6 py-3 text-sm text-[#5A5650] italic bg-[#0E0E11] border-t border-[#1C1C20]">
        No additional candidates.
      </div>
    );
  }
  return (
    <div className="px-6 pb-4 pt-2 bg-[#0E0E11] border-t border-[#1C1C20] space-y-1.5">
      <div className="text-[10px] uppercase tracking-widest text-[#5A5650] mb-2">
        All candidates ({candidates.length})
      </div>
      {candidates.map((c) => (
        <div
          key={c.concept_id}
          className="flex items-center gap-3 rounded-lg bg-[#151518] border border-[#1C1C20] px-3 py-2"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm text-[#F0EDE8] truncate">{c.concept_name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-[#5A5650] font-mono">#{c.concept_id}</span>
              <span className="text-[10px] text-[#5A5650]">{c.vocabulary_id}</span>
              <span className="text-[10px] text-[#5A5650]">{c.domain_id}</span>
            </div>
          </div>
          <MatchTypeBadge type={c.match_type} />
          <ConfidenceBar value={c.confidence} />
        </div>
      ))}
    </div>
  );
}

// ── Results row ────────────────────────────────────────────────────────────

interface ResultRowProps {
  result: MappingResult;
  decision: Decision;
  onDecide: (term: string, d: Decision) => void;
}

function ResultRow({ result, decision, onDecide }: ResultRowProps) {
  const [expanded, setExpanded] = useState(false);
  const best = result.best_match;

  return (
    <div className="border-b border-[#1C1C20] last:border-b-0">
      <div
        className={cn(
          "grid gap-3 px-4 py-3 transition-colors cursor-pointer",
          "grid-cols-[28px_1fr_1fr_100px_100px_80px_80px]",
          "hover:bg-[#1A1A1F]/60",
          expanded && "bg-[#1A1A1F]/40",
          decision === "accepted" && "bg-[#2DD4BF]/5",
          decision === "rejected" && "bg-[#E85A6B]/5 opacity-60",
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Expand toggle */}
        <div className="flex items-center">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-[#5A5650] transition-transform",
              expanded && "rotate-90 text-[#2DD4BF]",
            )}
          />
        </div>

        {/* Source term */}
        <div className="flex items-center min-w-0">
          <div>
            <div className="text-sm font-medium text-[#F0EDE8] truncate">
              {result.source_term}
            </div>
            <div className="text-[10px] text-[#5A5650] mt-0.5">
              {result.candidates.length} candidate{result.candidates.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Best match */}
        <div className="flex items-center min-w-0">
          {best ? (
            <div className="min-w-0">
              <div className="text-sm text-[#C5C0B8] truncate">{best.concept_name}</div>
              <div className="text-[10px] text-[#5A5650] font-mono mt-0.5">
                #{best.concept_id}
              </div>
            </div>
          ) : (
            <span className="text-[#5A5650] text-sm italic">No match found</span>
          )}
        </div>

        {/* Confidence */}
        <div className="flex items-center">
          {best ? (
            <ConfidenceBar value={best.confidence} />
          ) : (
            <span className="text-[#5A5650] text-xs">—</span>
          )}
        </div>

        {/* Match type */}
        <div className="flex items-center">
          {best ? (
            <MatchTypeBadge type={best.match_type} />
          ) : (
            <span className="text-[#5A5650] text-xs">—</span>
          )}
        </div>

        {/* Vocabulary */}
        <div className="flex items-center">
          {best ? (
            <span className="text-xs text-[#8A857D]">{best.vocabulary_id}</span>
          ) : (
            <span className="text-[#5A5650] text-xs">—</span>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Accept mapping"
            onClick={() =>
              onDecide(result.source_term, decision === "accepted" ? null : "accepted")
            }
            className={cn(
              "h-7 w-7 rounded-md border flex items-center justify-center transition-colors",
              decision === "accepted"
                ? "bg-[#2DD4BF]/20 border-[#2DD4BF]/40 text-[#2DD4BF]"
                : "border-[#232328] text-[#5A5650] hover:border-[#2DD4BF]/40 hover:text-[#2DD4BF] hover:bg-[#2DD4BF]/10",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Reject mapping"
            onClick={() =>
              onDecide(result.source_term, decision === "rejected" ? null : "rejected")
            }
            className={cn(
              "h-7 w-7 rounded-md border flex items-center justify-center transition-colors",
              decision === "rejected"
                ? "bg-[#E85A6B]/20 border-[#E85A6B]/40 text-[#E85A6B]"
                : "border-[#232328] text-[#5A5650] hover:border-[#E85A6B]/40 hover:text-[#E85A6B] hover:bg-[#E85A6B]/10",
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && <CandidatePanel candidates={result.candidates} />}
    </div>
  );
}

// ── Clean terms section ────────────────────────────────────────────────────

function CleanTermsSection() {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const cleanMutation = useMutation({
    mutationFn: (terms: string[]) => cleanTerms(terms),
  });

  const handleClean = () => {
    const terms = rawText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    if (terms.length === 0) return;
    cleanMutation.mutate(terms);
  };

  const cleaned: CleanedTerm[] = cleanMutation.data ?? [];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#1C1C20]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-[#C9A227]" />
          <span className="text-sm font-medium text-[#F0EDE8]">Term Cleanup</span>
          <span className="text-xs text-[#5A5650]">— normalise messy source terms before mapping</span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-[#5A5650] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-[#232328] px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Input */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#5A5650] mb-2">
                Messy terms (one per line)
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"t2dm\nCABG x2\nHTN w/ CKD stage 3\nAF/aflutter"}
                rows={6}
                className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2.5 text-sm text-[#F0EDE8] placeholder-[#3A3A40] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30 resize-none font-mono transition-colors"
              />
            </div>

            {/* Output */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#5A5650] mb-2">
                Cleaned terms
              </div>
              {cleaned.length === 0 ? (
                <div className="h-full min-h-[120px] rounded-lg border border-dashed border-[#232328] flex items-center justify-center text-[#5A5650] text-sm">
                  {cleanMutation.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cleaning…
                    </span>
                  ) : (
                    "Output will appear here"
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-[#232328] bg-[#0E0E11] divide-y divide-[#1C1C20] max-h-[200px] overflow-y-auto">
                  {cleaned.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2">
                      <span className="text-[11px] text-[#5A5650] font-mono flex-1 break-all">
                        {item.original}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#5A5650] shrink-0 mt-0.5" />
                      <span className="text-[11px] text-[#2DD4BF] font-mono flex-1 break-all">
                        {item.cleaned}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {cleanMutation.isError && (
            <div className="flex items-center gap-2 text-[#E85A6B] text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Cleanup failed. Is the Ariadne service running?</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!rawText.trim() || cleanMutation.isPending}
              onClick={handleClean}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C9A227]/40 bg-[#C9A227]/10 px-4 py-2 text-sm font-medium text-[#C9A227] hover:bg-[#C9A227]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cleanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {cleanMutation.isPending ? "Cleaning…" : "Clean Terms"}
            </button>
            {cleaned.length > 0 && (
              <button
                type="button"
                onClick={() => cleanMutation.reset()}
                className="text-xs text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CSV export helper ──────────────────────────────────────────────────────

function exportCsv(results: MappingResult[], decisions: Map<string, Decision>) {
  const header = "source_term,concept_id,concept_name,vocabulary_id,domain_id,confidence,match_type,decision";
  const rows = results.map((r) => {
    const b = r.best_match;
    const dec = decisions.get(r.source_term) ?? "";
    const escape = (v: string | number | null) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [
      escape(r.source_term),
      escape(b?.concept_id ?? ""),
      escape(b?.concept_name ?? ""),
      escape(b?.vocabulary_id ?? ""),
      escape(b?.domain_id ?? ""),
      b ? b.confidence.toFixed(4) : "",
      escape(b?.match_type ?? ""),
      escape(dec),
    ].join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ariadne-mappings.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MappingAssistantPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input state
  const [termsText, setTermsText] = useState("");
  const [targetVocabs, setTargetVocabs] = useState<string[]>([]);
  const [targetDomains, setTargetDomains] = useState<string[]>([]);

  // Results + decisions
  const [results, setResults] = useState<MappingResult[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());

  // Mapping mutation
  const mapMutation = useMutation({
    mutationFn: (params: MapTermsParams) => mapTerms(params),
    onSuccess: (data) => {
      setResults(data);
      setDecisions(new Map());
    },
  });

  // Parse textarea into term list
  const parsedTerms = termsText
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleMap = () => {
    if (parsedTerms.length === 0) return;
    mapMutation.mutate({
      source_terms: parsedTerms,
      target_vocabularies: targetVocabs.length > 0 ? targetVocabs : undefined,
      target_domains: targetDomains.length > 0 ? targetDomains : undefined,
    });
  };

  // CSV file upload — reads first column as terms
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        const lines = text.split("\n").filter(Boolean);
        const terms = lines.map((line) => {
          const firstCol = line.split(",")[0];
          return firstCol.replace(/^"|"$/g, "").trim();
        });
        setTermsText(terms.join("\n"));
      };
      reader.readAsText(file);
      // reset so same file can be re-selected
      e.target.value = "";
    },
    [],
  );

  const handleDecide = useCallback((term: string, decision: Decision) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      if (decision === null) {
        next.delete(term);
      } else {
        next.set(term, decision);
      }
      return next;
    });
  }, []);

  // ── Save / Load state ─────────────────────────────────────────────────────
  const [projectNameInput, setProjectNameInput] = useState("");
  const [showProjectNameInput, setShowProjectNameInput] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Build save-mapping entries from accepted results
  const buildSaveMappingEntries = useCallback(
    (res: MappingResult[], dec: Map<string, Decision>): SaveMappingEntry[] =>
      res
        .filter((r) => dec.get(r.source_term) === "accepted" && r.best_match !== null)
        .map((r) => ({
          source_code: r.source_term.slice(0, 50),
          source_code_description: r.source_term,
          target_concept_id: r.best_match!.concept_id,
          target_vocabulary_id: r.best_match!.vocabulary_id,
        })),
    [],
  );

  const saveMappingsMutation = useMutation({
    mutationFn: (entries: SaveMappingEntry[]) => saveMappings(entries),
    onSuccess: (data) => {
      toast.success(`Saved ${data.saved} mapping${data.saved !== 1 ? "s" : ""} to source_to_concept_map`);
    },
    onError: () => {
      toast.error("Failed to save mappings");
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: (params: { name: string }) =>
      saveProject({
        name: params.name,
        source_terms: parsedTerms,
        results,
        decisions: Object.fromEntries(decisions.entries()),
        target_vocabularies: targetVocabs.length > 0 ? targetVocabs : undefined,
        target_domains: targetDomains.length > 0 ? targetDomains : undefined,
      }),
    onSuccess: (data) => {
      toast.success(`Project saved: ${data.name}`);
      setShowProjectNameInput(false);
      setProjectNameInput("");
    },
    onError: () => {
      toast.error("Failed to save project");
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["ariadne", "projects"],
    queryFn: listProjects,
    enabled: showProjectDropdown,
  });

  const handleLoadProject = useCallback(
    async (id: number) => {
      try {
        const project: MappingProject = await loadProject(id);
        setResults(project.results);
        setDecisions(new Map(Object.entries(project.decisions) as [string, Decision][]));
        setTargetVocabs(project.target_vocabularies ?? []);
        setTargetDomains(project.target_domains ?? []);
        setTermsText(project.source_terms.join("\n"));
        setShowProjectDropdown(false);
        toast.success(`Loaded project: ${project.name}`);
      } catch {
        toast.error("Failed to load project");
      }
    },
    [setResults, setDecisions, setTargetVocabs, setTargetDomains, setTermsText],
  );

  // Summary stats
  const totalMapped = results.filter((r) => r.best_match !== null).length;
  const highConf = results.filter(
    (r) => r.best_match !== null && r.best_match.confidence >= 0.8,
  ).length;
  const needReview = results.filter(
    (r) => r.best_match !== null && r.best_match.confidence < 0.8,
  ).length;
  const noMatch = results.filter((r) => r.best_match === null).length;
  const accepted = Array.from(decisions.values()).filter((d) => d === "accepted").length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#9B1B30]/15">
            <ArrowLeftRight className="h-5 w-5 text-[#E85A6B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#F0EDE8]">
                Concept Mapping Assistant
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#9B1B30]/40 bg-[#9B1B30]/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#E85A6B]">
                <Sparkles className="h-3 w-3" />
                Powered by Ariadne
              </span>
            </div>
            <p className="text-sm text-[#8A857D] mt-0.5">
              Map source terms to OMOP standard concepts using verbatim, vector, and LLM matching
            </p>
          </div>
        </div>

        {results.length > 0 && (
          <button
            type="button"
            onClick={() => exportCsv(results, decisions)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] hover:border-[#3A3A40] transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* ── Input section ── */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-5 space-y-4">
        <div className="text-[10px] uppercase tracking-widest text-[#5A5650]">
          Source Terms
        </div>

        {/* Textarea + upload */}
        <div className="space-y-2">
          <textarea
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            placeholder={"Enter source terms, one per line...\n\ntype 2 diabetes mellitus\nacute myocardial infarction\nHTN\nASA 81mg"}
            rows={7}
            className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2.5 text-sm text-[#F0EDE8] placeholder-[#3A3A40] focus:border-[#9B1B30] focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 resize-none font-mono transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-transparent px-3 py-1.5 text-xs text-[#8A857D] hover:text-[#F0EDE8] hover:border-[#3A3A40] transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Load Project dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProjectDropdown((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-transparent px-3 py-1.5 text-xs text-[#8A857D] hover:text-[#F0EDE8] hover:border-[#3A3A40] transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Load Project
              </button>
              {showProjectDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowProjectDropdown(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-[#232328] bg-[#151518] shadow-xl py-1 max-h-64 overflow-y-auto">
                    {projectsQuery.isLoading && (
                      <div className="flex items-center gap-2 px-3 py-3 text-xs text-[#5A5650]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading projects...
                      </div>
                    )}
                    {projectsQuery.isError && (
                      <div className="px-3 py-3 text-xs text-[#E85A6B]">
                        Failed to load projects
                      </div>
                    )}
                    {projectsQuery.data && projectsQuery.data.length === 0 && (
                      <div className="px-3 py-3 text-xs text-[#5A5650]">
                        No saved projects
                      </div>
                    )}
                    {projectsQuery.data?.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleLoadProject(p.id)}
                        className="w-full text-left px-3 py-2 hover:bg-[#1C1C20] transition-colors"
                      >
                        <div className="text-sm text-[#F0EDE8] truncate">{p.name}</div>
                        <div className="text-[10px] text-[#5A5650] mt-0.5">
                          {p.source_terms.length} terms
                          {" -- "}
                          {new Date(p.updated_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {parsedTerms.length > 0 && (
              <span className="text-xs text-[#5A5650]">
                {parsedTerms.length} term{parsedTerms.length !== 1 ? "s" : ""} entered
              </span>
            )}
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-[#5A5650]">
            Target Vocabulary:
          </div>
          <MultiSelect
            label="All Vocabularies"
            options={VOCABULARY_OPTIONS}
            selected={targetVocabs}
            onChange={setTargetVocabs}
          />
          <div className="flex items-center gap-2 text-xs text-[#5A5650]">
            Target Domain:
          </div>
          <MultiSelect
            label="All Domains"
            options={DOMAIN_OPTIONS}
            selected={targetDomains}
            onChange={setTargetDomains}
          />
        </div>

        {/* Map button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={parsedTerms.length === 0 || mapMutation.isPending}
            onClick={handleMap}
            className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B22234] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mapMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-4 w-4" />
            )}
            {mapMutation.isPending ? "Mapping…" : "Map Terms"}
          </button>

          {results.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setResults([]);
                setDecisions(new Map());
                mapMutation.reset();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Clear results
            </button>
          )}
        </div>

        {/* Error */}
        {mapMutation.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-4 py-3 text-sm text-[#E85A6B]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Mapping failed. Verify the Ariadne service is running and reachable.
            </span>
          </div>
        )}
      </div>

      {/* ── Term cleanup section ── */}
      <CleanTermsSection />

      {/* ── Results section ── */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary stats bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#2DD4BF]/15 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="h-4 w-4 text-[#2DD4BF]" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#F0EDE8]">{totalMapped}</div>
                <div className="text-[11px] text-[#8A857D]">Terms mapped</div>
              </div>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#2DD4BF]/15 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-[#2DD4BF]" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#F0EDE8]">{highConf}</div>
                <div className="text-[11px] text-[#8A857D]">High confidence</div>
              </div>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#C9A227]/15 flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4 text-[#C9A227]" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#F0EDE8]">{needReview}</div>
                <div className="text-[11px] text-[#8A857D]">Need review</div>
              </div>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#9B1B30]/15 flex items-center justify-center shrink-0">
                <X className="h-4 w-4 text-[#E85A6B]" />
              </div>
              <div>
                <div className="text-xl font-bold text-[#F0EDE8]">{noMatch}</div>
                <div className="text-[11px] text-[#8A857D]">No match</div>
              </div>
            </div>
          </div>

          {accepted > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-[#2DD4BF]">
                <Check className="h-4 w-4" />
                <span>{accepted} mapping{accepted !== 1 ? "s" : ""} accepted</span>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={saveMappingsMutation.isPending}
                  onClick={() => {
                    const entries = buildSaveMappingEntries(results, decisions);
                    if (entries.length > 0) saveMappingsMutation.mutate(entries);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-white hover:bg-[#B22234] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saveMappingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Save to Vocabulary
                </button>

                {!showProjectNameInput ? (
                  <button
                    type="button"
                    onClick={() => setShowProjectNameInput(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] hover:border-[#3A3A40] transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    Save Project
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={projectNameInput}
                      onChange={(e) => setProjectNameInput(e.target.value)}
                      placeholder="Project name..."
                      className="rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#3A3A40] focus:border-[#9B1B30] focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 w-48 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && projectNameInput.trim()) {
                          saveProjectMutation.mutate({ name: projectNameInput.trim() });
                        }
                        if (e.key === "Escape") {
                          setShowProjectNameInput(false);
                          setProjectNameInput("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={!projectNameInput.trim() || saveProjectMutation.isPending}
                      onClick={() => saveProjectMutation.mutate({ name: projectNameInput.trim() })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-3 py-2 text-sm text-white hover:bg-[#B22234] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saveProjectMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectNameInput(false);
                        setProjectNameInput("");
                      }}
                      className="text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results table */}
          <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
            {/* Table header */}
            <div className="grid gap-3 px-4 py-3 border-b border-[#232328] text-[10px] font-semibold uppercase tracking-wider text-[#5A5650] grid-cols-[28px_1fr_1fr_100px_100px_80px_80px]">
              <div />
              <div>Source Term</div>
              <div>Best Match</div>
              <div>Confidence</div>
              <div>Match Type</div>
              <div>Vocabulary</div>
              <div className="text-right">Actions</div>
            </div>

            {results.map((result, i) => (
              <ResultRow
                key={result.source_term + String(i)}
                result={result}
                decision={decisions.get(result.source_term) ?? null}
                onDecide={handleDecide}
              />
            ))}
          </div>

          {/* Bottom export */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => exportCsv(results, decisions)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] hover:border-[#3A3A40] transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
