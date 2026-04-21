import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  ChevronDown,
  Users,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate as formatAppDate } from "@/i18n/format";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import { useCohortMembers } from "../hooks/useProfiles";
import { getProfileGenderLabel } from "../lib/i18n";
import { PatientSearchPanel } from "./PatientSearchPanel";
import type { CohortMember } from "../types/profile";

function formatDate(iso: string): string {
  return formatAppDate(iso, {
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

interface CohortMemberListProps {
  onSelectPerson: (sourceId: number, personId: number) => void;
}

export function CohortMemberList({ onSelectPerson }: CohortMemberListProps) {
  const { t } = useTranslation("app");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [cohortId, setCohortId] = useState<number | null>(null);
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

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
    enabled: sourceId != null && sourceId > 0,
  });

  const cohorts = cohortData?.items ?? [];

  const {
    data: membersData,
    isLoading: loadingMembers,
    error: membersError,
  } = useCohortMembers(sourceId, cohortId, page);

  const rawMembers = useMemo(() => membersData?.data ?? [], [membersData]);
  const totalPages = membersData?.meta?.last_page ?? 1;
  const total = membersData?.meta?.total ?? 0;
  const perPage = membersData?.meta?.per_page ?? 15;

  // Apply client-side sort + filter to current page
  const members = useMemo(() => {
    let data = [...rawMembers];

    // Filter by partial ID search
    if (searchId.trim()) {
      data = data.filter((m) =>
        String(m.subject_id).includes(searchId.trim()),
      );
    }

    // Filter by gender
    if (filterGender) {
      data = data.filter(
        (m) => (m.gender ?? "").toLowerCase() === filterGender.toLowerCase(),
      );
    }

    // Filter by birth year range
    const minY = filterBirthYearMin ? Number(filterBirthYearMin) : null;
    const maxY = filterBirthYearMax ? Number(filterBirthYearMax) : null;
    if (minY != null) data = data.filter((m) => (m.year_of_birth ?? 0) >= minY);
    if (maxY != null) data = data.filter((m) => (m.year_of_birth ?? 9999) <= maxY);

    // Sort
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
      const g = getProfileGenderLabel(t, m.gender);
      genderCounts[g] = (genderCounts[g] ?? 0) + 1;
    }
    const yearVals = rawMembers.map((m) => m.year_of_birth ?? 0).filter(Boolean);
    const meanYear =
      yearVals.length > 0
        ? Math.round(yearVals.reduce((s, v) => s + v, 0) / yearVals.length)
        : null;
    return { genderCounts, meanYear, totalPage: rawMembers.length };
  }, [rawMembers, t]);

  // Unique genders for filter dropdown (from current page)
  const uniqueGenders = useMemo(
    () => [...new Set(rawMembers.map((m) => getProfileGenderLabel(t, m.gender)).filter(Boolean))],
    [rawMembers, t],
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
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
    a.download = t("profiles.cohortBrowser.exportFilename", { page });
    a.click();
    URL.revokeObjectURL(url);
  }, [members, page, t]);

  return (
    <div className="space-y-6">
      {/* Patient Search — live search by ID / MRN */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("profiles.cohortBrowser.findPatient")}
        </h3>
        <PatientSearchPanel onSelectPerson={onSelectPerson} />
      </div>

      {/* Cohort browser — secondary way to browse by cohort */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("profiles.cohortBrowser.browseByCohort")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Selector */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("profiles.common.dataSource")}
            </label>
            <div className="relative">
              <Database
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
              />
              <select
                value={sourceId ?? ""}
                onChange={(e) => {
                  setSourceId(Number(e.target.value) || null);
                  setCohortId(null);
                  setPage(1);
                }}
                disabled={loadingSources}
                className={cn(
                  "w-full appearance-none rounded-lg border border-border-default bg-surface-base pl-8 pr-8 py-2 text-sm",
                  "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
                )}
              >
                <option value="">{t("profiles.cohortBrowser.selectDataSource")}</option>
                {sources?.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.source_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost"
              />
            </div>
          </div>

          {/* Cohort Selector */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("profiles.common.cohort")}
            </label>
            <div className="relative">
              <Users
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
              />
              <select
                value={cohortId ?? ""}
                onChange={(e) => {
                  setCohortId(Number(e.target.value) || null);
                  setPage(1);
                }}
                disabled={!sourceId || loadingCohorts}
                className={cn(
                  "w-full appearance-none rounded-lg border border-border-default bg-surface-base pl-8 pr-8 py-2 text-sm",
                  "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
                  "disabled:opacity-50",
                )}
              >
                <option value="">{t("profiles.cohortBrowser.selectCohort")}</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Members Table */}
      {sourceId && cohortId && (
        <div className="space-y-3">
          {loadingMembers ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          ) : membersError ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-critical text-sm">
                {t("profiles.cohortBrowser.failedToLoad")}
              </p>
            </div>
          ) : rawMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
              <Users size={24} className="text-text-ghost mb-3" />
              <p className="text-sm text-text-muted">
                {t("profiles.cohortBrowser.noMembers")}
              </p>
            </div>
          ) : (
            <>
              {/* Stats + toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Cohort summary stats */}
                {stats && (
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>
                      <span className="font-semibold text-text-primary">
                        {total.toLocaleString()}
                      </span>{" "}
                      {t("profiles.cohortBrowser.stats.totalMembers")}
                    </span>
                    {stats.meanYear && (
                      <span>
                        {t("profiles.cohortBrowser.stats.meanBirthYear")}:{" "}
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

                {/* Toolbar buttons */}
                <div className="flex items-center gap-2">
                  {/* ID search filter */}
                  <div className="relative">
                    <Search
                      size={11}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-ghost"
                    />
                    <input
                      type="text"
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      placeholder={t("profiles.cohortBrowser.filters.filterById")}
                      className={cn(
                        "w-36 rounded-md border border-surface-highlight bg-surface-base pl-7 pr-2 py-1.5 text-xs",
                        "text-text-primary placeholder:text-text-ghost",
                        "focus:border-accent focus:outline-none",
                      )}
                    />
                  </div>

                  {/* Filters toggle */}
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
                    {t("profiles.cohortBrowser.filters.title")}
                    {(filterGender || filterBirthYearMin || filterBirthYearMax) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </button>

                  {/* Export */}
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={members.length === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-surface-highlight px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-text-ghost transition-colors disabled:opacity-40"
                  >
                    <Download size={12} />
                    {t("profiles.common.actions.exportCsv")}
                  </button>
                </div>
              </div>

              {/* Filter row */}
              {showFilters && (
                <div className="flex items-center gap-3 rounded-lg border border-surface-highlight bg-surface-raised px-4 py-3 flex-wrap">
                  <span className="text-xs font-medium text-text-muted">
                    {t("profiles.cohortBrowser.filters.activeLabel")}
                  </span>
                  {/* Gender */}
                  <div>
                    <label className="text-[10px] text-text-ghost block mb-0.5">
                      {t("profiles.cohortBrowser.filters.gender")}
                    </label>
                    <select
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                      className="rounded border border-surface-highlight bg-surface-base px-2 py-1 text-xs text-text-primary focus:outline-none"
                    >
                      <option value="">{t("profiles.cohortBrowser.filters.any")}</option>
                      {uniqueGenders.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Birth year range */}
                  <div className="flex items-end gap-1.5">
                    <div>
                      <label className="text-[10px] text-text-ghost block mb-0.5">
                        {t("profiles.cohortBrowser.filters.birthYearGte")}
                      </label>
                      <input
                        type="number"
                        value={filterBirthYearMin}
                        onChange={(e) => setFilterBirthYearMin(e.target.value)}
                        placeholder={t("profiles.cohortBrowser.filters.exampleYear", {
                          year: 1950,
                        })}
                        className="w-24 rounded border border-surface-highlight bg-surface-base px-2 py-1 text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-ghost block mb-0.5">
                        {t("profiles.cohortBrowser.filters.birthYearLte")}
                      </label>
                      <input
                        type="number"
                        value={filterBirthYearMax}
                        onChange={(e) => setFilterBirthYearMax(e.target.value)}
                        placeholder={t("profiles.cohortBrowser.filters.exampleYear", {
                          year: 2000,
                        })}
                        className="w-24 rounded border border-surface-highlight bg-surface-base px-2 py-1 text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  {/* Clear */}
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
                      {t("profiles.cohortBrowser.filters.clear")}
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
                          { key: "subject_id", label: t("profiles.cohortBrowser.table.personId") },
                          { key: "gender", label: t("profiles.cohortBrowser.sort.gender") },
                          { key: "year_of_birth", label: t("profiles.cohortBrowser.table.yearOfBirth") },
                          { key: "cohort_start_date", label: t("profiles.cohortBrowser.table.cohortStart") },
                          { key: "cohort_end_date", label: t("profiles.cohortBrowser.table.cohortEnd") },
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
                          {t("profiles.cohortBrowser.table.noMembersMatchingCurrentFilters")}
                        </td>
                      </tr>
                    ) : (
                      members.map((member, i) => (
                        <tr
                          key={member.subject_id}
                          onClick={() =>
                            onSelectPerson(sourceId!, member.subject_id)
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
                            {member.gender
                              ? getProfileGenderLabel(t, member.gender)
                              : "--"}
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
                    {t("profiles.cohortBrowser.pagination.rowsXtoYOfZ", {
                      from: (page - 1) * perPage + 1,
                      to: Math.min(page * perPage, total),
                      total: total.toLocaleString(),
                    })}
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
                      {t("profiles.cohortBrowser.pagination.pageXOfY", {
                        current: page,
                        total: totalPages,
                      })}
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
