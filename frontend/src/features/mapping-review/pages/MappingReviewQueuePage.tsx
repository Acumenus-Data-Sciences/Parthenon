import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useMappingReviewQueue,
  useMappingReviewStats,
} from "../api";
import {
  COMMON_SOURCE_VOCABS,
  type QueueFilters,
  type QueueRow,
  type SortBy,
  type StatusFilter,
} from "../types";
import { SimilarityBar } from "../components/SimilarityBar";
import { StatusPill } from "../components/StatusPill";
import { KeyboardHelpOverlay } from "../components/KeyboardHelpOverlay";
import { useReviewerKeyboardShortcuts } from "../hooks/useReviewerKeyboardShortcuts";
import { tAuto } from "@/i18n/autoUserFacing";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "confidence_asc", label: tAuto("lowestConfidenceFirst_5d95b861") },
  { value: "confidence_desc", label: tAuto("highestConfidenceFirst_7d10f3a3") },
  { value: "age_asc", label: tAuto("oldestFirst_6a99c65c") },
  { value: "age_desc", label: tAuto("newestFirst_f5ec7772") },
  { value: "seen_count_desc", label: tAuto("mostSeenFirst_36d206e7") },
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  const diffMs = Date.now() - dt.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return dt.toLocaleDateString();
}

function MappingReviewQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusedRow, setFocusedRow] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const status = (searchParams.get("status") as StatusFilter | null) ?? "pending";
  const sourceVocab = searchParams.get("source_vocab") ?? "";
  const sortBy = (searchParams.get("sort_by") as SortBy | null) ?? "confidence_asc";
  const page = Number(searchParams.get("page") ?? "1");
  const rawSearch = searchParams.get("q") ?? "";

  const [searchInput, setSearchInput] = useState(rawSearch);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // When debounced search changes, push to URL.
  useEffect(() => {
    if (debouncedSearch === rawSearch) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set("q", debouncedSearch);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, rawSearch, searchParams, setSearchParams]);

  const filters = useMemo<QueueFilters>(
    () => ({
      status,
      source_vocab: sourceVocab || undefined,
      q: rawSearch || undefined,
      sort_by: sortBy,
      page,
      per_page: 50,
    }),
    [status, sourceVocab, rawSearch, sortBy, page],
  );

  const queueQuery = useMappingReviewQueue(filters);
  const statsQuery = useMappingReviewStats();

  const rows = queueQuery.data?.data ?? [];
  const totalPages = queueQuery.data?.meta.last_page ?? 1;
  const total = queueQuery.data?.meta.total ?? 0;
  const focusedRowIndex =
    rows.length === 0 ? 0 : Math.min(focusedRow, rows.length - 1);

  useReviewerKeyboardShortcuts({
    onNext: () =>
      setFocusedRow((i) => Math.min(Math.max(rows.length - 1, 0), i + 1)),
    onPrev: () => setFocusedRow((i) => Math.max(0, i - 1)),
    onApprove: () => {
      const r = rows[focusedRowIndex];
      if (r) navigate(`/admin/mapping-review/${r.queue_id}`);
    },
    onSearch: (e) => {
      e.preventDefault();
      searchRef.current?.focus();
    },
    onHelpToggle: () => setHelpOpen((v) => !v),
    onEscape: () => setHelpOpen(false),
  });

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-zinc-100">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {tAuto("conceptMappingReview_7ba8b47a")}
            </h1>
            <p className="text-sm text-zinc-400">
              {tAuto("harmoniaHarmonizesTheRerankQueueReviewPendingSuggestions_9e9cee97")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            aria-label={tAuto("showKeyboardShortcuts_9855e663")}
            aria-keyshortcuts="?"
          >
            <kbd className="font-mono text-xs">?</kbd>{" "}
            <span className="ml-1">{tAuto("keyboard_6662c40b")}</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status="pending" count={statsQuery.data?.pending ?? 0} />
          <StatusPill status="approved" count={statsQuery.data?.approved ?? 0} />
          <StatusPill status="rejected" count={statsQuery.data?.rejected ?? 0} />
          <StatusPill status="escalated" count={statsQuery.data?.escalated ?? 0} />
        </div>
      </header>

      <div className="rounded-xl border border-zinc-800 bg-[#0E0E11]/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-zinc-400">
            <span className="mb-1 uppercase tracking-wide">{tAuto("status_bae7d5be")}</span>
            <select
              value={status}
              onChange={(e) => setFilter("status", e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 focus:border-[#2DD4BF] focus:outline-none"
            >
              <option value="pending">{tAuto("pending_96f608c1")}</option>
              <option value="approved">{tAuto("approved_41b81eb8")}</option>
              <option value="rejected">{tAuto("rejected_27eeb7a2")}</option>
              <option value="escalated">{tAuto("escalated_aff666f4")}</option>
              <option value="all">{tAuto("all_6a720856")}</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-400">
            <span className="mb-1 uppercase tracking-wide">{tAuto("sourceVocab_47f9ac74")}</span>
            <select
              value={sourceVocab}
              onChange={(e) => setFilter("source_vocab", e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 focus:border-[#2DD4BF] focus:outline-none"
            >
              <option value="">{tAuto("all_6a720856")}</option>
              {COMMON_SOURCE_VOCABS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-400">
            <span className="mb-1 uppercase tracking-wide">{tAuto("sort_adc4e96a")}</span>
            <select
              value={sortBy}
              onChange={(e) => setFilter("sort_by", e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 focus:border-[#2DD4BF] focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col text-xs text-zinc-400">
            <span className="mb-1 uppercase tracking-wide">
              {tAuto("searchCodeOrText_e048a7c5")}
            </span>
            <input
              ref={searchRef}
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={tAuto("glucFastingHypertension_2bed3f8e")}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#2DD4BF] focus:outline-none"
              aria-keyshortcuts="/"
            />
          </label>
        </div>
      </div>

      <QueueTable
        rows={rows}
        focusedRow={focusedRowIndex}
        onFocusRow={setFocusedRow}
        loading={queueQuery.isLoading}
        error={queueQuery.error}
        onRetry={() => queueQuery.refetch()}
      />

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={(p) => setFilter("page", String(p))}
        />
      )}

      <KeyboardHelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}

interface QueueTableProps {
  rows: QueueRow[];
  focusedRow: number;
  onFocusRow: (i: number) => void;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

function QueueTable({
  rows,
  focusedRow,
  onFocusRow,
  loading,
  error,
  onRetry,
}: QueueTableProps) {
  if (error) {
    const message = error instanceof Error ? error.message : "Unable to load queue.";
    return (
      <div
        role="alert"
        className="rounded-xl border border-[#9B1B30]/50 bg-[#9B1B30]/10 p-6 text-center"
      >
        <p className="text-sm text-[#FCA5A5]">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-[#9B1B30] px-3 py-1.5 text-sm font-medium text-white"
        >
          {tAuto("retry_9f5cd8a2")}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#0E0E11]/60 p-4">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-md bg-zinc-900"
              aria-hidden="true"
            />
          ))}
        </div>
        <span className="sr-only">{tAuto("loadingQueue_a1e2a39a")}</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#0E0E11]/60 p-12 text-center">
        <p className="text-base text-zinc-300">{tAuto("noItemsMatchTheseFilters_a6276bfd")}</p>
        <p className="mt-2 text-sm italic text-zinc-500">
          {tAuto("hecateSearchesTheCrossroadsHarmoniaHarmonizesAriadneRecords_ed880a76")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">{tAuto("sourceCode_22a35fbe")}</th>
            <th scope="col" className="px-3 py-2 text-left">{tAuto("vocab_239c2f13")}</th>
            <th scope="col" className="px-3 py-2 text-left">{tAuto("sourceText_6f377d27")}</th>
            <th scope="col" className="px-3 py-2 text-left">{tAuto("topSuggestion_22a1f2ed")}</th>
            <th scope="col" className="px-3 py-2 text-left">{tAuto("confidence_82fa7d52")}</th>
            <th scope="col" className="px-3 py-2 text-right">{tAuto("seen_56564dcb")}</th>
            <th scope="col" className="px-3 py-2 text-left">{tAuto("age_ff9f1ff3")}</th>
            <th scope="col" className="px-3 py-2 text-left">{tAuto("status_bae7d5be")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900 bg-[#0E0E11]/40">
          {rows.map((row, i) => {
            const focused = i === focusedRow;
            return (
              <tr
                key={row.queue_id}
                className={`${focused ? "bg-zinc-900/80 ring-1 ring-inset ring-[#2DD4BF]" : "hover:bg-zinc-900/40"}`}
                onMouseEnter={() => onFocusRow(i)}
              >
                <td className="px-3 py-2 font-mono text-zinc-100">
                  <Link
                    to={`/admin/mapping-review/${row.queue_id}`}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
                  >
                    {row.source_code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-300">{row.source_vocab}</td>
                <td className="max-w-xs truncate px-3 py-2 text-zinc-400" title={row.source_text ?? ""}>
                  {row.source_text || "—"}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-zinc-200" title={row.top_candidate?.concept_name ?? ""}>
                  {row.top_candidate?.concept_name ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <SimilarityBar value={row.top1_confidence} width="narrow" />
                </td>
                <td className="px-3 py-2 text-right font-mono text-zinc-300 tabular-nums">
                  {row.seen_count}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {formatRelativeTime(row.created_at)}
                </td>
                <td className="px-3 py-2">
                  <StatusPill status={row.status} size="sm" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}

function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between text-sm text-zinc-400">
      <span className="tabular-nums">
        {tAuto("page_fb06270f")} {page} of {totalPages} ({total} {tAuto("items_91a9f843")}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-md border border-zinc-700 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-800"
        >
          {tAuto("previous_50f94286")}
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-md border border-zinc-700 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-800"
        >
          {tAuto("next_bc981983")}
        </button>
      </div>
    </div>
  );
}

export default MappingReviewQueuePage;
