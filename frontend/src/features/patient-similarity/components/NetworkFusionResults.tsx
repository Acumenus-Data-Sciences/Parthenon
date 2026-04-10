import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNetworkFusion } from "../hooks/usePatientSimilarity";
import type {
  NetworkFusionResult,
  NetworkFusionEdge,
  NetworkFusionCommunity,
  ModalityContribution,
} from "../types/patientSimilarity";

// Community color palette (8 distinct colors for dark theme)
const COMMUNITY_COLORS = [
  "#2DD4BF", // teal
  "#C9A227", // gold
  "#9B1B30", // crimson
  "#6366F1", // indigo
  "#F97316", // orange
  "#A78BFA", // violet
  "#34D399", // emerald
  "#FB7185", // rose
];

function communityColor(id: number): string {
  return COMMUNITY_COLORS[id % COMMUNITY_COLORS.length];
}

// ── MDS Layout ────────────────────────────────────────────────────

interface NodePosition {
  x: number;
  y: number;
  personId: number;
  communityId: number;
}

function computeMdsLayout(
  edges: NetworkFusionEdge[],
  communities: NetworkFusionCommunity[],
  nPatients: number,
): NodePosition[] {
  // Build person list and community lookup
  const personSet = new Set<number>();
  for (const e of edges) {
    personSet.add(e.person_a);
    personSet.add(e.person_b);
  }
  for (const c of communities) {
    for (const m of c.member_ids) {
      personSet.add(m);
    }
  }
  const persons = Array.from(personSet);
  const n = persons.length;
  const idx = new Map<number, number>();
  persons.forEach((p, i) => idx.set(p, i));

  const communityLookup = new Map<number, number>();
  for (const c of communities) {
    for (const m of c.member_ids) {
      communityLookup.set(m, c.id);
    }
  }

  if (n < 2) {
    return persons.map((p) => ({
      x: 200,
      y: 200,
      personId: p,
      communityId: communityLookup.get(p) ?? 0,
    }));
  }

  // Build distance matrix from edges (default distance = 1 for unconnected pairs)
  const dist = Array.from({ length: n }, () => new Float64Array(n).fill(1.0));
  for (let i = 0; i < n; i++) dist[i][i] = 0;
  for (const e of edges) {
    const i = idx.get(e.person_a);
    const j = idx.get(e.person_b);
    if (i !== undefined && j !== undefined) {
      const d = 1.0 - e.similarity;
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  // Classical MDS: double-center distance matrix, eigendecompose
  // B = -0.5 * H * D^2 * H where H = I - (1/n)*ones
  const dsq = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => dist[i][j] * dist[i][j]),
  );

  const rowMeans = dsq.map((row) => row.reduce((a, b) => a + b, 0) / n);
  const colMeans = Array.from({ length: n }, (_, j) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += dsq[i][j];
    return s / n;
  });
  let grandMean = 0;
  for (let i = 0; i < n; i++) grandMean += rowMeans[i];
  grandMean /= n;

  const B = Array.from({ length: n }, (_, i) =>
    Array.from(
      { length: n },
      (_, j) => -0.5 * (dsq[i][j] - rowMeans[i] - colMeans[j] + grandMean),
    ),
  );

  // Power iteration for top 2 eigenvectors (sufficient for layout)
  const coords: number[][] = [];
  for (let dim = 0; dim < 2; dim++) {
    let v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = Math.random();

    for (let iter = 0; iter < 100; iter++) {
      const Bv = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += B[i][j] * v[j];
        Bv[i] = s;
      }

      // Remove components from previous eigenvectors
      for (let prev = 0; prev < dim; prev++) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += Bv[i] * coords[prev][i];
        for (let i = 0; i < n; i++) Bv[i] -= dot * coords[prev][i];
      }

      let norm = 0;
      for (let i = 0; i < n; i++) norm += Bv[i] * Bv[i];
      norm = Math.sqrt(norm);
      if (norm > 1e-10) {
        for (let i = 0; i < n; i++) Bv[i] /= norm;
      }
      v = Bv;
    }
    coords.push(Array.from(v));
  }

  // Scale to 400x400 viewport with margin
  const margin = 30;
  const size = 400 - 2 * margin;
  const xs = coords[0];
  const ys = coords[1];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  return persons.map((p, i) => ({
    x: margin + ((xs[i] - xMin) / xRange) * size,
    y: margin + ((ys[i] - yMin) / yRange) * size,
    personId: p,
    communityId: communityLookup.get(p) ?? 0,
  }));
}

// ── Community Cards ───────────────────────────────────────────────

function CommunityCards({
  communities,
}: {
  communities: NetworkFusionCommunity[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {communities.map((c) => (
        <div
          key={c.id}
          className="rounded-lg border border-[#232328] bg-[#151518] p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: communityColor(c.id) }}
            />
            <span className="text-xs font-semibold text-[#C5C0B8]">
              Community {c.id + 1}
            </span>
          </div>
          <p className="text-lg font-bold text-[#F0EDE8]">{c.size}</p>
          <p className="text-[10px] text-[#5A5650]">patients</p>
        </div>
      ))}
    </div>
  );
}

// ── Network Graph (SVG) ──────────────────────────────────────────

const MAX_RENDER_NODES = 500;
const MAX_RENDER_EDGES = 2000;

function NetworkGraph({
  edges,
  communities,
  nPatients,
}: {
  edges: NetworkFusionEdge[];
  communities: NetworkFusionCommunity[];
  nPatients: number;
}) {
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const { positions, renderEdges } = useMemo(() => {
    const cappedEdges =
      edges.length > MAX_RENDER_EDGES
        ? edges.slice(0, MAX_RENDER_EDGES)
        : edges;
    const pos = computeMdsLayout(cappedEdges, communities, nPatients);
    const cappedPositions =
      pos.length > MAX_RENDER_NODES ? pos.slice(0, MAX_RENDER_NODES) : pos;
    return { positions: cappedPositions, renderEdges: cappedEdges };
  }, [edges, communities, nPatients]);

  const posMap = useMemo(() => {
    const m = new Map<number, NodePosition>();
    for (const p of positions) m.set(p.personId, p);
    return m;
  }, [positions]);

  const handleMouseEnter = useCallback((personId: number) => {
    setHoveredNode(personId);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  return (
    <div className="relative">
      <svg viewBox="0 0 400 400" className="w-full max-w-lg mx-auto">
        <rect width="400" height="400" fill="#0E0E11" rx="8" />
        {/* Edges */}
        {renderEdges.map((e, i) => {
          const a = posMap.get(e.person_a);
          const b = posMap.get(e.person_b);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#5A5650"
              strokeOpacity={Math.max(0.05, e.similarity * 0.4)}
              strokeWidth={0.5}
            />
          );
        })}
        {/* Nodes */}
        {positions.map((p) => (
          <circle
            key={p.personId}
            cx={p.x}
            cy={p.y}
            r={hoveredNode === p.personId ? 6 : 4}
            fill={communityColor(p.communityId)}
            fillOpacity={0.85}
            stroke={
              hoveredNode === p.personId ? "#F0EDE8" : "none"
            }
            strokeWidth={hoveredNode === p.personId ? 1.5 : 0}
            className="cursor-pointer"
            onMouseEnter={() => handleMouseEnter(p.personId)}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </svg>
      {hoveredNode !== null && (
        <div className="absolute top-2 right-2 rounded bg-[#232328] border border-[#323238] px-2 py-1 text-xs text-[#C5C0B8]">
          Person: {hoveredNode}
        </div>
      )}
    </div>
  );
}

// ── Modality Contribution Bars ───────────────────────────────────

function ModalityBars({
  contributions,
}: {
  contributions: ModalityContribution[];
}) {
  const maxWeight = Math.max(...contributions.map((c) => c.weight), 0.01);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-[#8A857D] uppercase tracking-wider">
        Modality Contributions
      </h4>
      {contributions.map((c) => (
        <div key={c.modality} className="flex items-center gap-2">
          <span className="w-24 text-xs text-[#C5C0B8] capitalize">
            {c.modality}
          </span>
          <div className="flex-1 h-4 bg-[#1A1A1F] rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${(c.weight / maxWeight) * 100}%`,
                backgroundColor: "#2DD4BF",
              }}
            />
          </div>
          <span className="w-12 text-xs text-[#5A5650] text-right">
            {(c.weight * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

interface NetworkFusionResultsProps {
  sourceId: number;
  cohortDefinitionId: number;
}

export function NetworkFusionResults({
  sourceId,
  cohortDefinitionId,
}: NetworkFusionResultsProps) {
  const snfMutation = useNetworkFusion();
  const result: NetworkFusionResult | undefined = snfMutation.data;

  const handleRun = useCallback(() => {
    snfMutation.mutate({
      source_id: sourceId,
      cohort_definition_id: cohortDefinitionId,
    });
  }, [sourceId, cohortDefinitionId, snfMutation]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Similarity Network Fusion
          </h3>
          <p className="text-xs text-[#5A5650] mt-0.5">
            Multi-modal patient similarity via iterative network diffusion
            across conditions, drugs, procedures, and labs
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={snfMutation.isPending}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
            snfMutation.isPending
              ? "text-[#5A5650] border-[#232328] cursor-wait"
              : "text-[#2DD4BF] border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/10 cursor-pointer",
          )}
        >
          {snfMutation.isPending ? "Computing..." : "Run Network Fusion"}
        </button>
      </div>

      {/* Error */}
      {snfMutation.isError && (
        <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
          <p className="text-sm text-[#E85A6B]">
            {(() => {
              const err = snfMutation.error;
              if (typeof err === "object" && err !== null && "response" in err) {
                const resp = (err as Record<string, unknown>).response;
                if (typeof resp === "object" && resp !== null && "data" in resp) {
                  const data = (resp as Record<string, unknown>).data;
                  if (typeof data === "object" && data !== null) {
                    if ("error" in data && typeof (data as Record<string, unknown>).error === "string") {
                      return (data as Record<string, string>).error;
                    }
                    if ("detail" in data && typeof (data as Record<string, unknown>).detail === "string") {
                      return (data as Record<string, string>).detail;
                    }
                  }
                }
              }
              return "Network fusion failed.";
            })()}
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Capped warning */}
          {result.capped_at != null && (
            <div className="rounded-lg border border-[#C9A227]/20 bg-[#C9A227]/5 px-4 py-2">
              <p className="text-xs text-[#C9A227]">
                Cohort capped at {result.capped_at} patients for
                computational feasibility.
              </p>
            </div>
          )}

          {/* Community cards */}
          <CommunityCards communities={result.communities} />

          {/* Graph + contributions side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#232328] bg-[#151518] p-3">
              <h4 className="text-xs font-semibold text-[#8A857D] uppercase tracking-wider mb-2">
                Fused Network
              </h4>
              <NetworkGraph
                edges={result.edges}
                communities={result.communities}
                nPatients={result.n_patients}
              />
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#151518] p-3">
              <ModalityBars contributions={result.modality_contributions} />
            </div>
          </div>

          {/* Convergence info */}
          <p className="text-xs text-[#5A5650]">
            Converged in {result.convergence.iterations} iterations (delta:{" "}
            {result.convergence.final_delta.toExponential(2)}) | {result.n_patients} patients |{" "}
            {result.edges.length} edges | {result.communities.length} communities
          </p>
        </div>
      )}
    </div>
  );
}
