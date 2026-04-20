import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Database,
  Loader2,
  AlertCircle,
  BarChart3,
  Eye,
  Upload,
  Stethoscope,
  MessageSquare,
  RefreshCw,
  Clock,
  X,
  BookOpen,
  FileText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, Button, Badge } from "@/components/ui";
import { formatNumber } from "@/i18n/format";
import {
  fetchCollections,
  fetchCollectionOverview,
  queryCollection,
  ingestDocs,
  ingestClinical,
  promoteFaq,
  ingestOhdsiPapers,
  ingestOhdsiKnowledge,
  ingestTextbooks,
  type CollectionSummary,
  type CollectionOverview,
  type QueryResponse,
  type MetadataFacet,
  type SampleRecord,
  type Json,
} from "../api/chromaStudioApi";
import VectorExplorer from "./vector-explorer/VectorExplorer";
import { getCollectionTheme } from "./vector-explorer/constants";

// ── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ACTIONS = [
  { key: "ingest-docs", labelKey: "ingestDocs", icon: Upload, fn: () => ingestDocs() },
  { key: "ingest-clinical", labelKey: "ingestClinical", icon: Stethoscope, fn: () => ingestClinical() },
  { key: "promote-faq", labelKey: "promoteFaq", icon: MessageSquare, fn: () => promoteFaq() },
  { key: "ingest-ohdsi-papers", labelKey: "ingestOhdsiPapers", icon: FileText, fn: () => ingestOhdsiPapers() },
  { key: "ingest-ohdsi-knowledge", labelKey: "ingestOhdsiKnowledge", icon: BookOpen, fn: () => ingestOhdsiKnowledge() },
  { key: "ingest-textbooks", labelKey: "ingestTextbooks", icon: BookOpen, fn: () => ingestTextbooks() },
] as const;

const TABS = [
  { key: "overview" as const, labelKey: "overview", icon: BarChart3 },
  { key: "search" as const, labelKey: "retrieval", icon: Eye },
] as const;

// ── Main Component ───────────────────────────────────────────────────────────

export default function ChromaStudioPanel() {
  const { t } = useTranslation("app");
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [overview, setOverview] = useState<CollectionOverview | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "search">("overview");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<QueryResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [nResults, setNResults] = useState(8);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadCollections = useCallback(async () => {
    setLoadingCollections(true);
    try {
      const data = await fetchCollections();
      setCollections(data);
      if (data.length > 0 && !selectedCollection) {
        // Prefer "docs" collection, fall back to largest by count
        const docs = data.find((c) => c.name === "docs");
        if (docs) {
          setSelectedCollection(docs.name);
        } else {
          const largest = data.reduce((max, c) =>
            (c.count ?? 0) > (max.count ?? 0) ? c : max, data[0]);
          setSelectedCollection(largest.name);
        }
      }
      return data;
    } catch (e) {
      setError(normalizeError(e));
      return [];
    } finally {
      setLoadingCollections(false);
    }
  }, [selectedCollection]);

  useEffect(() => {
    loadCollections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedCollection) return;
    let cancelled = false;
    setLoadingOverview(true);
    setError(null);
    setSearchResults(null);

    fetchCollectionOverview(selectedCollection)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((e) => {
        if (!cancelled) setError(normalizeError(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingOverview(false);
      });
    return () => { cancelled = true; };
  }, [selectedCollection]);

  const stats = useMemo(() => {
    if (!overview) return null;
    const sampleCount = overview.sampleRecords.length;
    const avgDocLength = sampleCount
      ? Math.round(overview.sampleRecords.reduce((sum, r) => sum + (r.document?.length ?? 0), 0) / sampleCount)
      : 0;
    return {
      totalVectors: overview.count,
      sampleCount,
      dimension: overview.dimension ?? null,
      metadataFieldCount: overview.metadataKeys.length,
      avgDocLength,
    };
  }, [overview]);

  async function runQuery(queryText?: string) {
    const text = queryText ?? searchText;
    if (!selectedCollection || !text.trim()) return;
    if (queryText) setSearchText(queryText);
    setQueryLoading(true);
    setError(null);
    setShowHistory(false);
    try {
      const response = await queryCollection({
        collectionName: selectedCollection,
        queryText: text,
        nResults,
      });
      setSearchResults(response);
      setActiveTab("search");
      // Add to history (deduplicated, most recent first, max 10)
      setQueryHistory((prev) => {
        const filtered = prev.filter((q) => q !== text.trim());
        return [text.trim(), ...filtered].slice(0, 10);
      });
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setQueryLoading(false);
    }
  }

  async function runAction(action: string, fn: () => Promise<unknown>) {
    setActionLoading(action);
    setActionResult(null);
    try {
      const result = await fn();
      setActionResult(`${action}: ${JSON.stringify(result)}`);
      const data = await fetchCollections();
      setCollections(data);
      if (selectedCollection) {
        const updated = await fetchCollectionOverview(selectedCollection);
        setOverview(updated);
      }
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setActionLoading(null);
    }
  }

  const hasCollections = collections.length > 0;
  const selectedTheme = useMemo(() => getCollectionTheme(selectedCollection), [selectedCollection]);

  return (
    <div className="space-y-4">
      {/* 3D Semantic Map — front and center */}
      {overview && overview.count > 0 && (
        <VectorExplorer
          collectionName={selectedCollection}
          overview={overview}
          collections={collections}
          loadingCollections={loadingCollections}
          onCollectionChange={setSelectedCollection}
        />
      )}

      {/* Header row — matches GisDataPanel pattern */}
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5" style={{ color: selectedTheme.accent }} />
            <div>
              <p className="font-semibold text-text-primary">
                {t("administration.chromaStudio.title")}
              </p>
              <p className="mt-0.5 text-sm text-text-muted">
                {t("administration.chromaStudio.subtitle")}
              </p>
            </div>
          </div>
          <Badge variant={hasCollections ? "success" : "warning"}>
            {hasCollections
              ? t("administration.chromaStudio.values.collectionCount", {
                count: formatNumber(collections.length),
              })
              : t("administration.chromaStudio.values.loading")}
          </Badge>
        </div>

        {/* Collection selector + actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="rounded border border-border-default bg-surface-base px-2.5 py-1.5 text-sm text-text-primary outline-none transition focus:border-accent/50"
          >
            {loadingCollections
              ? <option>{t("administration.chromaStudio.values.loadingEllipsis")}</option>
              : null}
            {collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.count != null
                  ? t("administration.chromaStudio.values.countSuffix", {
                    count: formatNumber(c.count),
                  })
                  : ""}
              </option>
            ))}
          </select>

          {/* Refresh collections button */}
          <button
            onClick={() => loadCollections()}
            disabled={loadingCollections}
            title={t("administration.chromaStudio.actions.refreshCollections")}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40"
          >
            {loadingCollections
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />}
          </button>

          {ADMIN_ACTIONS.map((action) => (
            <button
              key={action.key}
              onClick={() => runAction(action.key, action.fn)}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40"
            >
              {actionLoading === action.key
                ? <Loader2 size={14} className="animate-spin" />
                : <action.icon size={14} />}
              {t(`administration.chromaStudio.actions.${action.labelKey}`)}
            </button>
          ))}
        </div>

        {/* Stats row — inline like GIS/PACS */}
        {stats && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: t("administration.chromaStudio.stats.vectors"), value: fmt(stats.totalVectors) },
              { label: t("administration.chromaStudio.stats.sampled"), value: fmt(stats.sampleCount) },
              { label: t("administration.chromaStudio.stats.dimensions"), value: stats.dimension ? fmt(stats.dimension) : "--" },
              { label: t("administration.chromaStudio.stats.metaFields"), value: fmt(stats.metadataFieldCount) },
            ].map((cell) => (
              <div key={cell.label} className="rounded-lg bg-surface-base px-2.5 py-2 text-center">
                <div className="text-sm font-medium text-text-primary font-['IBM_Plex_Mono',monospace]">
                  {cell.value}
                </div>
                <div className="text-xs text-text-ghost">{cell.label}</div>
              </div>
            ))}
          </div>
        )}

        {loadingOverview && (
          <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("administration.chromaStudio.messages.loadingCollectionData")}
          </div>
        )}
      </Panel>

      {/* Feedback messages */}
      {actionResult && (
        <div
          className="flex items-center gap-2 rounded px-3 py-2 text-sm"
          style={{
            border: `1px solid ${selectedTheme.border}`,
            background: selectedTheme.bg,
            color: selectedTheme.textColor,
          }}
        >
          <RefreshCw size={14} />
          {actionResult}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded border border-critical/20 bg-critical/5 px-3 py-2 text-sm text-critical">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Empty collection prompt */}
      {overview && overview.count === 0 && (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Database className="h-8 w-8 text-text-ghost" />
            <div>
              <p className="text-sm font-medium text-text-secondary">
                {t("administration.chromaStudio.empty.title")}
              </p>
              <p className="mt-1 text-sm text-text-ghost">
                {t("administration.chromaStudio.empty.description", {
                  collection: selectedCollection,
                })}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Tab bar + search */}
      {overview && overview.count > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 rounded border border-border-default bg-surface-base p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? ""
                      : "text-text-ghost hover:text-text-muted"
                  }`}
                  style={activeTab === tab.key ? { background: selectedTheme.bg, color: selectedTheme.textColor } : undefined}
                >
                  <tab.icon size={14} />
                  {t(`administration.chromaStudio.tabs.${tab.labelKey}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-ghost" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runQuery()}
                  onFocus={() => queryHistory.length > 0 && setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                  placeholder={t("administration.chromaStudio.search.placeholder")}
                  className="w-full rounded border border-border-default bg-surface-base py-1.5 pl-8 pr-2.5 text-sm text-text-primary outline-none transition focus:border-accent/50"
                />
                {/* Query history dropdown */}
                {showHistory && queryHistory.length > 0 && (
                  <div className="absolute left-0 top-full z-30 mt-1 w-full rounded border border-border-default bg-surface-raised shadow-xl">
                    <div className="flex items-center justify-between px-2.5 py-1.5 text-xs text-text-ghost">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {t("administration.chromaStudio.search.recentQueries")}
                      </span>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setQueryHistory([]); setShowHistory(false); }}
                        className="text-text-ghost hover:text-critical"
                      >
                        <X size={10} />
                      </button>
                    </div>
                    {queryHistory.map((q) => (
                      <button
                        key={q}
                        onMouseDown={(e) => { e.preventDefault(); runQuery(q); }}
                        className="block w-full px-2.5 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-elevated truncate"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-ghost">
                  {t("administration.chromaStudio.search.kLabel")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={nResults}
                  onChange={(e) => setNResults(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="w-12 rounded border border-border-default bg-surface-base px-1.5 py-1.5 text-center text-sm text-text-primary outline-none transition focus:border-accent/50"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => runQuery()}
                disabled={queryLoading || !selectedCollection || !searchText.trim()}
              >
                {queryLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
                {t("administration.chromaStudio.search.queryAction")}
              </Button>
            </div>
          </div>

          {/* Tab content */}
          {activeTab === "overview" && <OverviewSection overview={overview} />}
          {activeTab === "search" && <SearchSection searchResults={searchResults} queryLoading={queryLoading} searchText={searchText} />}
        </div>
      )}
    </div>
  );
}

// ── Overview Section ─────────────────────────────────────────────────────────

function OverviewSection({ overview }: { overview: CollectionOverview }) {
  const { t } = useTranslation("app");

  return (
    <div className="space-y-4">
      {/* Facets */}
      {overview.facets.length > 0 && (
        <Panel>
          <h3 className="mb-3 text-base font-semibold text-text-primary">
            {t("administration.chromaStudio.overview.facetDistribution")}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {overview.facets.map((facet) => (
              <FacetCard key={facet.key} facet={facet} />
            ))}
          </div>
        </Panel>
      )}

      {/* Sample records */}
      <Panel>
        <h3 className="mb-3 text-base font-semibold text-text-primary">
          {t("administration.chromaStudio.overview.sampleRecords")}
          <span className="ml-2 text-sm font-normal text-text-ghost">
            {t("administration.chromaStudio.values.sampledSuffix", {
              count: formatNumber(overview.sampleRecords.length),
            })}
          </span>
        </h3>
        {overview.sampleRecords.length === 0 ? (
          <p className="text-sm text-text-ghost">
            {t("administration.chromaStudio.empty.noRecords")}
          </p>
        ) : (
          <div className="space-y-2">
            {overview.sampleRecords.slice(0, 8).map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </Panel>

      {/* Collection metadata */}
      {Object.keys(overview.collectionMetadata ?? {}).length > 0 && (
        <Panel>
          <h3 className="mb-3 text-base font-semibold text-text-primary">
            {t("administration.chromaStudio.overview.collectionMetadata")}
          </h3>
          <div className="space-y-1.5">
            {Object.entries(overview.collectionMetadata ?? {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded bg-surface-base px-2.5 py-1.5 text-sm">
                <span className="font-['IBM_Plex_Mono',monospace] text-success">{k}</span>
                <span className="text-text-muted">{typeof v === "string" ? v : JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ── Search Section ───────────────────────────────────────────────────────────

function SearchSection({ searchResults, queryLoading, searchText }: {
  searchResults: QueryResponse | null;
  queryLoading: boolean;
  searchText: string;
}) {
  const { t } = useTranslation("app");

  if (!searchResults && !queryLoading) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Search className="h-6 w-6 text-text-ghost" />
          <p className="text-sm text-text-muted">
            {t("administration.chromaStudio.search.empty")}
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      {searchResults && (
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span>
            {t("administration.chromaStudio.search.queryLabel")}{" "}
            <span className="text-text-primary">{searchText}</span>
          </span>
          <span className="rounded bg-surface-base px-1.5 py-0.5 font-['IBM_Plex_Mono',monospace] text-success">
            {searchResults.elapsedMs ?? "--"} ms
          </span>
          <span>
            {t("administration.chromaStudio.search.resultsCount", {
              count: formatNumber(searchResults.items.length),
            })}
          </span>
        </div>
      )}

      {queryLoading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("administration.chromaStudio.search.querying")}
        </div>
      )}

      {/* Result cards */}
      {(searchResults?.items ?? []).map((item, index) => (
        <Panel key={`${item.id}_${index}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded bg-success/15 px-1.5 py-0.5 text-xs font-medium text-success">
                  #{index + 1}
                </span>
                <span className="truncate font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">{item.id}</span>
              </div>
              <p className="line-clamp-3 text-sm leading-relaxed text-text-secondary">
                {item.document || t("administration.chromaStudio.empty.noDocumentReturned")}
              </p>
            </div>
            <div className="shrink-0 rounded bg-surface-base px-2.5 py-1.5 text-center">
              <div className="text-xs text-text-ghost">
                {t("administration.chromaStudio.search.distance")}
              </div>
              <div className="font-['IBM_Plex_Mono',monospace] text-sm font-medium text-text-primary">
                {typeof item.distance === "number" ? item.distance.toFixed(4) : "--"}
              </div>
            </div>
          </div>
          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(item.metadata).map(([k, v]) => (
                <MetadataTag key={k} k={k} v={v} />
              ))}
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function FacetCard({ facet }: { facet: MetadataFacet }) {
  const max = Math.max(...facet.values.map((v) => v.count), 1);
  return (
    <div className="rounded border border-border-default bg-surface-base p-3">
      <div className="mb-2 text-sm font-medium text-text-secondary">{facet.key}</div>
      <div className="space-y-2">
        {facet.values.map((entry) => (
          <div key={entry.label}>
            <div className="mb-0.5 flex items-center justify-between text-xs text-text-ghost">
              <span className="truncate">{entry.label}</span>
              <span>{entry.count}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#9B1B30] to-[#2DD4BF]"
                style={{ width: `${(entry.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordCard({ record }: { record: SampleRecord }) {
  const { t } = useTranslation("app");

  return (
    <div className="rounded border border-border-default bg-surface-base p-3">
      <div className="mb-1.5 font-['IBM_Plex_Mono',monospace] text-xs text-success truncate">
        {record.id}
      </div>
      <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">
        {record.document || t("administration.chromaStudio.empty.noDocumentText")}
      </p>
      {record.metadata && Object.keys(record.metadata).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(record.metadata)
            .slice(0, 5)
            .map(([k, v]) => (
              <MetadataTag key={k} k={k} v={v} />
            ))}
        </div>
      )}
    </div>
  );
}

function MetadataTag({ k, v }: { k: string; v: Json }) {
  return (
    <span className="inline-flex rounded bg-surface-elevated px-1.5 py-0.5 text-xs text-text-ghost">
      <span className="text-text-muted">{k}:</span>
      <span className="ml-0.5 truncate max-w-[180px]">{compact(v)}</span>
    </span>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "response" in error) {
    const resp = error as { response?: { data?: { error?: string; message?: string } } };
    return resp.response?.data?.error ?? resp.response?.data?.message ?? "Unknown error.";
  }
  return "Unknown error.";
}

function compact(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function fmt(value: number): string {
  return formatNumber(value);
}
