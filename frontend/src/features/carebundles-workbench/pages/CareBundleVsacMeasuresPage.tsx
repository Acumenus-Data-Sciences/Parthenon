import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Scale,
  Search,
  X,
} from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { HelpButton } from "@/features/help";
import { useVsacMeasures, useVsacMeasureTopics } from "../hooks";
import { WorkbenchTabs } from "../components/WorkbenchTabs";
import { tAuto } from "@/i18n/autoUserFacing";
import type { VsacMeasureSortColumn } from "../api";

type ProgramFilter = "all" | "yes" | "no";
type CbeFilter = "all" | "assigned" | "unassigned";

const SORTABLE_COLUMNS: ReadonlyArray<{
  key: VsacMeasureSortColumn;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "cms_id", label: "CMS ID" },
  { key: "title", label: "Measure" },
  { key: "cbe_number", label: "CBE #" },
  { key: "program_candidate", label: "Program" },
  { key: "value_set_count", label: "Value sets", align: "right" },
];

export default function CareBundleVsacMeasuresPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<VsacMeasureSortColumn>("cms_id");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [topic, setTopic] = useState<string | null>(null);
  const [program, setProgram] = useState<ProgramFilter>("all");
  const [cbe, setCbe] = useState<CbeFilter>("all");
  const [minValueSets, setMinValueSets] = useState<number>(0);

  const params = useMemo(
    () => ({
      q: q || undefined,
      page,
      per_page: 50,
      sort,
      direction,
      topic: topic ?? undefined,
      program: program === "all" ? undefined : program,
      cbe: cbe === "all" ? undefined : cbe,
      min_value_sets: minValueSets > 0 ? minValueSets : undefined,
    }),
    [q, page, sort, direction, topic, program, cbe, minValueSets],
  );

  const query = useVsacMeasures(params);
  const topicsQuery = useVsacMeasureTopics();
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const topics = topicsQuery.data ?? [];

  const activeFilterCount =
    (topic ? 1 : 0) +
    (program !== "all" ? 1 : 0) +
    (cbe !== "all" ? 1 : 0) +
    (minValueSets > 0 ? 1 : 0) +
    (q ? 1 : 0);

  const handleSort = (col: VsacMeasureSortColumn) => {
    if (sort === col) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setDirection(col === "value_set_count" ? "desc" : "asc");
    }
    setPage(1);
  };

  const clearAll = () => {
    setQ("");
    setTopic(null);
    setProgram("all");
    setCbe("all");
    setMinValueSets(0);
    setSort("cms_id");
    setDirection("asc");
    setPage(1);
  };

  const renderSortIcon = (col: VsacMeasureSortColumn) => {
    if (sort !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return direction === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
            <Scale className="h-5 w-5 text-text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{tAuto("cmsMeasures_a37c082e")}</h1>
            <p className="text-sm text-text-ghost">
              {meta?.total?.toLocaleString() ?? "…"} {tAuto("cmsEcqmsEachLinksToItsVsacValue_a148023e")}
            </p>
          </div>
        </div>
        <HelpButton helpKey="workbench.care-bundles.measures" />
      </header>

      <WorkbenchTabs />

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-ghost" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={tAuto("searchByCmsIdCbeNumberOrTitle_3d0f7585")}
          className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
        />
      </div>

      {/* Topic chips */}
      {topics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-text-ghost">Topics:</span>
          <button
            onClick={() => {
              setTopic(null);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              topic === null
                ? "border-accent bg-accent/10 text-accent"
                : "border-border-default text-text-secondary hover:bg-surface-overlay/40"
            }`}
          >
            All
          </button>
          {topics.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTopic(topic === t.key ? null : t.key);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                topic === t.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-default text-text-secondary hover:bg-surface-overlay/40"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-text-ghost">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-text-ghost">Program candidate</label>
          <select
            value={program}
            onChange={(e) => {
              setProgram(e.target.value as ProgramFilter);
              setPage(1);
            }}
            className="rounded-md border border-border-default bg-surface-raised px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="all">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-text-ghost">CBE number</label>
          <select
            value={cbe}
            onChange={(e) => {
              setCbe(e.target.value as CbeFilter);
              setPage(1);
            }}
            className="rounded-md border border-border-default bg-surface-raised px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="all">Any</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Not Applicable / Unassigned</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-text-ghost">Min value sets</label>
          <input
            type="number"
            min={0}
            max={500}
            value={minValueSets}
            onChange={(e) => {
              setMinValueSets(Math.max(0, Number(e.target.value) || 0));
              setPage(1);
            }}
            className="w-24 rounded-md border border-border-default bg-surface-raised px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay/40"
            title="Clear all filters"
          >
            <X className="h-3 w-3" /> Clear ({activeFilterCount})
          </button>
        )}
      </div>

      <Shell title={tAuto("measures_724255a4")} subtitle={`Page ${meta?.page ?? 1} of ${meta?.last_page ?? "?"}`}>
        <div className="overflow-x-auto">
          {query.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" /> {tAuto("loading_33ce4174")}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-text-ghost">{tAuto("noMeasuresMatch_eedad763")}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  {SORTABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-2 text-xs font-semibold text-text-ghost ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <button
                        onClick={() => handleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-text-primary ${
                          sort === col.key ? "text-text-primary" : ""
                        } ${col.align === "right" ? "flex-row-reverse" : ""}`}
                      >
                        {col.label}
                        {renderSortIcon(col.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr
                    key={m.cms_id}
                    className="border-b border-border-default/60 hover:bg-surface-overlay/40"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/workbench/care-bundles/measures/${m.cms_id}`}
                        className="text-sm font-medium text-text-primary hover:underline"
                      >
                        {m.cms_id}
                      </Link>
                    </td>
                    <td className="max-w-[28rem] px-4 py-2 text-sm text-text-primary">
                      {m.title ? (
                        <Link
                          to={`/workbench/care-bundles/measures/${m.cms_id}`}
                          title={m.title}
                          className="block truncate hover:underline"
                        >
                          {m.title}
                        </Link>
                      ) : (
                        <span className="text-text-ghost">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-text-muted">{m.cbe_number ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-text-muted">{m.program_candidate ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {m.value_set_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {meta && meta.last_page != null && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 text-xs text-text-ghost">
            <span>{meta.total.toLocaleString()} total</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
              >
                {tAuto("prev_e96fea52")}
              </button>
              <span>{page} / {meta.last_page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={meta.last_page != null && page >= meta.last_page}
                className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
              >
                {tAuto("next_bc981983")}
              </button>
            </div>
          </div>
        )}
      </Shell>
    </div>
  );
}
