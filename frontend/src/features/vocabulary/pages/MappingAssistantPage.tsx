import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  HelpCircle,
  Repeat,
  Zap,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/i18n/format";
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

const VOCABULARY_OPTIONS = ["SNOMED", "ICD10CM", "RxNorm", "LOINC", "ICD9CM", "CPT4", "HCPCS", "MedDRA"] as const;

const DOMAIN_OPTIONS = ["Condition", "Drug", "Procedure", "Measurement", "Observation", "Device"] as const;

// ── Helper: accepted / rejected decisions ─────────────────────────────────

type Decision = "accepted" | "rejected" | null;

// ── Confidence bar ─────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8
      ? "bg-success"
      : value >= 0.5
        ? "bg-accent"
        : "bg-critical";
  const textColor =
    value >= 0.8
      ? "text-success"
      : value >= 0.5
        ? "text-accent"
        : "text-critical";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
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
    verbatim: "bg-success/15 text-success border-success/30",
    vector: "bg-accent/15 text-accent border-accent/30",
    llm: "bg-primary/15 text-critical border-primary/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border",
        styles[type] ?? "bg-surface-overlay text-text-muted border-border-default",
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
  const { t } = useTranslation("app");
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
            ? "border-primary/40 bg-primary/10 text-critical"
            : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary",
        )}
      >
        <span className="truncate">
          {selected.length === 0
            ? label
            : selected.length === 1
              ? (options.find((opt) => opt.value === selected[0])?.label ?? selected[0])
              : t("vocabulary.mappingAssistant.filters.selectedCount", { count: selected.length })}
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
          <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-border-default bg-surface-raised shadow-xl py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-overlay transition-colors"
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    selected.includes(opt.value)
                      ? "bg-primary border-primary"
                      : "border-surface-highlight bg-transparent",
                  )}
                >
                  {selected.includes(opt.value) && (
                    <Check className="h-2.5 w-2.5 text-text-primary" />
                  )}
                </div>
                <span
                  className={
                    selected.includes(opt.value)
                      ? "text-text-primary"
                      : "text-text-secondary"
                  }
                >
                  {opt.label}
                </span>
              </button>
            ))}
            {selected.length > 0 && (
              <div className="border-t border-border-default mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full px-3 py-1.5 text-xs text-text-ghost hover:text-text-secondary text-left transition-colors"
                >
                  {t("vocabulary.mappingAssistant.filters.clearSelection")}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Side drawer for disambiguation ─────────────────────────────────────────

interface DisambiguationDrawerProps {
  result: MappingResult | null;
  onClose: () => void;
  onSelectCandidate: (sourceTerm: string, candidate: MappingCandidate) => void;
}

function DisambiguationDrawer({ result, onClose, onSelectCandidate }: DisambiguationDrawerProps) {
  const { t } = useTranslation("app");
  const [cleanRawText, setCleanRawText] = useState("");
  const [remapPending, setRemapPending] = useState(false);
  const cleanMutation = useMutation({
    mutationFn: (terms: string[]) => cleanTerms(terms),
  });

  const remapMutation = useMutation({
    mutationFn: (params: { sourceTerm: string; cleanedTerm: string }) =>
      mapTerms({ source_terms: [params.cleanedTerm] }),
    onSuccess: (data, variables) => {
      const mapped = data[0];
      if (mapped?.best_match) {
        onSelectCandidate(variables.sourceTerm, mapped.best_match);
        toast.success(t("vocabulary.mappingAssistant.toasts.remapped", {
          source: variables.sourceTerm,
          concept: mapped.best_match.concept_name,
        }));
        onClose();
      } else {
        toast.error(t("vocabulary.mappingAssistant.toasts.noMatchForCleaned", {
          term: variables.cleanedTerm,
        }));
      }
      setRemapPending(false);
    },
    onError: () => {
      toast.error(t("vocabulary.mappingAssistant.toasts.remapFailed"));
      setRemapPending(false);
    },
  });

  const cleaned: CleanedTerm[] = cleanMutation.data ?? [];

  const handleRemap = (cleanedTerm: string) => {
    if (!result) return;
    setRemapPending(true);
    remapMutation.mutate({ sourceTerm: result.source_term, cleanedTerm });
  };

  // Reset clean state when result changes
  useEffect(() => {
    if (result) {
      setCleanRawText(result.source_term);
      cleanMutation.reset();
      setRemapPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.source_term]);

  const handleClean = () => {
    const terms = cleanRawText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    if (terms.length === 0) return;
    cleanMutation.mutate(terms);
  };

  if (!result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] rounded-xl border border-border-default bg-surface-base shadow-2xl flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-text-ghost mb-1">
              {t("vocabulary.mappingAssistant.drawer.disambiguate")}
            </div>
            <div className="text-base font-semibold text-text-primary truncate">
              {result.source_term}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 h-8 w-8 rounded-lg border border-border-default flex items-center justify-center text-text-ghost hover:text-text-primary hover:border-surface-highlight transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Candidates list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-text-ghost mb-3">
            {t("vocabulary.mappingAssistant.drawer.candidateCount", { count: result.candidates.length })}
          </div>

          {result.candidates.length === 0 && (
            <div className="text-sm text-text-ghost italic py-8 text-center">
              {t("vocabulary.mappingAssistant.drawer.noCandidates")}
            </div>
          )}

          {result.candidates.map((c) => (
            <button
              key={c.concept_id}
              type="button"
              onClick={() => {
                onSelectCandidate(result.source_term, c);
                onClose();
              }}
              className="w-full text-left rounded-lg border border-border-subtle bg-surface-raised p-3 space-y-2 hover:border-success/40 hover:bg-success/5 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary group-hover:text-success transition-colors">
                    {c.concept_name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-text-ghost font-mono">#{c.concept_id}</span>
                    <span className="text-[10px] text-text-ghost">{c.vocabulary_id}</span>
                    <span className="text-[10px] text-text-ghost">{c.domain_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <MatchTypeBadge type={c.match_type} />
                </div>
              </div>
              <ConfidenceBar value={c.confidence} />
            </button>
          ))}
        </div>

        {/* Clean term section */}
        <div className="border-t border-border-default px-5 py-4 space-y-3 shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-text-ghost">
            {t("vocabulary.mappingAssistant.drawer.cleanRemap")}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={cleanRawText}
              onChange={(e) => setCleanRawText(e.target.value)}
              placeholder={t("vocabulary.mappingAssistant.drawer.editPlaceholder")}
              className="flex-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 font-mono transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && cleanRawText.trim()) handleClean();
              }}
            />
            <button
              type="button"
              disabled={!cleanRawText.trim() || cleanMutation.isPending}
              onClick={handleClean}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {cleanMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {t("vocabulary.mappingAssistant.actions.clean")}
            </button>
          </div>
          {cleaned.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-raised divide-y divide-border-subtle">
              {cleaned.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[11px] text-text-ghost font-mono flex-1 truncate">
                    {item.original}
                  </span>
                  <ChevronRight className="h-3 w-3 text-text-ghost shrink-0" />
                  <span className="text-[11px] text-success font-mono flex-1 truncate">
                    {item.cleaned}
                  </span>
                  <button
                    type="button"
                    disabled={remapPending}
                    onClick={() => handleRemap(item.cleaned)}
                    className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success hover:bg-success/20 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {remapPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {t("vocabulary.mappingAssistant.actions.remap")}
                  </button>
                </div>
              ))}
            </div>
          )}
          {cleanMutation.isError && (
            <div className="flex items-center gap-2 text-critical text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{t("vocabulary.mappingAssistant.errors.cleanupFailed")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Results row ────────────────────────────────────────────────────────────

interface ResultRowProps {
  result: MappingResult;
  decision: Decision;
  override: MappingCandidate | undefined;
  onDecide: (term: string, d: Decision) => void;
  onOpenDrawer: (result: MappingResult) => void;
  onSwapCandidate: (sourceTerm: string, candidate: MappingCandidate) => void;
}

function ResultRow({ result, decision, override, onDecide, onOpenDrawer, onSwapCandidate }: ResultRowProps) {
  const { t } = useTranslation("app");
  const [showCandidates, setShowCandidates] = useState(false);
  const display = override ?? result.best_match;

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <div
        className={cn(
          "grid gap-3 px-4 py-3 transition-colors",
          "grid-cols-[28px_1fr_1fr_100px_100px_80px_100px]",
          "hover:bg-surface-overlay/60",
          showCandidates && "bg-surface-overlay/40",
          decision === "accepted" && "bg-success/5",
          decision === "rejected" && "bg-critical/5 opacity-60",
        )}
      >
        {/* Expand toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setShowCandidates((v) => !v)}
            className="flex items-center"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-text-ghost transition-transform",
                showCandidates && "rotate-90 text-success",
              )}
            />
          </button>
        </div>

        {/* Source term */}
        <div className="flex items-center min-w-0">
          <div>
            <div className="text-sm font-medium text-text-primary truncate">
              {result.source_term}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-text-ghost">
                {t("vocabulary.mappingAssistant.results.candidateCount", { count: result.candidates.length })}
              </span>
              {override && (
                <span className="text-[10px] text-accent font-medium">
                  {t("vocabulary.mappingAssistant.results.overridden")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Best match (or override) */}
        <div className="flex items-center min-w-0">
          {display ? (
            <div className="min-w-0">
              <div className="text-sm text-text-secondary truncate">{display.concept_name}</div>
              <div className="text-[10px] text-text-ghost font-mono mt-0.5">
                #{display.concept_id}
              </div>
            </div>
          ) : (
            <span className="text-text-ghost text-sm italic">
              {t("vocabulary.mappingAssistant.results.noMatchFound")}
            </span>
          )}
        </div>

        {/* Confidence */}
        <div className="flex items-center">
          {display ? (
            <ConfidenceBar value={display.confidence} />
          ) : (
            <span className="text-text-ghost text-xs">{t("vocabulary.mappingAssistant.labels.noValue")}</span>
          )}
        </div>

        {/* Match type */}
        <div className="flex items-center">
          {display ? (
            <MatchTypeBadge type={display.match_type} />
          ) : (
            <span className="text-text-ghost text-xs">{t("vocabulary.mappingAssistant.labels.noValue")}</span>
          )}
        </div>

        {/* Vocabulary */}
        <div className="flex items-center">
          {display ? (
            <span className="text-xs text-text-muted">{display.vocabulary_id}</span>
          ) : (
            <span className="text-text-ghost text-xs">{t("vocabulary.mappingAssistant.labels.noValue")}</span>
          )}
        </div>

        {/* Actions: accept, reject, disambiguate */}
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title={t("vocabulary.mappingAssistant.actions.acceptMapping")}
            onClick={() =>
              onDecide(result.source_term, decision === "accepted" ? null : "accepted")
            }
            className={cn(
              "h-7 w-7 rounded-md border flex items-center justify-center transition-colors",
              decision === "accepted"
                ? "bg-success/20 border-success/40 text-success"
                : "border-border-default text-text-ghost hover:border-success/40 hover:text-success hover:bg-success/10",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={t("vocabulary.mappingAssistant.actions.rejectMapping")}
            onClick={() =>
              onDecide(result.source_term, decision === "rejected" ? null : "rejected")
            }
            className={cn(
              "h-7 w-7 rounded-md border flex items-center justify-center transition-colors",
              decision === "rejected"
                ? "bg-critical/20 border-critical/40 text-critical"
                : "border-border-default text-text-ghost hover:border-critical/40 hover:text-critical hover:bg-critical/10",
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={t("vocabulary.mappingAssistant.actions.disambiguateTitle")}
            onClick={() => onOpenDrawer(result)}
            className="h-7 w-7 rounded-md border border-border-default flex items-center justify-center text-text-ghost hover:border-accent/40 hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Inline candidate swap panel */}
      {showCandidates && (
        <div className="px-6 pb-4 pt-2 bg-surface-base border-t border-border-subtle space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-text-ghost mb-2 flex items-center gap-2">
            <Repeat className="h-3 w-3" />
            {t("vocabulary.mappingAssistant.results.selectOverride")}
          </div>
          {result.candidates.length === 0 && (
            <div className="text-sm text-text-ghost italic py-2">
              {t("vocabulary.mappingAssistant.results.noAdditionalCandidates")}
            </div>
          )}
          {result.candidates.map((c) => {
            const isSelected = override?.concept_id === c.concept_id;
            return (
              <button
                key={c.concept_id}
                type="button"
                onClick={() => onSwapCandidate(result.source_term, c)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-success/10 border-success/30"
                    : "bg-surface-raised border-border-subtle hover:border-surface-highlight",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{c.concept_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-text-ghost font-mono">#{c.concept_id}</span>
                    <span className="text-[10px] text-text-ghost">{c.vocabulary_id}</span>
                    <span className="text-[10px] text-text-ghost">{c.domain_id}</span>
                  </div>
                </div>
                <MatchTypeBadge type={c.match_type} />
                <ConfidenceBar value={c.confidence} />
                {isSelected && (
                  <Check className="h-4 w-4 text-success shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CSV export helper ──────────────────────────────────────────────────────

function exportCsv(
  results: MappingResult[],
  decisions: Map<string, Decision>,
  overrides: Map<string, MappingCandidate>,
) {
  const header = "source_term,concept_id,concept_name,vocabulary_id,domain_id,confidence,match_type,decision";
  const rows = results.map((r) => {
    const b = overrides.get(r.source_term) ?? r.best_match;
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
  const { t } = useTranslation("app");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input state
  const [termsText, setTermsText] = useState("");
  const [targetVocabs, setTargetVocabs] = useState<string[]>([]);
  const [targetDomains, setTargetDomains] = useState<string[]>([]);
  const [inputCollapsed, setInputCollapsed] = useState(false);

  // Results + decisions + overrides
  const [results, setResults] = useState<MappingResult[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [overrides, setOverrides] = useState<Map<string, MappingCandidate>>(new Map());

  // Disambiguation drawer state
  const [drawerResult, setDrawerResult] = useState<MappingResult | null>(null);

  // Mapping mutation
  const mapMutation = useMutation({
    mutationFn: (params: MapTermsParams) => mapTerms(params),
    onSuccess: (data) => {
      setResults(data);
      setDecisions(new Map());
      setOverrides(new Map());
      setInputCollapsed(true);
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
        setInputCollapsed(false);
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

  const handleOverrideCandidate = useCallback((sourceTerm: string, candidate: MappingCandidate) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(sourceTerm, candidate);
      return next;
    });
  }, []);

  // Auto-accept high confidence
  const handleAutoAccept = useCallback(() => {
    const threshold = 0.9;
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const r of results) {
        const display = overrides.get(r.source_term) ?? r.best_match;
        if (display && display.confidence >= threshold && next.get(r.source_term) !== "accepted") {
          next.set(r.source_term, "accepted");
        }
      }
      return next;
    });
    // count is computed before setDecisions finishes, recalculate
    const eligibleCount = results.filter((r) => {
      const display = overrides.get(r.source_term) ?? r.best_match;
      return display && display.confidence >= threshold && decisions.get(r.source_term) !== "accepted";
    }).length;
    toast.success(t("vocabulary.mappingAssistant.toasts.autoAccepted", { count: eligibleCount }));
  }, [results, overrides, decisions, t]);

  // ── Save / Load state ─────────────────────────────────────────────────────
  const [projectNameInput, setProjectNameInput] = useState("");
  const [showProjectNameInput, setShowProjectNameInput] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Build save-mapping entries from accepted results (using overrides)
  const buildSaveMappingEntries = useCallback(
    (res: MappingResult[], dec: Map<string, Decision>, ovr: Map<string, MappingCandidate>): SaveMappingEntry[] =>
      res
        .filter((r) => dec.get(r.source_term) === "accepted" && (ovr.get(r.source_term) ?? r.best_match) !== null)
        .map((r) => {
          const mapping = ovr.get(r.source_term) ?? r.best_match!;
          return {
            source_code: r.source_term.slice(0, 50),
            source_code_description: r.source_term,
            target_concept_id: mapping.concept_id,
            target_vocabulary_id: mapping.vocabulary_id,
          };
        }),
    [],
  );

  const saveMappingsMutation = useMutation({
    mutationFn: (entries: SaveMappingEntry[]) => saveMappings(entries),
    onSuccess: (data) => {
      toast.success(t("vocabulary.mappingAssistant.toasts.savedMappings", { count: data.saved }));
    },
    onError: () => {
      toast.error(t("vocabulary.mappingAssistant.toasts.saveMappingsFailed"));
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
      toast.success(t("vocabulary.mappingAssistant.toasts.projectSaved", { name: data.name }));
      setShowProjectNameInput(false);
      setProjectNameInput("");
    },
    onError: () => {
      toast.error(t("vocabulary.mappingAssistant.toasts.saveProjectFailed"));
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
        setOverrides(new Map());
        setTargetVocabs(project.target_vocabularies ?? []);
        setTargetDomains(project.target_domains ?? []);
        setTermsText(project.source_terms.join("\n"));
        setShowProjectDropdown(false);
        setInputCollapsed(true);
        toast.success(t("vocabulary.mappingAssistant.toasts.projectLoaded", { name: project.name }));
      } catch {
        toast.error(t("vocabulary.mappingAssistant.toasts.loadProjectFailed"));
      }
    },
    [setResults, setDecisions, setTargetVocabs, setTargetDomains, setTermsText, t],
  );

  // Summary stats
  const totalMapped = results.filter((r) => (overrides.get(r.source_term) ?? r.best_match) !== null).length;
  const highConf = results.filter((r) => {
    const d = overrides.get(r.source_term) ?? r.best_match;
    return d !== null && d.confidence >= 0.8;
  }).length;
  const needReview = results.filter((r) => {
    const d = overrides.get(r.source_term) ?? r.best_match;
    return d !== null && d.confidence < 0.8;
  }).length;
  const noMatch = results.filter((r) => (overrides.get(r.source_term) ?? r.best_match) === null).length;
  const accepted = Array.from(decisions.values()).filter((d) => d === "accepted").length;
  const vocabularyOptions = VOCABULARY_OPTIONS.map((value) => ({
    value,
    label: t(`vocabulary.mappingAssistant.vocabularies.${value}`, { defaultValue: value }),
  }));
  const domainOptions = DOMAIN_OPTIONS.map((value) => ({
    value,
    label: t(`vocabulary.mappingAssistant.domains.${value}`, { defaultValue: value }),
  }));

  return (
    <div className="space-y-6 pb-20">
      {/* ── Disambiguation drawer ── */}
      <DisambiguationDrawer
        result={drawerResult}
        onClose={() => setDrawerResult(null)}
        onSelectCandidate={(term, candidate) => {
          handleOverrideCandidate(term, candidate);
          handleDecide(term, "accepted");
        }}
      />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
            <ArrowLeftRight className="h-5 w-5 text-critical" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">
                {t("vocabulary.mappingAssistant.title")}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-critical">
                <Sparkles className="h-3 w-3" />
                {t("vocabulary.mappingAssistant.poweredBy")}
              </span>
            </div>
            <p className="text-sm text-text-muted mt-0.5">
              {t("vocabulary.mappingAssistant.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Input section ── */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5 space-y-4">
        {/* Compact summary chip when collapsed */}
        {results.length > 0 && inputCollapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5 text-critical" />
                <span className="text-sm font-medium text-critical">
                  {t("vocabulary.mappingAssistant.input.termsMapped", { count: parsedTerms.length })}
                </span>
              </div>
              {/* Compact filters */}
              {(targetVocabs.length > 0 || targetDomains.length > 0) && (
                <div className="flex items-center gap-2 text-[10px] text-text-ghost">
                  {targetVocabs.length > 0 && (
                    <span className="rounded border border-border-default px-2 py-0.5">
                      {targetVocabs.join(", ")}
                    </span>
                  )}
                  {targetDomains.length > 0 && (
                    <span className="rounded border border-border-default px-2 py-0.5">
                      {targetDomains.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInputCollapsed(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-transparent px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {t("vocabulary.mappingAssistant.input.editTerms")}
            </button>
          </div>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-widest text-text-ghost">
              {t("vocabulary.mappingAssistant.input.sourceTerms")}
            </div>

            {/* Textarea + upload */}
            <div className="space-y-2">
              <textarea
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                placeholder={t("vocabulary.mappingAssistant.input.termsPlaceholder")}
                rows={7}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none font-mono transition-colors"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-transparent px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("vocabulary.mappingAssistant.actions.uploadCsv")}
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-transparent px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {t("vocabulary.mappingAssistant.actions.loadProject")}
                  </button>
                  {showProjectDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowProjectDropdown(false)}
                      />
                      <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border-default bg-surface-raised shadow-xl py-1 max-h-64 overflow-y-auto">
                        {projectsQuery.isLoading && (
                          <div className="flex items-center gap-2 px-3 py-3 text-xs text-text-ghost">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {t("vocabulary.mappingAssistant.projects.loading")}
                          </div>
                        )}
                        {projectsQuery.isError && (
                          <div className="px-3 py-3 text-xs text-critical">
                            {t("vocabulary.mappingAssistant.projects.loadFailed")}
                          </div>
                        )}
                        {projectsQuery.data && projectsQuery.data.length === 0 && (
                          <div className="px-3 py-3 text-xs text-text-ghost">
                            {t("vocabulary.mappingAssistant.projects.empty")}
                          </div>
                        )}
                        {projectsQuery.data?.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleLoadProject(p.id)}
                            className="w-full text-left px-3 py-2 hover:bg-surface-overlay transition-colors"
                          >
                            <div className="text-sm text-text-primary truncate">{p.name}</div>
                            <div className="text-[10px] text-text-ghost mt-0.5">
                              {t("vocabulary.mappingAssistant.projects.projectMeta", {
                                count: p.source_terms.length,
                                date: formatDate(p.updated_at),
                              })}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {parsedTerms.length > 0 && (
                  <span className="text-xs text-text-ghost">
                    {t("vocabulary.mappingAssistant.input.termsEntered", { count: parsedTerms.length })}
                  </span>
                )}
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-text-ghost">
                {t("vocabulary.mappingAssistant.filters.targetVocabulary")}
              </div>
              <MultiSelect
                label={t("vocabulary.mappingAssistant.filters.allVocabularies")}
                options={vocabularyOptions}
                selected={targetVocabs}
                onChange={setTargetVocabs}
              />
              <div className="flex items-center gap-2 text-xs text-text-ghost">
                {t("vocabulary.mappingAssistant.filters.targetDomain")}
              </div>
              <MultiSelect
                label={t("vocabulary.mappingAssistant.filters.allDomains")}
                options={domainOptions}
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
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {mapMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowLeftRight className="h-4 w-4" />
                )}
                {mapMutation.isPending
                  ? t("vocabulary.mappingAssistant.actions.mapping")
                  : t("vocabulary.mappingAssistant.actions.mapTerms")}
              </button>

              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setResults([]);
                    setDecisions(new Map());
                    setOverrides(new Map());
                    setInputCollapsed(false);
                    mapMutation.reset();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-text-ghost hover:text-text-secondary transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t("vocabulary.mappingAssistant.actions.clearResults")}
                </button>
              )}
            </div>
          </>
        )}

        {/* Error */}
        {mapMutation.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {t("vocabulary.mappingAssistant.errors.mappingFailed")}
            </span>
          </div>
        )}
      </div>

      {/* ── Results section ── */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Progress indicator during mapping */}
          {mapMutation.isPending && (
            <div className="space-y-2">
              <div className="h-1 w-full rounded-full bg-surface-elevated overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#9B1B30] via-[#C9A227] to-[#2DD4BF] rounded-full animate-pulse" style={{ width: "100%", animation: "pulse 1.5s ease-in-out infinite" }} />
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("vocabulary.mappingAssistant.progress.mappingTerms", { count: parsedTerms.length })}
              </div>
            </div>
          )}

          {/* Summary stats bar with auto-accept */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 flex-1 min-w-0">
              <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="h-4 w-4 text-success" />
                </div>
                <div>
                  <div className="text-xl font-bold text-text-primary">{formatNumber(totalMapped)}</div>
                  <div className="text-[11px] text-text-muted">{t("vocabulary.mappingAssistant.metrics.termsMapped")}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
                  <Check className="h-4 w-4 text-success" />
                </div>
                <div>
                  <div className="text-xl font-bold text-text-primary">{formatNumber(highConf)}</div>
                  <div className="text-[11px] text-text-muted">{t("vocabulary.mappingAssistant.metrics.highConfidence")}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-xl font-bold text-text-primary">{formatNumber(needReview)}</div>
                  <div className="text-[11px] text-text-muted">{t("vocabulary.mappingAssistant.metrics.needReview")}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <X className="h-4 w-4 text-critical" />
                </div>
                <div>
                  <div className="text-xl font-bold text-text-primary">{formatNumber(noMatch)}</div>
                  <div className="text-[11px] text-text-muted">{t("vocabulary.mappingAssistant.metrics.noMatch")}</div>
                </div>
              </div>
            </div>

            {/* Auto-accept button */}
            <button
              type="button"
              onClick={handleAutoAccept}
              className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success hover:bg-success/20 transition-colors shrink-0"
            >
              <Zap className="h-4 w-4" />
              {t("vocabulary.mappingAssistant.actions.acceptAllThreshold")}
            </button>
          </div>

          {/* Results table */}
          <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
            {/* Table header */}
            <div className="grid gap-3 px-4 py-3 border-b border-border-default text-[10px] font-semibold uppercase tracking-wider text-text-ghost grid-cols-[28px_1fr_1fr_100px_100px_80px_100px]">
              <div />
              <div>{t("vocabulary.mappingAssistant.table.sourceTerm")}</div>
              <div>{t("vocabulary.mappingAssistant.table.bestMatch")}</div>
              <div>{t("vocabulary.mappingAssistant.table.confidence")}</div>
              <div>{t("vocabulary.mappingAssistant.table.matchType")}</div>
              <div>{t("vocabulary.mappingAssistant.table.vocabulary")}</div>
              <div className="text-right">{t("vocabulary.mappingAssistant.table.actions")}</div>
            </div>

            {results.map((result, i) => (
              <ResultRow
                key={result.source_term + String(i)}
                result={result}
                decision={decisions.get(result.source_term) ?? null}
                override={overrides.get(result.source_term)}
                onDecide={handleDecide}
                onOpenDrawer={setDrawerResult}
                onSwapCandidate={handleOverrideCandidate}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Progress indicator when mapping (no results yet) ── */}
      {mapMutation.isPending && results.length === 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-3">
          <div className="h-1 w-full rounded-full bg-surface-elevated overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#9B1B30] via-[#C9A227] to-[#2DD4BF] rounded-full"
              style={{
                width: "100%",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            {t("vocabulary.mappingAssistant.progress.mappingTerms", { count: parsedTerms.length })}
          </div>
        </div>
      )}

      {/* ── Sticky action bar ── */}
      {results.length > 0 && (
        <div className="sticky bottom-0 z-30 -mx-6 px-6 py-3 border-t border-border-default bg-surface-base/90 backdrop-blur-md flex items-center justify-between gap-4">
          {/* Stats summary */}
          <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
            <span className="text-success">{t("vocabulary.mappingAssistant.summary.mapped", { count: totalMapped })}</span>
            <span className="text-text-ghost">{t("vocabulary.mappingAssistant.labels.separator")}</span>
            <span>{t("vocabulary.mappingAssistant.summary.high", { count: highConf })}</span>
            <span className="text-text-ghost">{t("vocabulary.mappingAssistant.labels.separator")}</span>
            <span className="text-accent">{t("vocabulary.mappingAssistant.summary.review", { count: needReview })}</span>
            <span className="text-text-ghost">{t("vocabulary.mappingAssistant.labels.separator")}</span>
            <span className="text-critical">{t("vocabulary.mappingAssistant.summary.noMatch", { count: noMatch })}</span>
            <span className="text-text-ghost">{t("vocabulary.mappingAssistant.labels.separator")}</span>
            <span className="text-success font-medium">{t("vocabulary.mappingAssistant.summary.accepted", { count: accepted })}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={accepted === 0 || saveMappingsMutation.isPending}
              onClick={() => {
                const entries = buildSaveMappingEntries(results, decisions, overrides);
                if (entries.length > 0) saveMappingsMutation.mutate(entries);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saveMappingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {t("vocabulary.mappingAssistant.actions.saveToVocabulary")}
            </button>

            {!showProjectNameInput ? (
              <button
                type="button"
                onClick={() => setShowProjectNameInput(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
              >
                <Save className="h-4 w-4" />
                {t("vocabulary.mappingAssistant.actions.saveProject")}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  placeholder={t("vocabulary.mappingAssistant.projects.namePlaceholder")}
                  className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 w-48 transition-colors"
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className="text-text-ghost hover:text-text-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => exportCsv(results, decisions, overrides)}
              className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("vocabulary.mappingAssistant.actions.exportCsv")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
