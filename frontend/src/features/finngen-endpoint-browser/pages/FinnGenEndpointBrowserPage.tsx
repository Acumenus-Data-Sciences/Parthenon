// FinnGen Endpoint Browser — researcher-facing catalog of the imported
// FinnGen DF14 endpoint library (~5,161 phenotypes). Surfaces coverage
// quality so researchers know what's usable before adopting an endpoint.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useEndpointDetail,
  useEndpointList,
  useEndpointStats,
} from "../hooks/useEndpoints";
import type {
  CoverageBucket,
  EndpointDetail,
  EndpointSummary,
} from "../api";

const BUCKET_META: Record<
  CoverageBucket,
  { label: string; tone: string; ring: string; bar: string; description: string }
> = {
  FULLY_MAPPED: {
    label: "Fully mapped",
    tone: "text-teal-300",
    ring: "ring-teal-500/40 hover:ring-teal-400/70",
    bar: "bg-teal-500/80",
    description: "≥95% of source codes resolved",
  },
  PARTIAL: {
    label: "Partial",
    tone: "text-amber-300",
    ring: "ring-amber-500/40 hover:ring-amber-400/70",
    bar: "bg-amber-500/80",
    description: "50–94% codes resolved",
  },
  SPARSE: {
    label: "Sparse",
    tone: "text-orange-300",
    ring: "ring-orange-500/40 hover:ring-orange-400/70",
    bar: "bg-orange-500/80",
    description: "1–49% codes resolved",
  },
  UNMAPPED: {
    label: "Unmapped",
    tone: "text-rose-300",
    ring: "ring-rose-500/40 hover:ring-rose-400/70",
    bar: "bg-rose-500/80",
    description: "0% codes resolved (awaits Finnish vocab)",
  },
  CONTROL_ONLY: {
    label: "Control only",
    tone: "text-slate-300",
    ring: "ring-slate-500/30 hover:ring-slate-400/60",
    bar: "bg-slate-500/60",
    description: "No source codes — defines a control group",
  },
  UNKNOWN: {
    label: "Unknown",
    tone: "text-slate-400",
    ring: "ring-slate-500/30",
    bar: "bg-slate-600/60",
    description: "Coverage not classified",
  },
};

const BUCKET_ORDER: CoverageBucket[] = [
  "FULLY_MAPPED",
  "PARTIAL",
  "SPARSE",
  "UNMAPPED",
  "CONTROL_ONLY",
];

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function FinnGenEndpointBrowserPage() {
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<CoverageBucket | "">("");
  const [tag, setTag] = useState<string>("");
  const [page, setPage] = useState(1);
  const [openName, setOpenName] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  const stats = useEndpointStats();
  const list = useEndpointList({
    q: debouncedSearch || undefined,
    bucket: bucket || undefined,
    tag: tag || undefined,
    per_page: 25,
    page,
  });

  const total = stats.data?.data.total ?? 0;
  const byBucket = stats.data?.data.by_bucket ?? {};
  const topTags = stats.data?.data.top_tags ?? [];

  const resetFilters = () => {
    setSearch("");
    setBucket("");
    setTag("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#0E0E11] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-teal-400/80">
                FinnGen
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-50">
                Endpoint Library
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                {total.toLocaleString()} curated FinnGen phenotype definitions
                (DF14, 2026-02-13). Filter by mapping coverage to find endpoints
                ready to use against Parthenon CDM data.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/workbench/cohorts"
                className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-teal-500/60 hover:text-teal-300"
              >
                Open Workbench
              </Link>
            </div>
          </div>
        </header>

        {/* Stat cards — clickable to filter by bucket */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BUCKET_ORDER.map((b) => {
            const meta = BUCKET_META[b];
            const count = byBucket[b] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const active = bucket === b;
            return (
              <button
                key={b}
                onClick={() => {
                  setBucket(active ? "" : b);
                  setPage(1);
                }}
                className={`group relative overflow-hidden rounded-lg border bg-slate-950/60 p-4 text-left ring-1 transition ${meta.ring} ${
                  active
                    ? "border-slate-700 ring-2"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div
                  className={`absolute inset-x-0 bottom-0 h-1 ${meta.bar}`}
                  style={{ opacity: active ? 1 : 0.5 }}
                />
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wider ${meta.tone}`}
                >
                  {meta.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-100">
                  {count.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {pct.toFixed(1)}% of catalog
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {meta.description}
                </p>
              </button>
            );
          })}
        </section>

        {/* Search + active filters */}
        <section className="mb-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, longname, or ICD code (e.g. E4_DM2, hypertension, I10)"
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-4 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-600 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            {(search || bucket || tag) && (
              <button
                onClick={resetFilters}
                className="rounded-md border border-slate-800 px-3 py-2.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Tag chips — top 12 from stats */}
          <div className="flex flex-wrap gap-1.5">
            {topTags.slice(0, 12).map((t) => {
              const active = tag === t.tag;
              return (
                <button
                  key={t.tag}
                  onClick={() => {
                    setTag(active ? "" : t.tag);
                    setPage(1);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? "border-teal-500/60 bg-teal-500/10 text-teal-300"
                      : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {t.tag}
                  <span className="ml-1.5 text-slate-600">{t.n}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Results list */}
        <section>
          <div className="mb-2 flex items-baseline justify-between text-xs text-slate-500">
            <span>
              {list.isLoading
                ? "Loading…"
                : list.data
                  ? `${(list.data.from ?? 0).toLocaleString()}–${(
                      list.data.to ?? 0
                    ).toLocaleString()} of ${list.data.total.toLocaleString()}`
                  : ""}
            </span>
            <span className="text-slate-600">
              Sorted by name · click a row for codes &amp; coverage detail
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
            {list.isLoading && !list.data && (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Loading endpoints…
              </div>
            )}
            {list.data && list.data.data.length === 0 && (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-slate-400">
                  No endpoints match your filters.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-3 text-xs text-teal-400 hover:text-teal-300"
                >
                  Clear all filters →
                </button>
              </div>
            )}
            {list.data?.data.map((row) => (
              <EndpointRow
                key={row.id}
                row={row}
                onOpen={() => setOpenName(row.name)}
              />
            ))}
          </div>

          {/* Pagination */}
          {list.data && list.data.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                disabled={list.data.current_page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:border-slate-700"
              >
                ← Previous
              </button>
              <span className="text-slate-500">
                Page {list.data.current_page} of {list.data.last_page}
              </span>
              <button
                disabled={list.data.current_page >= list.data.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:border-slate-700"
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Detail drawer */}
      <EndpointDetailDrawer
        name={openName}
        onClose={() => setOpenName(null)}
      />
    </div>
  );
}

// ── Row card ────────────────────────────────────────────────────────────────

function EndpointRow({
  row,
  onOpen,
}: {
  row: EndpointSummary;
  onOpen: () => void;
}) {
  const meta = BUCKET_META[row.coverage_bucket ?? "UNKNOWN"];
  const pct = row.coverage_pct != null ? Math.round(row.coverage_pct * 100) : null;
  const display = row.tags
    .filter((t) => t !== "finngen-endpoint" && !t.startsWith("finngen:"))
    .slice(0, 5);

  return (
    <button
      onClick={onOpen}
      className="group block w-full border-b border-slate-800/60 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-900/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm font-semibold text-slate-100 group-hover:text-teal-300">
              {row.name}
            </span>
            <span
              className={`rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
            >
              {meta.label}
              {pct != null && row.coverage_bucket !== "CONTROL_ONLY" && (
                <span className="ml-1.5 font-mono text-slate-500">{pct}%</span>
              )}
            </span>
          </div>
          {row.description && (
            <p className="mt-1 truncate text-xs text-slate-500">
              {row.description}
            </p>
          )}
          {display.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {display.map((t) => (
                <span
                  key={t}
                  className="rounded border border-slate-800 bg-slate-950/60 px-1.5 py-0.5 text-[10px] text-slate-400"
                >
                  {t}
                </span>
              ))}
              {row.tags.length - display.length - 2 > 0 && (
                <span className="px-1 text-[10px] text-slate-600">
                  +{row.tags.length - display.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right text-[11px] text-slate-500">
          {row.n_tokens_total != null && (
            <div>
              <span className="font-mono text-slate-300">
                {row.n_tokens_resolved ?? 0}
              </span>
              <span className="text-slate-600"> / </span>
              <span className="font-mono">{row.n_tokens_total}</span>
              <div className="text-[10px] text-slate-600">codes resolved</div>
            </div>
          )}
        </div>
      </div>
      {/* Coverage bar */}
      {pct != null && row.coverage_bucket !== "CONTROL_ONLY" && (
        <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full ${meta.bar}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      )}
    </button>
  );
}

// ── Detail drawer ───────────────────────────────────────────────────────────

function EndpointDetailDrawer({
  name,
  onClose,
}: {
  name: string | null;
  onClose: () => void;
}) {
  const detail = useEndpointDetail(name);
  const open = !!name;
  return (
    <div
      className={`fixed inset-0 z-50 transition ${
        open ? "visible" : "invisible"
      }`}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* panel */}
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-[#0E0E11] shadow-2xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#0E0E11] px-5 py-3">
          <span className="font-mono text-sm font-semibold text-slate-100">
            {name ?? ""}
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {detail.isLoading && (
          <div className="px-6 py-12 text-sm text-slate-500">Loading…</div>
        )}
        {detail.data && <EndpointDetailBody d={detail.data} />}
      </aside>
    </div>
  );
}

function EndpointDetailBody({ d }: { d: EndpointDetail }) {
  const meta = BUCKET_META[d.coverage_bucket ?? "UNKNOWN"];
  const pct =
    d.coverage?.pct != null ? Math.round((d.coverage.pct as number) * 100) : null;
  const sourceCodes = d.source_codes ?? {};
  const codeColumns = Object.entries(sourceCodes).filter(
    ([, v]) => v.patterns && v.patterns.length > 0,
  );
  const visibleTags = d.tags.filter(
    (t) => t !== "finngen-endpoint" && !t.startsWith("finngen:"),
  );

  return (
    <div className="space-y-6 px-6 py-5">
      {d.longname && (
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Long name
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            {d.longname}
          </h2>
        </div>
      )}

      {/* Coverage block */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Mapping coverage
          </p>
          <span
            className={`rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.tone}`}
          >
            {meta.label}
            {pct != null && (
              <span className="ml-1.5 font-mono text-slate-500">{pct}%</span>
            )}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <Stat
            label="Conditions"
            value={d.resolved_concepts.condition_count}
          />
          <Stat label="Drugs" value={d.resolved_concepts.drug_count} />
          <Stat
            label="Source concepts"
            value={d.resolved_concepts.source_concept_count}
          />
        </div>
        {d.resolved_concepts.truncated && (
          <p className="mt-2 text-[10px] text-amber-400">
            Concept lists truncated at 500 — endpoint matches more than the
            display limit.
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Release" value={d.release ?? "—"} />
        <Field label="Level" value={String(d.level ?? "—")} />
        <Field label="Sex restriction" value={d.sex_restriction ?? "—"} />
        <Field
          label="Includes"
          value={
            d.include_endpoints && d.include_endpoints.length > 0
              ? d.include_endpoints.join(", ")
              : "—"
          }
        />
      </div>

      {visibleTags.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Tags
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {visibleTags.map((t) => (
              <span
                key={t}
                className="rounded border border-slate-800 bg-slate-950/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source codes */}
      {codeColumns.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Source codes
          </p>
          <div className="mt-2 space-y-2">
            {codeColumns.map(([col, v]) => (
              <details
                key={col}
                className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs"
              >
                <summary className="cursor-pointer font-mono text-slate-300 hover:text-teal-300">
                  {col}
                  <span className="ml-2 text-slate-600">
                    ({v.patterns.length})
                  </span>
                </summary>
                <p className="mt-2 break-all font-mono text-[10px] text-slate-400">
                  {v.patterns.slice(0, 50).join(", ")}
                  {v.patterns.length > 50 && (
                    <span className="text-slate-600">
                      {" "}
                      … +{v.patterns.length - 50} more
                    </span>
                  )}
                </p>
                {v.raw && v.raw !== v.patterns.join("|") && (
                  <p className="mt-2 text-[10px] text-slate-600">
                    Raw:{" "}
                    <span className="font-mono text-slate-500">{v.raw}</span>
                  </p>
                )}
              </details>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="sticky bottom-0 -mx-6 border-t border-slate-800 bg-[#0E0E11] px-6 py-4">
        <Link
          to="/workbench/cohorts"
          className="block w-full rounded-md bg-teal-500/90 px-4 py-2.5 text-center text-sm font-semibold text-slate-900 hover:bg-teal-400"
        >
          Use {d.name} in Workbench →
        </Link>
        <p className="mt-2 text-center text-[10px] text-slate-500">
          Generation against CDM data is not yet implemented for this shape;
          copy to a custom cohort first.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-slate-200">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-slate-300">{value}</p>
    </div>
  );
}
