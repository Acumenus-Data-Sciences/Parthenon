import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Database,
  Filter,
  Layers3,
  Binary,
  FileText,
  CircleDot,
  Loader2,
  AlertCircle,
  BarChart3,
  Radar,
  Eye,
  Wand2,
  Upload,
  Sparkles,
  BookOpen,
  Stethoscope,
  MessageSquare,
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

// ── Admin Actions ────────────────────────────────────────────────────────────

const ADMIN_ACTIONS = [
  { key: "ingest-docs", label: "Ingest Docs", icon: Upload, fn: () => ingestDocs() },
  { key: "ingest-clinical", label: "Ingest Clinical", icon: Stethoscope, fn: () => ingestClinical() },
  { key: "promote-faq", label: "Promote FAQ", icon: MessageSquare, fn: () => promoteFaq() },
] as const;

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

  useEffect(() => {
    let cancelled = false;
    setLoadingCollections(true);
    fetchCollections()
      .then((data) => {
        if (cancelled) return;
        setCollections(data);
        if (data.length > 0 && !selectedCollection) {
          setSelectedCollection(data[0].name);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(normalizeError(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingCollections(false);
      });
    return () => { cancelled = true; };
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

  // Embeddings are fetched on-demand only when the Map tab is active
  const [embeddingRecords, setEmbeddingRecords] = useState<CollectionOverview["sampleRecords"]>([]);
  const [embeddingsLoaded, setEmbeddingsLoaded] = useState(false);

  useEffect(() => {
    if (activeTab !== "map" || !selectedCollection || embeddingsLoaded) return;
    let cancelled = false;
    fetchCollectionOverview(selectedCollection, true)
      .then((data) => {
        if (!cancelled) {
          setEmbeddingRecords(data.sampleRecords);
          setEmbeddingsLoaded(true);
        }
      })
      .catch(() => { /* overview already loaded, map just won't render */ });
    return () => { cancelled = true; };
  }, [activeTab, selectedCollection, embeddingsLoaded]);

  // Reset embedding cache when collection changes
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

  async function runQuery() {
    if (!selectedCollection || !searchText.trim()) return;
    setQueryLoading(true);
    setError(null);
    try {
      const response = await queryCollection({
        collectionName: selectedCollection,
        queryText: searchText,
        nResults,
      });
      setSearchResults(response);
      setActiveTab("search");
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
      // Refresh collections after action
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

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "search" as const, label: "Retrieval Inspector", icon: <Eye className="h-4 w-4" /> },
    { key: "map" as const, label: "Semantic Map", icon: <Radar className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Vector Knowledge Base
          </div>
          <h2 className="text-xl font-semibold text-foreground">Chroma Collection Studio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspect embeddings, retrieval quality, metadata health, and semantic topology.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
          >
            {loadingCollections ? <option>Loading...</option> : null}
            {collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.count != null ? `(${c.count.toLocaleString()})` : ""}
              </option>
            ))}
          </select>
          {ADMIN_ACTIONS.map((action) => (
            <Button
              key={action.key}
              variant="secondary"
              size="sm"
              onClick={() => runAction(action.key, action.fn)}
              disabled={actionLoading !== null}
            >
              {actionLoading === action.key
                ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                : <action.icon className="mr-1 h-4 w-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Action result */}
      {actionResult && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm text-green-300">
          <Sparkles className="h-4 w-4 shrink-0" />
          {actionResult}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-medium">Something went wrong</div>
            <div className="mt-1 text-sm opacity-90">{error}</div>
          </div>
        </div>
      )}

      {/* Tab bar + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runQuery()}
              placeholder="Semantic query..."
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">K:</label>
            <input
              type="number"
              min={1}
              max={50}
              value={nResults}
              onChange={(e) => setNResults(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-14 rounded-lg border border-border bg-card px-2 py-2 text-center text-sm text-foreground outline-none transition focus:border-primary/50"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={runQuery}
            disabled={queryLoading || !selectedCollection || !searchText.trim()}
          >
            {queryLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
            Query
          </Button>
        </div>
      </div>

      {/* Content */}
      {loadingOverview ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-muted" />
          ))}
        </div>
      ) : !overview || !stats ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium text-foreground">No collection selected</h3>
              <p className="mt-1 text-sm text-muted-foreground">Select a collection to explore its contents.</p>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab overview={overview} stats={stats} />}
          {activeTab === "search" && (
            <SearchTab
              searchResults={searchResults}
              queryLoading={queryLoading}
              searchText={searchText}
              onRunQuery={runQuery}
            />
          )}
          {activeTab === "map" && (
            <MapTab points={computedPoints} overview={overview} />
          )}
        </>
      )}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ overview, stats }: { overview: CollectionOverview; stats: { totalVectors: number; sampleCount: number; dimension: number | null; metadataFieldCount: number; avgDocLength: number } }) {
  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total vectors" value={fmt(stats.totalVectors)} icon={<Binary className="h-4 w-4" />} />
        <StatCard label="Sampled" value={fmt(stats.sampleCount)} icon={<CircleDot className="h-4 w-4" />} />
        <StatCard label="Dimensions" value={stats.dimension ? fmt(stats.dimension) : "—"} icon={<Radar className="h-4 w-4" />} />
        <StatCard label="Metadata fields" value={fmt(stats.metadataFieldCount)} icon={<Filter className="h-4 w-4" />} />
      </div>

      {/* Facets + health */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <Panel>
          <SectionTitle icon={<BarChart3 className="h-4 w-4" />}>Facet Distribution</SectionTitle>
          {overview.facets.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No metadata facets found in sample.</p>
          ) : (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {overview.facets.map((facet) => (
                <FacetCard key={facet.key} facet={facet} />
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle icon={<Wand2 className="h-4 w-4" />}>Health Summary</SectionTitle>
          <div className="mt-3 space-y-3">
            <InsightRow title="Collection size" description={`${fmt(stats.totalVectors)} total vectors with ${fmt(stats.sampleCount)} sampled for diagnostics.`} />
            <InsightRow title="Embedding footprint" description={stats.dimension ? `${fmt(stats.dimension)}-dimensional embeddings.` : "Dimension not available."} />
            <InsightRow title="Metadata richness" description={`${stats.metadataFieldCount} metadata field${stats.metadataFieldCount !== 1 ? "s" : ""} across the sample set.`} />
            <InsightRow title="Chunk profile" description={`Average document length: ${fmt(stats.avgDocLength)} characters.`} />
          </div>
        </Panel>
      </div>

      {/* Sample records + collection metadata */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel>
          <SectionTitle icon={<FileText className="h-4 w-4" />}>Sample Records</SectionTitle>
          <div className="mt-3 space-y-3">
            {overview.sampleRecords.slice(0, 8).map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
            {overview.sampleRecords.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No records in this collection.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={<Layers3 className="h-4 w-4" />}>Collection Metadata</SectionTitle>
          <div className="mt-3 space-y-2 text-sm">
            {Object.entries(overview.collectionMetadata ?? {}).length ? (
              Object.entries(overview.collectionMetadata ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card/50 px-3 py-2.5">
                  <span className="shrink-0 font-mono text-xs text-primary">{k}</span>
                  <span className="min-w-0 text-right text-muted-foreground">{typeof v === "string" ? v : JSON.stringify(v)}</span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-muted-foreground">
                No collection metadata available.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ── Search Tab ───────────────────────────────────────────────────────────────

function SearchTab({ searchResults, queryLoading, searchText, onRunQuery }: {
  searchResults: QueryResponse | null;
  queryLoading: boolean;
  searchText: string;
  onRunQuery: () => void;
}) {
  if (!searchResults && !queryLoading) {
    return (
      <Panel>
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="rounded-full border border-primary/20 bg-primary/10 p-4 text-primary">
            <Search className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">Run a retrieval inspection</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Execute a semantic query and inspect returned chunks, metadata, and distance scores.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={onRunQuery}>
            <Search className="mr-1 h-4 w-4" /> Run Query
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {/* Query summary */}
      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Query</div>
            <div className="mt-1 text-lg font-medium text-foreground">{searchText}</div>
          </div>
          <div className="flex items-center gap-2">
            {queryLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <Badge variant="default">{searchResults?.elapsedMs ? `${searchResults.elapsedMs} ms` : "—"}</Badge>
            <Badge variant="default">{searchResults?.items.length ?? 0} results</Badge>
          </div>
        </div>
      </Panel>

      {/* Results */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {(searchResults?.items ?? []).map((item, index) => (
            <Panel key={`${item.id}_${index}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="success">rank {index + 1}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {item.document || "No document returned."}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">distance</div>
                  <div className="mt-1 text-base font-semibold text-foreground">
                    {typeof item.distance === "number" ? item.distance.toFixed(4) : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(item.metadata ?? {}).map(([k, v]) => (
                  <MetadataTag key={k} k={k} v={v} />
                ))}
              </div>
            </Panel>
          ))}
        </div>

        <Panel>
          <SectionTitle icon={<BookOpen className="h-4 w-4" />}>Interpretation Guide</SectionTitle>
          <div className="mt-3 space-y-3">
            <InsightRow title="Distance inspection" description="Lower distances indicate tighter semantic matches. Track spread across top-k to detect ambiguous retrieval." />
            <InsightRow title="Metadata alignment" description="Check whether returned chunks share expected source, topic, or cohort tags." />
            <InsightRow title="Chunk quality" description="If relevant passages mix with unrelated text, improve chunking before changing ranking." />
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ── Map Tab ──────────────────────────────────────────────────────────────────

function MapTab({ points, overview }: { points: ProjectionPoint[]; overview: CollectionOverview }) {
  const [colorKey, setColorKey] = useState<string>(overview.metadataKeys[0] ?? "");
  const palette = useMemo(() => buildPalette(points, colorKey), [points, colorKey]);
  const [selectedPoint, setSelectedPoint] = useState<ProjectionPoint | null>(null);

  useEffect(() => {
    if (!overview.metadataKeys.includes(colorKey)) setColorKey(overview.metadataKeys[0] ?? "");
  }, [overview.metadataKeys, colorKey]);

  if (points.length < 3) {
    return (
      <Panel>
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Radar className="h-8 w-8 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-medium text-foreground">Insufficient embeddings</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              At least 3 records with embeddings are needed for UMAP projection.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <SectionTitle icon={<Radar className="h-4 w-4" />}>2D Semantic Map</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              UMAP projection of sampled embeddings. Color by metadata to spot clusters.
            </p>
          </div>
          {overview.metadataKeys.length > 0 && (
            <div className="w-full md:w-48">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Color by</label>
              <select
                value={colorKey}
                onChange={(e) => setColorKey(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
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

      <div className="space-y-5">
        <Panel>
          <SectionTitle icon={<Layers3 className="h-4 w-4" />}>Legend</SectionTitle>
          <div className="mt-3 space-y-2">
            {palette.map((entry) => (
              <div key={entry.label} className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <span className="h-3 w-3 rounded-full" style={{ background: entry.color }} />
                  <span className="truncate">{entry.label}</span>
                </div>
                <span className="text-muted-foreground">{entry.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle icon={<CircleDot className="h-4 w-4" />}>Selected Point</SectionTitle>
          {selectedPoint ? (
            <div className="mt-3 space-y-3">
              <div className="font-mono text-xs text-primary">{selectedPoint.id}</div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {selectedPoint.document || "No document available."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(selectedPoint.metadata ?? {}).map(([k, v]) => (
                  <MetadataTag key={k} k={k} v={v} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Click a point on the map to inspect it.
            </div>
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
  const width = 980;
  const height = 560;
  const padding = 32;
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
    <div className="relative overflow-hidden rounded-lg border border-border bg-[#0A0A0F]">
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />
      <svg viewBox={`0 0 ${width} ${height}`} className="relative z-10 h-[560px] w-full">
        {points.map((point, idx) => {
          const value = compact(point.metadata?.[colorKey] ?? "unknown");
          const fill = colorMap.get(value) ?? "#94a3b8";
          const isHovered = hovered?.id === point.id;
          return (
            <circle
              key={`${point.id}_${idx}`}
              cx={xScale(point.x)}
              cy={yScale(point.y)}
              r={5.5}
              fill={fill}
              fillOpacity={isHovered ? 1 : 0.8}
              stroke={isHovered ? "white" : "rgba(255,255,255,0.15)"}
              strokeWidth={isHovered ? 2 : 1}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHovered(point)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(point)}
            />
          );
        })}
      </svg>
      {/* Hover tooltip */}
      {hovered && (
        <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-sm rounded-lg border border-border bg-card/95 p-3 shadow-2xl backdrop-blur">
          <div className="font-mono text-xs text-primary">{hovered.id}</div>
          <div className="mt-1 line-clamp-3 text-sm text-foreground/90">{hovered.document || "No document."}</div>
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

    // Dynamic import to avoid bundling umap-js if unused
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
          // Fallback: circular layout
          if (!active) return;
          setPoints(
            withEmbeddings.map((r, i) => ({
              id: r.id,
              x: Math.cos((i * 2 * Math.PI) / withEmbeddings.length),
              y: Math.sin((i * 2 * Math.PI) / withEmbeddings.length),
              document: r.document,
              metadata: r.metadata,
            }))
          );
        }
      })
      .catch(() => {
        // umap-js not installed — use circular fallback
        if (!active) return;
        setPoints(
          withEmbeddings.map((r, i) => ({
            id: r.id,
            x: Math.cos((i * 2 * Math.PI) / withEmbeddings.length),
            y: Math.sin((i * 2 * Math.PI) / withEmbeddings.length),
            document: r.document,
            metadata: r.metadata,
          }))
        );
      });

    return () => { active = false; };
  }, [records]);

  return points;
}

// ── Shared Sub-Components ────────────────────────────────────────────────────

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className="text-primary">{icon}</span>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-primary">{icon}</div>
      </div>
    </Panel>
  );
}

function FacetCard({ facet }: { facet: MetadataFacet }) {
  const max = Math.max(...facet.values.map((v) => v.count), 1);
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="mb-3 text-sm font-medium text-foreground">{facet.key}</div>
      <div className="space-y-2.5">
        {facet.values.map((entry) => (
          <div key={entry.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{entry.label}</span>
              <span>{entry.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-[#2DD4BF]"
                style={{ width: `${(entry.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </div>
  );
}

function RecordCard({ record }: { record: SampleRecord }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate font-mono text-xs text-primary">{record.id}</div>
        <Badge variant="default">sample</Badge>
      </div>
      <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">
        {record.document || "No document text available."}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(record.metadata ?? {})
          .slice(0, 5)
          .map(([k, v]) => (
            <MetadataTag key={k} k={k} v={v} />
          ))}
      </div>
    </div>
  );
}

function MetadataTag({ k, v }: { k: string; v: Json }) {
  return (
    <span className="inline-flex rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">{k}:</span>
      <span className="ml-1 truncate max-w-[200px]">{compact(v)}</span>
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

const PALETTE_COLORS = [
  "#9B1B30", // crimson (brand)
  "#2DD4BF", // teal (brand)
  "#C9A227", // gold (brand)
  "#60a5fa", // blue
  "#a78bfa", // purple
  "#f472b6", // pink
  "#f59e0b", // amber
  "#34d399", // emerald
  "#fb7185", // rose
  "#38bdf8", // sky
];

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
