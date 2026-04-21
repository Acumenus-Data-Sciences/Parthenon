import type {
  NetworkFusionResult,
  NetworkFusionEdge,
  NetworkFusionCommunity,
  ModalityContribution,
} from "../types/patientSimilarity";
import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

const COMMUNITY_COLORS = [
  "var(--success)", "var(--accent)", "var(--primary)", "var(--chart-4)", "var(--domain-device)",
  "var(--domain-observation)", "var(--chart-7)", "var(--chart-8)",
];

function communityColor(id: number): string {
  return COMMUNITY_COLORS[id % COMMUNITY_COLORS.length];
}

// ── MDS Layout (from NetworkFusionResults, inlined to avoid coupling) ──

interface NodePosition {
  x: number;
  y: number;
  personId: number;
  communityId: number;
}

function computeMdsLayout(
  edges: NetworkFusionEdge[],
  communities: NetworkFusionCommunity[],
): NodePosition[] {
  const personSet = new Set<number>();
  for (const e of edges) {
    personSet.add(e.person_a);
    personSet.add(e.person_b);
  }
  for (const c of communities) {
    for (const m of c.member_ids) personSet.add(m);
  }
  const persons = Array.from(personSet);
  const n = persons.length;
  const idx = new Map<number, number>();
  persons.forEach((p, i) => idx.set(p, i));

  const communityLookup = new Map<number, number>();
  for (const c of communities) {
    for (const m of c.member_ids) communityLookup.set(m, c.id);
  }

  if (n < 2) {
    return persons.map((p) => ({
      x: 200, y: 200, personId: p, communityId: communityLookup.get(p) ?? 0,
    }));
  }

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
    Array.from({ length: n }, (_, j) => -0.5 * (dsq[i][j] - rowMeans[i] - colMeans[j] + grandMean)),
  );

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
      for (let prev = 0; prev < dim; prev++) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += Bv[i] * coords[prev][i];
        for (let i = 0; i < n; i++) Bv[i] -= dot * coords[prev][i];
      }
      let norm = 0;
      for (let i = 0; i < n; i++) norm += Bv[i] * Bv[i];
      norm = Math.sqrt(norm);
      if (norm > 1e-10) for (let i = 0; i < n; i++) Bv[i] /= norm;
      v = Bv;
    }
    coords.push(Array.from(v));
  }

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

// ── Network Graph ────────────────────────────────────────────────

const MAX_RENDER_NODES = 500;
const MAX_RENDER_EDGES = 2000;

function NetworkGraph({ edges, communities }: { edges: NetworkFusionEdge[]; communities: NetworkFusionCommunity[] }) {
  const { t } = useTranslation("app");
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const { positions, renderEdges } = useMemo(() => {
    const cappedEdges = edges.length > MAX_RENDER_EDGES ? edges.slice(0, MAX_RENDER_EDGES) : edges;
    const pos = computeMdsLayout(cappedEdges, communities);
    const cappedPositions = pos.length > MAX_RENDER_NODES ? pos.slice(0, MAX_RENDER_NODES) : pos;
    return { positions: cappedPositions, renderEdges: cappedEdges };
  }, [edges, communities]);

  const posMap = useMemo(() => {
    const m = new Map<number, NodePosition>();
    for (const p of positions) m.set(p.personId, p);
    return m;
  }, [positions]);

  const handleMouseEnter = useCallback((personId: number) => setHoveredNode(personId), []);
  const handleMouseLeave = useCallback(() => setHoveredNode(null), []);

  return (
    <div className="relative">
      <svg viewBox="0 0 400 400" className="w-full max-w-lg mx-auto">
        <rect width="400" height="400" fill="var(--surface-base)" rx="8" />
        {renderEdges.map((e, i) => {
          const a = posMap.get(e.person_a);
          const b = posMap.get(e.person_b);
          if (!a || !b) return null;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="var(--text-ghost)" strokeOpacity={Math.max(0.05, e.similarity * 0.4)} strokeWidth={0.5} />
          );
        })}
        {positions.map((p) => (
          <circle key={p.personId} cx={p.x} cy={p.y}
            r={hoveredNode === p.personId ? 6 : 4}
            fill={communityColor(p.communityId)} fillOpacity={0.85}
            stroke={hoveredNode === p.personId ? "var(--text-primary)" : "none"}
            strokeWidth={hoveredNode === p.personId ? 1.5 : 0}
            className="cursor-pointer"
            onMouseEnter={() => handleMouseEnter(p.personId)}
            onMouseLeave={handleMouseLeave} />
        ))}
      </svg>
      {hoveredNode !== null && (
        <div className="absolute top-2 right-2 rounded bg-surface-elevated border border-surface-highlight px-2 py-1 text-xs text-text-secondary">
          {t("patientSimilarity.networkFusion.person", { id: hoveredNode })}
        </div>
      )}
    </div>
  );
}

// ── Modality Bars ────────────────────────────────────────────────

function ModalityBars({ contributions }: { contributions: ModalityContribution[] }) {
  const maxWeight = Math.max(...contributions.map((c) => c.weight), 0.01);

  return (
    <div className="space-y-2">
      {contributions.map((c) => (
        <div key={c.modality} className="flex items-center gap-2">
          <span className="w-24 text-xs text-text-secondary capitalize">{c.modality}</span>
          <div className="flex-1 h-4 bg-surface-overlay rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{ width: `${(c.weight / maxWeight) * 100}%`, backgroundColor: "var(--success)" }}
            />
          </div>
          <span className="w-12 text-xs text-text-ghost text-right">{(c.weight * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────

interface NetworkFusionPanelProps {
  result: NetworkFusionResult;
}

export function NetworkFusionPanel({ result }: NetworkFusionPanelProps) {
  const { t } = useTranslation("app");
  return (
    <div className="space-y-4 p-4">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">{t("patientSimilarity.networkFusion.communities")}</p>
          <p className="text-xl font-bold text-text-primary mt-0.5">{result.communities.length}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">{t("patientSimilarity.networkFusion.patients")}</p>
          <p className="text-xl font-bold text-text-primary mt-0.5">{result.n_patients.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">{t("patientSimilarity.networkFusion.edges")}</p>
          <p className="text-xl font-bold text-text-primary mt-0.5">{result.edges.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">{t("patientSimilarity.networkFusion.convergence")}</p>
          <p className="text-xl font-bold text-success mt-0.5">{result.convergence.iterations}</p>
          <p className="text-[10px] text-text-ghost mt-0.5">
            delta {result.convergence.final_delta.toExponential(2)}
          </p>
        </div>
      </div>

      {/* Capped warning */}
      {result.capped_at != null && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-2">
          <p className="text-xs text-accent">
            {t("patientSimilarity.networkFusion.capped", {
              count: result.capped_at.toLocaleString(),
            })}
          </p>
        </div>
      )}

      {/* Community Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {result.communities.map((c) => (
          <div key={c.id} className="rounded-lg border border-border-default bg-surface-raised p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: communityColor(c.id) }} />
              <span className="text-xs font-semibold text-text-secondary">
                {t("patientSimilarity.networkFusion.communityLabel", {
                  index: c.id + 1,
                })}
              </span>
            </div>
            <p className="text-lg font-bold text-text-primary">{c.size}</p>
            <p className="text-[10px] text-text-ghost">
              {t("patientSimilarity.networkFusion.patientCount")}
            </p>
          </div>
        ))}
      </div>

      {/* Graph + Modality Contributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            {t("patientSimilarity.networkFusion.network")}
          </h4>
          <NetworkGraph edges={result.edges} communities={result.communities} />
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            {t("patientSimilarity.networkFusion.modalityContributions")}
          </h4>
          <ModalityBars contributions={result.modality_contributions} />
          <p className="text-xs text-text-ghost mt-4">
            {t("patientSimilarity.networkFusion.modalityHelp")}
          </p>
        </div>
      </div>
    </div>
  );
}
