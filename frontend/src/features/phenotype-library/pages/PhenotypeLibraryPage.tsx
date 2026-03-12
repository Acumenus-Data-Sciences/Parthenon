import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchPhenotypes,
  fetchDomains,
  fetchStats,
  importPhenotype,
  type PhenotypeEntry,
} from "../api";

// ── Domain colour palette (cycles through teal/gold/crimson/violet/slate) ─
const DOMAIN_COLORS: Record<string, string> = {
  Condition: "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30",
  Drug: "bg-[#C9A227]/15 text-[#C9A227] border-[#C9A227]/30",
  Measurement: "bg-[#9B1B30]/15 text-[#E85A6B] border-[#9B1B30]/30",
  Procedure: "bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30",
  Observation: "bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30",
  Device: "bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30",
};

function domainColor(domain: string | null): string {
  if (!domain) return "bg-[#1C1C20] text-[#5A5650] border-[#232328]";
  return (
    DOMAIN_COLORS[domain] ?? "bg-[#1C1C20] text-[#8A857D] border-[#232328]"
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  acute: "bg-[#9B1B30]/15 text-[#E85A6B] border-[#9B1B30]/30",
  chronic: "bg-[#C9A227]/15 text-[#C9A227] border-[#C9A227]/30",
  subacute: "bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30",
};

function severityColor(severity: string | null): string {
  if (!severity) return "";
  return (
    SEVERITY_COLORS[severity.toLowerCase()] ??
    "bg-[#1C1C20] text-[#8A857D] border-[#232328]"
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
  icon: React.ElementType;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-[#232328] bg-[#151518] px-5 py-4 flex items-center gap-4 transition-colors hover:border-[#3A3A40]"
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
        <div className="text-2xl font-bold text-[#F0EDE8]">{value}</div>
        <div className="text-xs text-[#8A857D] mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── Tag pill ───────────────────────────────────────────────────────────────
function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#1C1C20] text-[#8A857D] border border-[#2A2A30]">
      {tag}
    </span>
  );
}

// ── Row expand panel ──────────────────────────────────────────────────────
function ExpandedPanel({ entry }: { entry: PhenotypeEntry }) {
  return (
    <div className="px-5 pb-5 pt-2 bg-[#0E0E11] border-t border-[#1C1C20] space-y-3">
      {entry.description && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#5A5650] mb-1">
            Description
          </div>
          <p className="text-sm text-[#C5C0B8] leading-relaxed">
            {entry.description}
          </p>
        </div>
      )}
      {entry.logic_description && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#5A5650] mb-1">
            Logic
          </div>
          <p className="text-sm text-[#8A857D] leading-relaxed font-mono">
            {entry.logic_description}
          </p>
        </div>
      )}
      {!entry.description && !entry.logic_description && (
        <p className="text-sm text-[#5A5650] italic">
          No additional details available.
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function PhenotypeLibraryPage() {
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2DD4BF]/15">
            <Library className="h-5 w-5 text-[#2DD4BF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#F0EDE8]">
              Phenotype Library
            </h1>
            <p className="text-sm text-[#8A857D]">
              300+ curated OHDSI phenotype definitions — browse, filter, and
              import in one click
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Phenotypes"
          value={stats?.total ?? "—"}
          icon={BookOpen}
          accent="bg-[#2DD4BF]/15 text-[#2DD4BF]"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
        <StatCard
          label="With Expression"
          value={stats?.with_expression ?? "—"}
          icon={Layers}
          accent="bg-[#C9A227]/15 text-[#C9A227]"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
        <StatCard
          label="Domains Covered"
          value={stats?.domains ?? "—"}
          icon={Filter}
          accent="bg-[#A78BFA]/15 text-[#A78BFA]"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
        <StatCard
          label="Imported"
          value={stats?.imported ?? "—"}
          icon={CheckCircle2}
          accent="bg-[#9B1B30]/15 text-[#E85A6B]"
          onClick={() => { setSearch(""); setDomain(""); setPage(1); }}
        />
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A5650]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phenotypes by name or description…"
            className="w-full rounded-lg border border-[#232328] bg-[#151518] pl-9 pr-4 py-2.5 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30 transition-colors"
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
                ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                : "border-[#232328] bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {domain || "All Domains"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                domainOpen && "rotate-180",
              )}
            />
          </button>

          {domainOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-[#232328] bg-[#151518] shadow-xl py-1">
              <button
                type="button"
                onClick={() => {
                  setDomain("");
                  setPage(1);
                  setDomainOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1C1C20]",
                  !domain ? "text-[#2DD4BF]" : "text-[#C5C0B8]",
                )}
              >
                All Domains
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
                    "w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1C1C20]",
                    domain === d ? "text-[#2DD4BF]" : "text-[#C5C0B8]",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Result count + loading indicator ── */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#5A5650]">
          {listQuery.isFetching ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </span>
          ) : (
            <>
              {total.toLocaleString()} phenotype{total !== 1 ? "s" : ""}
              {(debouncedSearch || domain) && " matching filters"}
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
            className="text-xs text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_120px_100px_1fr_140px] gap-4 border-b border-[#232328] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#5A5650]">
          <div>Name</div>
          <div>Domain</div>
          <div>Severity</div>
          <div>Tags</div>
          <div className="text-right">Action</div>
        </div>

        {/* Error state */}
        {listQuery.isError && (
          <div className="flex items-center justify-center gap-2 py-16 text-[#E85A6B]">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Failed to load phenotype library.</span>
          </div>
        )}

        {/* Empty state */}
        {!listQuery.isError && !listQuery.isFetching && phenotypes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#5A5650]">
            <Library className="h-10 w-10 opacity-30" />
            <span className="text-sm">No phenotypes found.</span>
            {(debouncedSearch || domain) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDomain("");
                  setPage(1);
                }}
                className="text-xs text-[#2DD4BF] hover:underline"
              >
                Clear filters
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
            <div key={entry.cohort_id} className="border-b border-[#1C1C20] last:border-b-0">
              {/* Main row */}
              <div
                className={cn(
                  "grid grid-cols-[1fr_120px_100px_1fr_140px] gap-4 px-5 py-3.5 transition-colors cursor-pointer",
                  "hover:bg-[#1C1C20]/60",
                  isExpanded && "bg-[#1C1C20]/40",
                )}
                onClick={() => toggleExpand(entry.cohort_id)}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-[#5A5650] transition-transform",
                      isExpanded && "rotate-90 text-[#2DD4BF]",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#F0EDE8] truncate">
                      {entry.cohort_name}
                    </div>
                    <div className="text-[10px] text-[#5A5650] font-mono mt-0.5">
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
                      {entry.domain}
                    </span>
                  ) : (
                    <span className="text-[#5A5650] text-xs">—</span>
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
                      {entry.severity}
                    </span>
                  ) : (
                    <span className="text-[#5A5650] text-xs">—</span>
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
                        <span className="text-[10px] text-[#5A5650]">
                          +{entry.tags.length - 3}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-[#5A5650]">
                      <Tag className="h-3 w-3" />
                      no tags
                    </span>
                  )}
                </div>

                {/* Action */}
                <div className="flex items-center justify-end gap-2">
                  {entry.is_imported && entry.imported_cohort_id ? (
                    <Link
                      to={`/cohort-definitions/${entry.imported_cohort_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-1.5 text-xs font-medium text-[#2DD4BF] hover:bg-[#2DD4BF]/20 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Imported
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
                          ? "No expression available"
                          : "Import as cohort definition"
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        entry.expression_json
                          ? "border-[#9B1B30]/40 bg-[#9B1B30]/10 text-[#E85A6B] hover:bg-[#9B1B30]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                          : "border-[#232328] bg-transparent text-[#5A5650] cursor-not-allowed opacity-50",
                      )}
                    >
                      {isImporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {isImporting ? "Importing…" : "Import"}
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
          <span className="text-sm text-[#5A5650]">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
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
                        ? "bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/30"
                        : "text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1C1C20]",
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
              className="inline-flex items-center gap-1 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
