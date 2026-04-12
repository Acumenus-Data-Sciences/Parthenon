import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  Users,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Search,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortMembers } from "@/features/profiles/hooks/useProfiles";
import type { CohortMember } from "@/features/profiles/types/profile";
import type { GenerationSource } from "../types/cohortExpression";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SortKey = keyof Pick<
  CohortMember,
  "subject_id" | "gender" | "year_of_birth" | "cohort_start_date" | "cohort_end_date"
>;
type SortDir = "asc" | "desc";

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (sortKey !== col) return <ArrowUpDown size={11} className="opacity-30" />;
  return sortDir === "asc" ? (
    <ArrowUp size={11} className="text-success" />
  ) : (
    <ArrowDown size={11} className="text-success" />
  );
}

interface CohortPatientListPanelProps {
  definitionId: number | null;
  generationSources?: GenerationSource[];
}

export function CohortPatientListPanel({
  definitionId,
  generationSources,
}: CohortPatientListPanelProps) {
  const navigate = useNavigate();

  // Auto-select if only one source has been generated
  const completedSources = useMemo(
    () => (generationSources ?? []).filter((s) => s.person_count != null && s.person_count > 0),
    [generationSources],
  );
  const [sourceId, setSourceId] = useState<number | null>(
    completedSources.length === 1 ? completedSources[0].source_id : null,
  );
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("subject_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Client-side filters
  const [filterGender, setFilterGender] = useState("");
  const [filterBirthYearMin, setFilterBirthYearMin] = useState("");
  const [filterBirthYearMax, setFilterBirthYearMax] = useState("");
  const [searchId, setSearchId] = useState("");

  const {
    data: membersData,
    isLoading: loadingMembers,
    error: membersError,
  } = useCohortMembers(sourceId, definitionId, page);

  const rawMembers = membersData?.data ?? [];
  const totalPages = membersData?.meta?.last_page ?? 1;
  const total = membersData?.meta?.total ?? 0;
  const perPage = membersData?.meta?.per_page ?? 15;

  // Apply client-side sort + filter to current page
  const members = useMemo(() => {
    let data = [...rawMembers];

    if (searchId.trim()) {
      data = data.filter((m) =>
        String(m.subject_id).includes(searchId.trim()),
      );
    }

    if (filterGender) {
      data = data.filter(
        (m) => (m.gender ?? "").toLowerCase() === filterGender.toLowerCase(),
      );
    }

    const minY = filterBirthYearMin ? Number(filterBirthYearMin) : null;
    const maxY = filterBirthYearMax ? Number(filterBirthYearMax) : null;
    if (minY != null) data = data.filter((m) => (m.year_of_birth ?? 0) >= minY);
    if (maxY != null) data = data.filter((m) => (m.year_of_birth ?? 9999) <= maxY);

    data.sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return data;
  }, [rawMembers, searchId, filterGender, filterBirthYearMin, filterBirthYearMax, sortKey, sortDir]);

  // Summary stats for the cohort page
  const stats = useMemo(() => {
    if (rawMembers.length === 0) return null;
    const genderCounts: Record<string, number> = {};
    for (const m of rawMembers) {
      const g = m.gender ?? "Unknown";
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
    }
    const yearVals = rawMembers.map((m) => m.year_of_birth ?? 0).filter(Boolean);
    const meanYear =
      yearVals.length > 0
        ? Math.round(yearVals.reduce((s, v) => s + v, 0) / yearVals.length)
        : null;
    return { genderCounts, meanYear, totalPage: rawMembers.length };
  }, [rawMembers]);

  const uniqueGenders = useMemo(
    () => [...new Set(rawMembers.map((m) => m.gender ?? "Unknown").filter(Boolean))],
    [rawMembers],
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleSelectPerson = (personSourceId: number, personId: number) => {
    navigate(`/profiles/${personId}?sourceId=${personSourceId}`, {
      state: { from: `/cohort-definitions/${definitionId}`, fromLabel: "Cohort Definition" },
    });
  };

  const handleExportCsv = useCallback(() => {
    if (members.length === 0) return;
    const headers = [
      "person_id",
      "gender",
      "year_of_birth",
      "cohort_start_date",
      "cohort_end_date",
    ];
    const rows = members.map((m) =>
      [
        m.subject_id,
        m.gender ?? "",
        m.year_of_birth ?? "",
        m.cohort_start_date,
        m.cohort_end_date,
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cohort-${definitionId}-members-page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [members, page, definitionId]);

  // No generation sources at all
  if (!generationSources || generationSources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <AlertCircle size={28} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted mb-1">No cohort generated yet</p>
        <p className="text-xs text-text-ghost">
          Generate this cohort on a data source first to view patient members.
        </p>
      </div>
    );
  }

  // No completed generations with patients
  if (completedSources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <AlertCircle size={28} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted mb-1">No patients in cohort</p>
        <p className="text-xs text-text-ghost">
          The cohort has been generated but contains 0 patients on all sources.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source selector (only if multiple sources) */}
      {completedSources.length > 1 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Data Source
          </label>
          <div className="relative max-w-xs">
            <Database
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <select
              value={sourceId ?? ""}
              onChange={(e) => {
                setSourceId(Number(e.target.value) || null);
                setPage(1);
              }}
              className={cn(
                "w-full appearance-none rounded-lg border border-border-default bg-surface-base pl-8 pr-8 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              <option value="">Select a data source...</option>
              {completedSources.map((src) => (
                <option key={src.source_id} value={src.source_id}>
                  {src.source_name ?? src.source_key ?? `Source #${src.source_id}`}
                  {src.person_count != null ? ` (${src.person_count.toLocaleString()} patients)` : ""}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
          </div>
        </div>
      )}

      {/* Single-source info banner */}
      {completedSources.length === 1 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Database size={12} className="text-text-ghost" />
          <span>
            {completedSources[0].source_name ?? completedSources[0].source_key ?? `Source #${completedSources[0].source_id}`}
          </span>
          {completedSources[0].person_count != null && (
            <span className="text-success font-medium">
              {completedSources[0].person_count.toLocaleString()} patients
            </span>
          )}
        </div>
      )}

      {/* Prompt to select source */}
      {!sourceId && completedSources.length > 1 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
          <Users size={24} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted">
            Select a data source above to view cohort members
          </p>
        </div>
      )}

      {/* Members content */}
      {sourceId && (
        <div className="space-y-3">
          {loadingMembers ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          ) : membersError ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-critical text-sm">
                Failed to load cohort members
              </p>
            </div>
          ) : rawMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
              <Users size={24} className="text-text-ghost mb-3" />
              <p className="text-sm text-text-muted">
                No members found in this cohort
              </p>
            </div>
          ) : (
            <>
              {/* Stats + toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {stats && (
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>
                      <span className="font-semibold text-text-primary">
                        {total.toLocaleString()}
                      </span>{" "}
                      total members
                    </span>
                    {stats.meanYear && (
                      <span>
                        Mean birth year:{" "}
                        <span className="font-semibold text-text-primary">
                          {stats.meanYear}
                        </span>
                      </span>
                    )}
                    {Object.entries(stats.genderCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([g, n]) => (
                        <span key={g}>
                          {g}:{" "}
                          <span className="font-semibold text-text-primary">
                            {((n / stats.totalPage) * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search
                      size={11}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-ghost"
                    />
                    <input
                      type="text"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      placeholder="Filter by ID..."
                      className={cn(
                        "w-36 rounded-md border border-surface-highlight bg-surface-base pl-7 pr-2 py-1.5 text-xs",
                        "text-text-primary placeholder:text-text-ghost",
                        "focus:border-accent focus:outline-none",
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFilters((p) => !p)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-colors",
                      showFilters
                        ? "border-accent text-accent bg-accent/10"
                        : "border-surface-highlight text-text-muted hover:text-text-primary",
                    )}
                  >
                    <SlidersHorizontal size={12} />
                    Filters
                    {(filterGender || filterBirthYearMin || filterBirthYearMax) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={members.length === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-surface-highlight px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-text-ghost transition-colors disabled:opacity-40"
                  >
                    <Download size={12} />
                    CSV
                  </button>
                </div>
              </div>

              {/* Filter row */}
              {showFilters && (
                <div className="flex items-center gap-3 rounded-lg border border-surface-highlight bg-surface-raised px-4 py-3 flex-wrap">
                  <span className="text-xs font-medium text-text-muted">
                    Filters:
                  </span>
                  <div>
                    <label className="text-[10px] text-text-ghost block mb-0.5">
                      Gender
                    </label>
                    <select
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                      className="rounded border border-surface-highlight bg-surface-base px-2 py-1 text-xs text-text-primary focus:outline-none"
                    >
                      <option value="">All</option>
                      {uniqueGenders.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <div>
                      <label className="text-[10px] text-text-ghost block mb-0.5">
                        Birth year &ge;
                      </label>
                      <input
                        type="number"
                        value={filterBirthYearMin}
                        onChange={(e) => setFilterBirthYearMin(e.target.value)}
                        placeholder="e.g. 1950"
                        className="w-24 rounded border border-surface-highlight bg-surface-base px-2 py-1 text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-ghost block mb-0.5">
                        Birth year &le;
                      </label>
                      <input
                        type="number"
                        value={filterBirthYearMax}
                        onChange={(e) => setFilterBirthYearMax(e.target.value)}
                        placeholder="e.g. 2000"
                        className="w-24 rounded border border-surface-highlight bg-surface-base px-2 py-1 text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  {(filterGender || filterBirthYearMin || filterBirthYearMax) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterGender("");
                        setFilterBirthYearMin("");
                        setFilterBirthYearMax("");
                      }}
                      className="text-xs text-critical hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {/* Table */}
              <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-overlay">
                      {(
                        [
                          { key: "subject_id", label: "Person ID" },
                          { key: "gender", label: "Gender" },
                          { key: "year_of_birth", label: "Year of Birth" },
                          { key: "cohort_start_date", label: "Cohort Start" },
                          { key: "cohort_end_date", label: "Cohort End" },
                        ] as { key: SortKey; label: string }[]
                      ).map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-2.5 text-left cursor-pointer select-none group"
                          onClick={() => handleSort(col.key)}
                        >
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted group-hover:text-text-secondary transition-colors">
                            {col.label}
                            <SortIcon
                              col={col.key}
                              sortKey={sortKey}
                              sortDir={sortDir}
                            />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-sm text-text-muted"
                        >
                          No members match the current filters
                        </td>
                      </tr>
                    ) : (
                      members.map((member, i) => (
                        <tr
                          key={member.subject_id}
                          onClick={() =>
                            handleSelectPerson(sourceId!, member.subject_id)
                          }
                          className={cn(
                            "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
                            i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                          )}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-success">
                            {member.subject_id}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary">
                            {member.gender ?? "--"}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary">
                            {member.year_of_birth ?? "--"}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted">
                            {formatDate(member.cohort_start_date)}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted">
                            {formatDate(member.cohort_end_date)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-text-muted">
                    Showing {(page - 1) * perPage + 1} –{" "}
                    {Math.min(page * perPage, total)} of {total.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-text-secondary px-2">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
