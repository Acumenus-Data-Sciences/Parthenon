import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Library,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  CheckCircle2,
  Loader2,
  AlertCircle,
  BookOpen,
  Tag,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchPhenotypes,
  fetchDomains,
  fetchStats,
  importPhenotype,
  type PhenotypeEntry,
} from "../api";
import {
  getPhenotypeDomainLabel,
  getPhenotypeSeverityLabel,
} from "../lib/i18n";

// ── Domain colour palette (cycles through teal/gold/crimson/violet/slate) ─
const DOMAIN_COLORS: Record<string, string> = {
  Condition: "bg-success/15 text-success border-success/30",
  Drug: "bg-accent/15 text-accent border-accent/30",
  Measurement: "bg-primary/15 text-critical border-primary/30",
  Procedure: "bg-domain-observation/15 text-domain-observation border-domain-observation/30",
  Observation: "bg-info/15 text-info border-info/30",
  Device: "bg-success/15 text-success border-success/30",
};

function domainColor(domain: string | null): string {
  if (!domain) return "bg-surface-overlay text-text-ghost border-border-default";
  return (
    DOMAIN_COLORS[domain] ?? "bg-surface-overlay text-text-muted border-border-default"
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  acute: "bg-primary/15 text-critical border-primary/30",
  chronic: "bg-accent/15 text-accent border-accent/30",
  subacute: "bg-info/15 text-info border-info/30",
};

function severityColor(severity: string | null): string {
  if (!severity) return "";
  return (
    SEVERITY_COLORS[severity.toLowerCase()] ??
    "bg-surface-overlay text-text-muted border-border-default"
  );
}

// ── Stats card ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-border-default bg-surface-raised px-5 py-4 flex items-center gap-4 transition-colors hover:border-surface-highlight"
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          accent,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-text-primary">{value}</div>
        <div className="text-xs text-text-muted mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── Tag pill ───────────────────────────────────────────────────────────────
function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-surface-overlay text-text-muted border border-border-default">
      {tag}
    </span>
  );
}

// ── Row expand panel ──────────────────────────────────────────────────────
function ExpandedPanel({ entry }: { entry: PhenotypeEntry }) {
  const { t } = useTranslation("app");

  return (
    <div className="px-5 pb-5 pt-2 bg-surface-base border-t border-border-subtle space-y-3">
      {entry.description && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-ghost mb-1">
            {t("phenotypeLibrary.detail.description")}
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {entry.description}
          </p>
        </div>
      )}
      {entry.logic_description && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-ghost mb-1">
            {t("phenotypeLibrary.detail.logic")}
          </div>
          <p className="text-sm text-text-muted leading-relaxed font-mono">
            {entry.logic_description}
          </p>
        </div>
      )}
      {!entry.description && !entry.logic_description && (
        <p className="text-sm text-text-ghost italic">
          {t("phenotypeLibrary.detail.noAdditionalDetails")}
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function PhenotypeLibraryPage() {
  const { t, i18n } = useTranslation("app");
  const queryClient = useQueryClient();

  // Filter / pagination state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [domain, setDomain] = useState<string>("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [domainOpen, setDomainOpen] = useState(false);
  const perPage = 25;

  // Debounce search — batched state update avoids cascading render warning
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      // Both setters fire in the same React batch
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  // (page is reset inline when domain or debounced search changes)

  // Queries
  const statsQuery = useQuery({
    queryKey: ["phenotype-library", "stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });

  const domainsQuery = useQuery({
    queryKey: ["phenotype-library", "domains"],
    queryFn: fetchDomains,
    staleTime: 300_000,
  });

  const listQuery = useQuery({
    queryKey: [
      "phenotype-library",
      "list",
      debouncedSearch,
      domain,
      page,
      perPage,
    ],
    queryFn: () =>
      fetchPhenotypes({
        search: debouncedSearch || undefined,
        domain: domain || undefined,
        page,
        per_page: perPage,
      }),
    placeholderData: (prev) => prev,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: importPhenotype,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phenotype-library"] });
    },
  });

  const stats = statsQuery.data;
  const phenotypes = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const domains = domainsQuery.data ?? [];

  const handleImport = (e: React.MouseEvent, cohortId: number) => {
    e.stopPropagation();
    importMutation.mutate(cohortId);
  };

  const toggleExpand = (cohortId: number) => {
    setExpandedId((prev) => (prev === cohortId ? null : cohortId));
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15">
            <Library className="h-5 w-5 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {t("phenotypeLibrary.page.title")}
            </h1>
            <p className="text-sm text-text-muted">
              {t("phenotypeLibrary.page.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("phenotypeLibrary.stats.totalPhenotypes")}
          value={stats?.total ?? "—"}
          icon={BookOpen}
          accent="bg-success/15 text-success"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
        <StatCard
          label={t("phenotypeLibrary.stats.withExpression")}
          value={stats?.with_expression ?? "—"}
          icon={Layers}
          accent="bg-accent/15 text-accent"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
        <StatCard
          label={t("phenotypeLibrary.stats.domainsCovered")}
          value={stats?.domains ?? "—"}
          icon={Filter}
          accent="bg-domain-observation/15 text-domain-observation"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
        <StatCard
          label={t("phenotypeLibrary.stats.imported")}
          value={stats?.imported ?? "—"}
          icon={CheckCircle2}
          accent="bg-primary/15 text-critical"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-ghost" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("phenotypeLibrary.page.searchPlaceholder")}
            className="w-full rounded-lg border border-border-default bg-surface-raised pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success/30 transition-colors"
          />
        </div>

        {/* Domain filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDomainOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors min-w-[180px] justify-between",
              domain
                ? "border-success/30 bg-success/10 text-success"
                : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary",
            )}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {domain
                ? getPhenotypeDomainLabel(t, domain)
                : t("phenotypeLibrary.page.allDomains")}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                domainOpen && "rotate-180",
              )}
            />
          </button>

          {domainOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border-default bg-surface-raised shadow-xl py-1">
              <button
                type="button"
                onClick={() => {
                  setDomain("");
                  setPage(1);
                  setDomainOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-overlay",
                  !domain ? "text-success" : "text-text-secondary",
                )}
              >
                {t("phenotypeLibrary.page.allDomains")}
              </button>
              {domains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDomain(d);
                    setPage(1);
                    setDomainOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-overlay",
                    domain === d ? "text-success" : "text-text-secondary",
                  )}
                  >
                  {getPhenotypeDomainLabel(t, d)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Result count + loading indicator ── */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-ghost">
          {listQuery.isFetching ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("phenotypeLibrary.page.loading")}
            </span>
          ) : (
            <>
              {t("phenotypeLibrary.page.resultCount", {
                count: total,
                displayCount: total.toLocaleString(i18n.resolvedLanguage),
              })}
              {(debouncedSearch || domain) &&
                ` ${t("phenotypeLibrary.page.matchingFilters")}`}
            </>
          )}
        </span>

        {(debouncedSearch || domain) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDomain("");
              setPage(1);
            }}
            className="text-xs text-text-ghost hover:text-text-secondary transition-colors"
          >
            {t("phenotypeLibrary.page.clearFilters")}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_120px_100px_1fr_140px] gap-4 border-b border-border-default px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          <div>{t("phenotypeLibrary.table.headers.name")}</div>
          <div>{t("phenotypeLibrary.table.headers.domain")}</div>
          <div>{t("phenotypeLibrary.table.headers.severity")}</div>
          <div>{t("phenotypeLibrary.table.headers.tags")}</div>
          <div className="text-right">
            {t("phenotypeLibrary.table.headers.action")}
          </div>
        </div>

        {/* Error state */}
        {listQuery.isError && (
          <div className="flex items-center justify-center gap-2 py-16 text-critical">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">
              {t("phenotypeLibrary.table.failedToLoad")}
            </span>
          </div>
        )}

        {/* Empty state */}
        {!listQuery.isError && !listQuery.isFetching && phenotypes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-ghost">
            <Library className="h-10 w-10 opacity-30" />
            <span className="text-sm">{t("phenotypeLibrary.table.empty")}</span>
            {(debouncedSearch || domain) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDomain("");
                  setPage(1);
                }}
                className="text-xs text-success hover:underline"
              >
                {t("phenotypeLibrary.page.clearFilters")}
              </button>
            )}
          </div>
        )}

        {/* Rows */}
        {phenotypes.map((entry) => {
          const isExpanded = expandedId === entry.cohort_id;
          const isImporting =
            importMutation.isPending &&
            importMutation.variables === entry.cohort_id;

          return (
            <div key={entry.cohort_id} className="border-b border-border-subtle last:border-b-0">
              {/* Main row */}
              <div
                className={cn(
                  "grid grid-cols-[1fr_120px_100px_1fr_140px] gap-4 px-5 py-3.5 transition-colors cursor-pointer",
                  "hover:bg-surface-overlay/60",
                  isExpanded && "bg-surface-overlay/40",
                )}
                onClick={() => toggleExpand(entry.cohort_id)}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-text-ghost transition-transform",
                      isExpanded && "rotate-90 text-success",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {entry.cohort_name}
                    </div>
                    <div className="text-[10px] text-text-ghost font-mono mt-0.5">
                      #{entry.cohort_id}
                    </div>
                  </div>
                </div>

                {/* Domain */}
                <div className="flex items-center">
                  {entry.domain ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium border",
                        domainColor(entry.domain),
                      )}
                    >
                      {getPhenotypeDomainLabel(t, entry.domain)}
                    </span>
                  ) : (
                    <span className="text-text-ghost text-xs">—</span>
                  )}
                </div>

                {/* Severity */}
                <div className="flex items-center">
                  {entry.severity ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium border capitalize",
                        severityColor(entry.severity),
                      )}
                    >
                      {getPhenotypeSeverityLabel(t, entry.severity)}
                    </span>
                  ) : (
                    <span className="text-text-ghost text-xs">—</span>
                  )}
                </div>

                {/* Tags */}
                <div className="flex items-center flex-wrap gap-1">
                  {entry.tags && entry.tags.length > 0 ? (
                    <>
                      {entry.tags.slice(0, 3).map((tag) => (
                        <TagPill key={tag} tag={tag} />
                      ))}
                      {entry.tags.length > 3 && (
                        <span className="text-[10px] text-text-ghost">
                          +{entry.tags.length - 3}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-text-ghost">
                      <Tag className="h-3 w-3" />
                      {t("phenotypeLibrary.table.noTags")}
                    </span>
                  )}
                </div>

                {/* Action */}
                <div className="flex items-center justify-end gap-2">
                  {entry.is_imported && entry.imported_cohort_id ? (
                    <Link
                      to={`/cohort-definitions/${entry.imported_cohort_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("phenotypeLibrary.actions.imported")}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        !entry.expression_json ||
                        isImporting ||
                        importMutation.isPending
                      }
                      onClick={(e) => handleImport(e, entry.cohort_id)}
                      title={
                        !entry.expression_json
                          ? t("phenotypeLibrary.actions.noExpressionAvailable")
                          : t("phenotypeLibrary.actions.importAsCohortDefinition")
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        entry.expression_json
                          ? "border-primary/40 bg-primary/10 text-critical hover:bg-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                          : "border-border-default bg-transparent text-text-ghost cursor-not-allowed opacity-50",
                      )}
                    >
                      {isImporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {isImporting
                        ? t("phenotypeLibrary.actions.importing")
                        : t("phenotypeLibrary.actions.import")}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && <ExpandedPanel entry={entry} />}
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-ghost">
            {t("phenotypeLibrary.pagination.pageOf", { page, totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("phenotypeLibrary.pagination.previous")}
            </button>

            {/* Page number pills */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-sm font-medium transition-colors",
                      pageNum === page
                        ? "bg-success/20 text-success border border-success/30"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-overlay",
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("phenotypeLibrary.pagination.next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
