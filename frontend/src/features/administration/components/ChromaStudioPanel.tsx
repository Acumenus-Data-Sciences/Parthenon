import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Database,
  Loader2,
  AlertCircle,
  BarChart3,
  Radar,
  Eye,
  Upload,
  Stethoscope,
  MessageSquare,
  RefreshCw,
  Clock,
  X,
} from "lucide-react";
import { Panel, Button, Badge } from "@/components/ui";
import {
  fetchCollections,
  fetchCollectionOverview,
  queryCollection,
  ingestDocs,
  ingestClinical,
  promoteFaq,
  type CollectionSummary,
  type CollectionOverview,
  type QueryResponse,
  type MetadataFacet,
  type ProjectionPoint,
  type SampleRecord,
  type Json,
} from "../api/chromaStudioApi";

// ── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ACTIONS = [
  { key: "ingest-docs", label: "Ingest Docs", icon: Upload, fn: () => ingestDocs() },
  { key: "ingest-clinical", label: "Ingest Clinical", icon: Stethoscope, fn: () => ingestClinical() },
  { key: "promote-faq", label: "Promote FAQ", icon: MessageSquare, fn: () => promoteFaq() },
] as const;

const TABS = [
  { key: "overview" as const, label: "Overview", icon: BarChart3 },
  { key: "search" as const, label: "Retrieval", icon: Eye },
  { key: "map" as const, label: "Semantic Map", icon: Radar },
] as const;

const PALETTE_COLORS = [
  "#9B1B30", "#2DD4BF", "#C9A227", "#60a5fa", "#a78bfa",
  "#f472b6", "#f59e0b", "#34d399", "#fb7185", "#38bdf8",
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function ChromaStudioPanel() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [overview, setOverview] = useState<CollectionOverview | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "search" | "map">("overview");
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
        // Auto-select the largest collection by count
        const largest = data.reduce((max, c) =>
          (c.count ?? 0) > (max.count ?? 0) ? c : max, data[0]);
        setSelectedCollection(largest.name);
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

  // Embeddings fetched on-demand only when map tab is active
  const [embeddingRecords, setEmbeddingRecords] = useState<CollectionOverview["sampleRecords"]>([]);
  const [embeddingsLoaded, setEmbeddingsLoaded] = useState(false);
  const [loadingEmbeddings, setLoadingEmbeddings] = useState(false);

  useEffect(() => {
    if (activeTab !== "map" || !selectedCollection || embeddingsLoaded) return;
    let cancelled = false;
    setLoadingEmbeddings(true);
    fetchCollectionOverview(selectedCollection, true)
      .then((data) => {
        if (!cancelled) {
          setEmbeddingRecords(data.sampleRecords);
          setEmbeddingsLoaded(true);
        }
      })
      .catch(() => { /* overview loaded, map won't render */ })
      .finally(() => {
        if (!cancelled) setLoadingEmbeddings(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, selectedCollection, embeddingsLoaded]);

  useEffect(() => {
    setEmbeddingsLoaded(false);
    setEmbeddingRecords([]);
  }, [selectedCollection]);

  const computedPoints = useUmapProjection(embeddingRecords);

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

  return (
    <div className="space-y-4">
      {/* Header row — matches GisDataPanel pattern */}
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-[#2DD4BF]" />
            <div>
              <p className="font-semibold text-[#F0EDE8]">Chroma Collection Studio</p>
              <p className="mt-0.5 text-sm text-[#8A857D]">
                Inspect vector collections, run semantic queries, and manage ingestion
              </p>
            </div>
          </div>
          <Badge variant={hasCollections ? "success" : "warning"}>
            {hasCollections ? `${collections.length} collections` : "loading"}
          </Badge>
        </div>

        {/* Collection selector + actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="rounded border border-[#232328] bg-[#0E0E11] px-2.5 py-1.5 text-sm text-[#E8E4DC] outline-none transition focus:border-[#C9A227]/50"
          >
            {loadingCollections ? <option>Loading...</option> : null}
            {collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.count != null ? `(${c.count.toLocaleString()})` : ""}
              </option>
            ))}
          </select>

          {/* Refresh collections button */}
          <button
            onClick={() => loadCollections()}
            disabled={loadingCollections}
            title="Refresh collections"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40"
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
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40"
            >
              {actionLoading === action.key
                ? <Loader2 size={14} className="animate-spin" />
                : <action.icon size={14} />}
              {action.label}
            </button>
          ))}
        </div>

        {/* Stats row — inline like GIS/PACS */}
        {stats && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: "Vectors", value: fmt(stats.totalVectors) },
              { label: "Sampled", value: fmt(stats.sampleCount) },
              { label: "Dimensions", value: stats.dimension ? fmt(stats.dimension) : "--" },
              { label: "Meta Fields", value: fmt(stats.metadataFieldCount) },
            ].map((cell) => (
              <div key={cell.label} className="rounded-lg bg-[#0E0E11] px-2.5 py-2 text-center">
                <div className="text-sm font-medium text-[#F0EDE8] font-['IBM_Plex_Mono',monospace]">
                  {cell.value}
                </div>
                <div className="text-xs text-[#5A5650]">{cell.label}</div>
              </div>
            ))}
          </div>
        )}

        {loadingOverview && (
          <div className="mt-3 flex items-center gap-2 text-sm text-[#8A857D]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading collection data...
          </div>
        )}
      </Panel>

      {/* Feedback messages */}
      {actionResult && (
        <div className="flex items-center gap-2 rounded border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-3 py-2 text-sm text-[#2DD4BF]">
          <RefreshCw size={14} />
          {actionResult}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-3 py-2 text-sm text-[#E85A6B]">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Empty collection prompt */}
      {overview && overview.count === 0 && (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Database className="h-8 w-8 text-[#5A5650]" />
            <div>
              <p className="text-sm font-medium text-[#C5C0B8]">
                This collection is empty
              </p>
              <p className="mt-1 text-sm text-[#5A5650]">
                Use the Ingest actions above to populate &ldquo;{selectedCollection}&rdquo; with documents.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Tab bar + search */}
      {overview && overview.count > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 rounded border border-[#232328] bg-[#0E0E11] p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-[#C9A227]/15 text-[#C9A227]"
                      : "text-[#5A5650] hover:text-[#8A857D]"
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A5650]" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runQuery()}
                  onFocus={() => queryHistory.length > 0 && setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                  placeholder="Semantic query..."
                  className="w-full rounded border border-[#232328] bg-[#0E0E11] py-1.5 pl-8 pr-2.5 text-sm text-[#E8E4DC] outline-none transition focus:border-[#C9A227]/50"
                />
                {/* Query history dropdown */}
                {showHistory && queryHistory.length > 0 && (
                  <div className="absolute left-0 top-full z-30 mt-1 w-full rounded border border-[#232328] bg-[#151518] shadow-xl">
                    <div className="flex items-center justify-between px-2.5 py-1.5 text-xs text-[#5A5650]">
                      <span className="flex items-center gap-1"><Clock size={10} /> Recent queries</span>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setQueryHistory([]); setShowHistory(false); }}
                        className="text-[#5A5650] hover:text-[#E85A6B]"
                      >
                        <X size={10} />
                      </button>
                    </div>
                    {queryHistory.map((q) => (
                      <button
                        key={q}
                        onMouseDown={(e) => { e.preventDefault(); runQuery(q); }}
                        className="block w-full px-2.5 py-1.5 text-left text-sm text-[#C5C0B8] hover:bg-[#232328] truncate"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#5A5650]">K:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={nResults}
                  onChange={(e) => setNResults(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="w-12 rounded border border-[#232328] bg-[#0E0E11] px-1.5 py-1.5 text-center text-sm text-[#E8E4DC] outline-none transition focus:border-[#C9A227]/50"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => runQuery()}
                disabled={queryLoading || !selectedCollection || !searchText.trim()}
              >
                {queryLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
                Query
              </Button>
            </div>
          </div>

          {/* Tab content */}
          {activeTab === "overview" && <OverviewSection overview={overview} />}
          {activeTab === "search" && <SearchSection searchResults={searchResults} queryLoading={queryLoading} searchText={searchText} />}
          {activeTab === "map" && <MapSection points={computedPoints} overview={overview} loadingEmbeddings={loadingEmbeddings} />}
        </div>
      )}
    </div>
  );
}

// ── Overview Section ─────────────────────────────────────────────────────────

function OverviewSection({ overview }: { overview: CollectionOverview }) {
  return (
    <div className="space-y-4">
      {/* Facets */}
      {overview.facets.length > 0 && (
        <Panel>
          <h3 className="mb-3 text-base font-semibold text-[#F0EDE8]">Facet Distribution</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {overview.facets.map((facet) => (
              <FacetCard key={facet.key} facet={facet} />
            ))}
          </div>
        </Panel>
      )}

      {/* Sample records */}
      <Panel>
        <h3 className="mb-3 text-base font-semibold text-[#F0EDE8]">
          Sample Records
          <span className="ml-2 text-sm font-normal text-[#5A5650]">
            ({overview.sampleRecords.length} sampled)
          </span>
        </h3>
        {overview.sampleRecords.length === 0 ? (
          <p className="text-sm text-[#5A5650]">No records in this collection.</p>
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
          <h3 className="mb-3 text-base font-semibold text-[#F0EDE8]">Collection Metadata</h3>
          <div className="space-y-1.5">
            {Object.entries(overview.collectionMetadata ?? {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded bg-[#0E0E11] px-2.5 py-1.5 text-sm">
                <span className="font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">{k}</span>
                <span className="text-[#8A857D]">{typeof v === "string" ? v : JSON.stringify(v)}</span>
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
  if (!searchResults && !queryLoading) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Search className="h-6 w-6 text-[#5A5650]" />
          <p className="text-sm text-[#8A857D]">Enter a query above and click Query to inspect retrieval results.</p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      {searchResults && (
        <div className="flex items-center gap-3 text-sm text-[#8A857D]">
          <span>Query: <span className="text-[#E8E4DC]">{searchText}</span></span>
          <span className="rounded bg-[#0E0E11] px-1.5 py-0.5 font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
            {searchResults.elapsedMs ?? "--"} ms
          </span>
          <span>{searchResults.items.length} results</span>
        </div>
      )}

      {queryLoading && (
        <div className="flex items-center gap-2 text-sm text-[#8A857D]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Querying...
        </div>
      )}

      {/* Result cards */}
      {(searchResults?.items ?? []).map((item, index) => (
        <Panel key={`${item.id}_${index}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded bg-[#2DD4BF]/15 px-1.5 py-0.5 text-xs font-medium text-[#2DD4BF]">
                  #{index + 1}
                </span>
                <span className="truncate font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650]">{item.id}</span>
              </div>
              <p className="line-clamp-3 text-sm leading-relaxed text-[#C5C0B8]">
                {item.document || "No document returned."}
              </p>
            </div>
            <div className="shrink-0 rounded bg-[#0E0E11] px-2.5 py-1.5 text-center">
              <div className="text-xs text-[#5A5650]">distance</div>
              <div className="font-['IBM_Plex_Mono',monospace] text-sm font-medium text-[#F0EDE8]">
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

// ── Map Section ──────────────────────────────────────────────────────────────

function MapSection({ points, overview, loadingEmbeddings }: { points: ProjectionPoint[]; overview: CollectionOverview; loadingEmbeddings: boolean }) {
  const [colorKey, setColorKey] = useState<string>(overview.metadataKeys[0] ?? "");
  const palette = useMemo(() => buildPalette(points, colorKey), [points, colorKey]);
  const [selectedPoint, setSelectedPoint] = useState<ProjectionPoint | null>(null);

  useEffect(() => {
    if (!overview.metadataKeys.includes(colorKey)) setColorKey(overview.metadataKeys[0] ?? "");
  }, [overview.metadataKeys, colorKey]);

  if (loadingEmbeddings || points.length < 3) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          {loadingEmbeddings ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-[#C9A227]" />
              <div>
                <p className="text-sm font-medium text-[#C5C0B8]">Loading embeddings</p>
                <p className="mt-1 text-sm text-[#5A5650]">
                  Fetching vectors for UMAP projection...
                </p>
              </div>
            </>
          ) : (
            <>
              <Radar className="h-6 w-6 text-[#5A5650]" />
              <div>
                <p className="text-sm font-medium text-[#8A857D]">Insufficient embeddings</p>
                <p className="mt-1 text-sm text-[#5A5650]">
                  At least 3 records with embeddings needed for UMAP projection.
                </p>
              </div>
            </>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#F0EDE8]">2D Semantic Map</h3>
          {overview.metadataKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5A5650]">Color by</span>
              <select
                value={colorKey}
                onChange={(e) => setColorKey(e.target.value)}
                className="rounded border border-[#232328] bg-[#0E0E11] px-2 py-1 text-sm text-[#E8E4DC] outline-none focus:border-[#C9A227]/50"
              >
                {overview.metadataKeys.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <ScatterPlot points={points} colorKey={colorKey} palette={palette} onSelect={setSelectedPoint} />
      </Panel>

      <div className="space-y-4">
        {/* Legend */}
        <Panel>
          <h3 className="mb-2 text-sm font-semibold text-[#8A857D]">Legend</h3>
          <div className="space-y-1.5">
            {palette.map((entry) => (
              <div key={entry.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-[#C5C0B8]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                  <span className="truncate">{entry.label}</span>
                </div>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#5A5650]">{entry.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Selected point */}
        <Panel>
          <h3 className="mb-2 text-sm font-semibold text-[#8A857D]">Selected Point</h3>
          {selectedPoint ? (
            <div className="space-y-2">
              <div className="font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF]">{selectedPoint.id}</div>
              <p className="line-clamp-4 text-sm leading-relaxed text-[#C5C0B8]">
                {selectedPoint.document || "No document available."}
              </p>
              {selectedPoint.metadata && Object.keys(selectedPoint.metadata).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedPoint.metadata).map(([k, v]) => (
                    <MetadataTag key={k} k={k} v={v} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#5A5650]">Click a point on the map to inspect.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── Scatter Plot ─────────────────────────────────────────────────────────────

function ScatterPlot({ points, colorKey, palette, onSelect }: {
  points: ProjectionPoint[];
  colorKey: string;
  palette: Array<{ label: string; color: string; count: number }>;
  onSelect: (point: ProjectionPoint) => void;
}) {
  const width = 900;
  const height = 480;
  const padding = 28;
  const [hovered, setHovered] = useState<ProjectionPoint | null>(null);

  const xVals = points.map((p) => p.x);
  const yVals = points.map((p) => p.y);
  const minX = Math.min(...xVals, 0);
  const maxX = Math.max(...xVals, 1);
  const minY = Math.min(...yVals, 0);
  const maxY = Math.max(...yVals, 1);
  const xScale = (x: number) => padding + ((x - minX) / Math.max(1e-8, maxX - minX)) * (width - padding * 2);
  const yScale = (y: number) => height - padding - ((y - minY) / Math.max(1e-8, maxY - minY)) * (height - padding * 2);
  const colorMap = new Map(palette.map((p) => [p.label, p.color]));

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#232328] bg-[#0A0A0F]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />
      <svg viewBox={`0 0 ${width} ${height}`} className="relative z-10 h-[480px] w-full">
        {points.map((point, idx) => {
          const value = compact(point.metadata?.[colorKey] ?? "unknown");
          const fill = colorMap.get(value) ?? "#5A5650";
          const isHovered = hovered?.id === point.id;
          return (
            <circle
              key={`${point.id}_${idx}`}
              cx={xScale(point.x)}
              cy={yScale(point.y)}
              r={5}
              fill={fill}
              fillOpacity={isHovered ? 1 : 0.75}
              stroke={isHovered ? "#F0EDE8" : "rgba(255,255,255,0.1)"}
              strokeWidth={isHovered ? 2 : 0.5}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHovered(point)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(point)}
            />
          );
        })}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-xs rounded border border-[#232328] bg-[#151518]/95 p-2.5 shadow-xl backdrop-blur">
          <div className="font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF]">{hovered.id}</div>
          <div className="mt-1 line-clamp-2 text-sm text-[#C5C0B8]">{hovered.document || "No document."}</div>
        </div>
      )}
    </div>
  );
}

// ── UMAP Hook ────────────────────────────────────────────────────────────────

function useUmapProjection(records: SampleRecord[]): ProjectionPoint[] {
  const [points, setPoints] = useState<ProjectionPoint[]>([]);

  useEffect(() => {
    let active = true;
    const withEmbeddings = records.filter(
      (r): r is SampleRecord & { embedding: number[] } =>
        Array.isArray(r.embedding) && r.embedding.length > 1
    );

    if (withEmbeddings.length < 3) {
      setPoints([]);
      return;
    }

    import("umap-js")
      .then(({ UMAP }) => {
        if (!active) return;
        try {
          const umap = new UMAP({
            nNeighbors: Math.min(12, withEmbeddings.length - 1),
            minDist: 0.18,
            nComponents: 2,
          });
          const projection = umap.fit(withEmbeddings.map((r) => r.embedding));
          if (!active) return;
          setPoints(
            projection.map((coords: number[], i: number) => ({
              id: withEmbeddings[i].id,
              x: coords[0],
              y: coords[1],
              document: withEmbeddings[i].document,
              metadata: withEmbeddings[i].metadata,
            }))
          );
        } catch {
          if (!active) return;
          setPoints(circularLayout(withEmbeddings));
        }
      })
      .catch(() => {
        if (!active) return;
        setPoints(circularLayout(withEmbeddings));
      });

    return () => { active = false; };
  }, [records]);

  return points;
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function FacetCard({ facet }: { facet: MetadataFacet }) {
  const max = Math.max(...facet.values.map((v) => v.count), 1);
  return (
    <div className="rounded border border-[#232328] bg-[#0E0E11] p-3">
      <div className="mb-2 text-sm font-medium text-[#C5C0B8]">{facet.key}</div>
      <div className="space-y-2">
        {facet.values.map((entry) => (
          <div key={entry.label}>
            <div className="mb-0.5 flex items-center justify-between text-xs text-[#5A5650]">
              <span className="truncate">{entry.label}</span>
              <span>{entry.count}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[#232328]">
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
  return (
    <div className="rounded border border-[#232328] bg-[#0E0E11] p-3">
      <div className="mb-1.5 font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF] truncate">
        {record.id}
      </div>
      <p className="line-clamp-2 text-sm leading-relaxed text-[#8A857D]">
        {record.document || "No document text available."}
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
    <span className="inline-flex rounded bg-[#232328] px-1.5 py-0.5 text-xs text-[#5A5650]">
      <span className="text-[#8A857D]">{k}:</span>
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
  return new Intl.NumberFormat().format(value);
}

function circularLayout(records: Array<{ id: string; document?: string | null; metadata?: Record<string, Json> | null }>): ProjectionPoint[] {
  return records.map((r, i) => ({
    id: r.id,
    x: Math.cos((i * 2 * Math.PI) / records.length),
    y: Math.sin((i * 2 * Math.PI) / records.length),
    document: r.document,
    metadata: r.metadata,
  }));
}

function buildPalette(points: ProjectionPoint[], colorKey: string) {
  const counts = new Map<string, number>();
  for (const point of points) {
    const label = compact(point.metadata?.[colorKey] ?? "unknown");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], index) => ({
      label,
      count,
      color: PALETTE_COLORS[index % PALETTE_COLORS.length],
    }));
}
