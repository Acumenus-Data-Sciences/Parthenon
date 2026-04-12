import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GitBranch } from "lucide-react";

interface FkRelationshipGraphProps {
  fields: Array<{
    table_name: string;
    column_name: string;
    inferred_type: string;
    row_count: number;
  }>;
  onTableClick?: (tableName: string) => void;
}

interface FkEdge { source: string; target: string }
interface NodePos { x: number; y: number; color: string; label: string; rowCount: number }

const FK_MAP: Record<string, string> = {
  person_id: "person",
  visit_occurrence_id: "visit_occurrence",
  visit_detail_id: "visit_detail",
  condition_occurrence_id: "condition_occurrence",
  drug_exposure_id: "drug_exposure",
  procedure_occurrence_id: "procedure_occurrence",
  device_exposure_id: "device_exposure",
  measurement_id: "measurement",
  observation_id: "observation",
  note_id: "note",
  specimen_id: "specimen",
  location_id: "location",
  care_site_id: "care_site",
  provider_id: "provider",
  payer_plan_period_id: "payer_plan_period",
  cost_id: "cost",
  observation_period_id: "observation_period",
  drug_era_id: "drug_era",
  condition_era_id: "condition_era",
};

const DOMAIN_COLORS: Record<string, string> = {
  person: "var(--success)",
  visit_occurrence: "#3B82F6",
  visit_detail: "var(--info)",
  condition_occurrence: "var(--accent)",
  condition_era: "#D4A843",
  drug_exposure: "var(--primary)",
  drug_era: "#B52D44",
  procedure_occurrence: "#A855F7",
  measurement: "#8B5CF6",
  observation: "#F59E0B",
  observation_period: "#F97316",
  death: "#6B7280",
  cost: "#10B981",
  payer_plan_period: "#14B8A6",
  device_exposure: "#EC4899",
  note: "#78716C",
  specimen: "#A3A3A3",
  location: "#6366F1",
  care_site: "#8B5CF6",
  provider: "#7C3AED",
  concept: "#E5E7EB",
};

const RING1 = ["visit_occurrence", "observation_period", "death", "drug_era", "condition_era"];
const RING2 = [
  "condition_occurrence", "drug_exposure", "procedure_occurrence",
  "measurement", "observation", "device_exposure", "note", "specimen", "cost",
];
const SATELLITES = ["concept", "location", "care_site", "provider", "payer_plan_period", "visit_detail"];

const NODE_W = 120;
const NODE_H = 40;
const CX = 450;
const CY = 300;

function shortenName(name: string): string {
  return name
    .replace(/_occurrence/g, "")
    .replace(/_exposure/g, "")
    .replace(/_period/g, "");
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function inferEdges(
  fields: FkRelationshipGraphProps["fields"],
): { edges: FkEdge[]; tableSet: Set<string>; rowCounts: Map<string, number> } {
  const tableSet = new Set<string>();
  const rowCounts = new Map<string, number>();

  for (const f of fields) {
    tableSet.add(f.table_name);
    if (!rowCounts.has(f.table_name) || f.row_count > 0) {
      rowCounts.set(f.table_name, f.row_count);
    }
  }

  const edgeSet = new Set<string>();
  const edges: FkEdge[] = [];

  for (const f of fields) {
    const col = f.column_name.toLowerCase();
    if (!col.endsWith("_id")) continue;

    // concept_id variants: one edge per source table
    if (col === "concept_id" || col.endsWith("_concept_id")) {
      if (tableSet.has("concept")) {
        const key = `${f.table_name}->concept`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: f.table_name, target: "concept" });
        }
      }
      continue;
    }

    const target = FK_MAP[col];
    if (target && tableSet.has(target) && target !== f.table_name) {
      const key = `${f.table_name}->${target}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: f.table_name, target });
      }
    }
  }

  return { edges, tableSet, rowCounts };
}

function layoutNodes(
  tableSet: Set<string>,
  rowCounts: Map<string, number>,
): Map<string, NodePos> {
  const positions = new Map<string, NodePos>();

  const place = (name: string, x: number, y: number) => {
    if (!tableSet.has(name)) return;
    positions.set(name, {
      x,
      y,
      color: DOMAIN_COLORS[name] ?? "#6B7280",
      label: shortenName(name),
      rowCount: rowCounts.get(name) ?? 0,
    });
  };

  // Center: person
  place("person", CX, CY);

  // Ring 1: radius 150
  const r1 = RING1.filter((t) => tableSet.has(t));
  r1.forEach((t, i) => {
    const angle = (i / r1.length) * 2 * Math.PI - Math.PI / 2;
    place(t, CX + 150 * Math.cos(angle), CY + 150 * Math.sin(angle));
  });

  // Ring 2: radius 300
  const r2 = RING2.filter((t) => tableSet.has(t));
  r2.forEach((t, i) => {
    const angle = (i / r2.length) * 2 * Math.PI - Math.PI / 2;
    place(t, CX + 300 * Math.cos(angle), CY + 300 * Math.sin(angle));
  });

  // Satellites: radius 400
  const sats = SATELLITES.filter((t) => tableSet.has(t));
  sats.forEach((t, i) => {
    const angle = (i / sats.length) * 2 * Math.PI - Math.PI / 4;
    place(t, CX + 400 * Math.cos(angle), CY + 400 * Math.sin(angle));
  });

  // Any remaining tables not in predefined rings
  const placed = new Set([...RING1, ...RING2, ...SATELLITES, "person"]);
  const remaining = [...tableSet].filter((t) => !placed.has(t));
  remaining.forEach((t, i) => {
    const angle = (i / Math.max(remaining.length, 1)) * 2 * Math.PI;
    place(t, CX + 350 * Math.cos(angle), CY + 350 * Math.sin(angle));
  });

  return positions;
}

export function FkRelationshipGraph({ fields, onTableClick }: FkRelationshipGraphProps) {
  const [expanded, setExpanded] = useState(true);

  const { edges, tableSet, rowCounts } = useMemo(() => inferEdges(fields), [fields]);
  const positions = useMemo(() => layoutNodes(tableSet, rowCounts), [tableSet, rowCounts]);

  // Only render if >= 3 edges
  if (edges.length < 3) return null;

  // Collect nodes that participate in edges
  const activeNodes = new Set<string>();
  for (const e of edges) {
    activeNodes.add(e.source);
    activeNodes.add(e.target);
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-base p-4 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        <GitBranch size={14} className="text-success" />
        <span className="text-sm font-medium text-text-primary">CDM Relationships</span>
        <span className="text-[11px] text-text-ghost ml-1">
          {edges.length} relationships across {activeNodes.size} tables
        </span>
      </button>

      {expanded && (
        <div className="w-full max-h-[500px] overflow-auto">
          <svg viewBox="0 0 900 600" className="w-full" style={{ minHeight: 400 }}>
            {/* Edges */}
            {edges.map((e) => {
              const src = positions.get(e.source);
              const tgt = positions.get(e.target);
              if (!src || !tgt) return null;

              // Quadratic bezier: control point offset toward center
              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              const cx2 = mx + (CX - mx) * 0.3;
              const cy2 = my + (CY - my) * 0.3;

              return (
                <path
                  key={`${e.source}-${e.target}`}
                  d={`M ${src.x} ${src.y} Q ${cx2} ${cy2} ${tgt.x} ${tgt.y}`}
                  fill="none"
                  stroke="#4B5563"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                />
              );
            })}

            {/* Nodes */}
            {[...activeNodes].map((name) => {
              const pos = positions.get(name);
              if (!pos) return null;
              const rx = NODE_W / 2;
              const ry = NODE_H / 2;

              return (
                <g
                  key={name}
                  onClick={() => onTableClick?.(name)}
                  style={{ cursor: onTableClick ? "pointer" : "default" }}
                >
                  <rect
                    x={pos.x - rx}
                    y={pos.y - ry}
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    ry={8}
                    fill={pos.color}
                    fillOpacity={0.2}
                    stroke={pos.color}
                    strokeWidth={1.5}
                  />
                  <text
                    x={pos.x}
                    y={pos.rowCount > 0 ? pos.y - 3 : pos.y + 4}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={11}
                    fontFamily="monospace"
                  >
                    {pos.label}
                  </text>
                  {pos.rowCount > 0 && (
                    <text
                      x={pos.x}
                      y={pos.y + 12}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize={9}
                    >
                      {fmtCount(pos.rowCount)} rows
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
