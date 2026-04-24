import { useMemo } from "react";
import type { ConditionBundle, UpsetCell } from "../types";

interface Props {
  cells: UpsetCell[];
  bundles: Pick<ConditionBundle, "id" | "bundle_code" | "condition_name">[];
  width?: number;
  height?: number;
}

/**
 * SVG Venn diagram for 2 or 3 sets. Counts come from the workbench
 * UpSet cells — regions are labelled with their cardinality.
 *
 * For ≥4 bundles, displays a hint to use the UpSet plot (no four-set
 * Euler-diagram rendering in P2).
 */
export function VennDiagram({
  cells,
  bundles,
  width = 420,
  height = 320,
}: Props) {
  const countBySubset = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of cells) {
      const key = [...cell.bundles].sort((a, b) => a - b).join(",");
      map.set(key, cell.count);
    }
    return map;
  }, [cells]);

  if (bundles.length < 2) {
    return (
      <p className="p-4 text-sm text-text-ghost">
        Select at least two bundles to see a Venn diagram.
      </p>
    );
  }
  if (bundles.length > 3) {
    return (
      <p className="p-4 text-sm text-text-ghost">
        Venn diagram supports 2–3 sets. Switch to the UpSet plot for {bundles.length} bundles.
      </p>
    );
  }

  const labels = bundles.map((b) => b.bundle_code);
  const ids = bundles.map((b) => b.id);

  const region = (subsetIds: number[]): number => {
    const key = [...subsetIds].sort((a, b) => a - b).join(",");
    return countBySubset.get(key) ?? 0;
  };

  if (bundles.length === 2) {
    const [a, b] = ids;
    const onlyA = region([a]);
    const onlyB = region([b]);
    const both = region([a, b]);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="max-w-full">
        <circle
          cx={width * 0.38}
          cy={height / 2}
          r={Math.min(width, height) * 0.3}
          fill="var(--primary)"
          fillOpacity={0.25}
          stroke="var(--primary)"
        />
        <circle
          cx={width * 0.62}
          cy={height / 2}
          r={Math.min(width, height) * 0.3}
          fill="var(--accent)"
          fillOpacity={0.25}
          stroke="var(--accent)"
        />
        <text x={width * 0.25} y={height / 2 + 5} textAnchor="middle" fill="currentColor">
          {onlyA.toLocaleString()}
        </text>
        <text x={width / 2} y={height / 2 + 5} textAnchor="middle" fill="currentColor">
          {both.toLocaleString()}
        </text>
        <text x={width * 0.75} y={height / 2 + 5} textAnchor="middle" fill="currentColor">
          {onlyB.toLocaleString()}
        </text>
        <text
          x={width * 0.2}
          y={height * 0.1}
          textAnchor="middle"
          className="text-xs font-semibold"
          fill="currentColor"
        >
          {labels[0]}
        </text>
        <text
          x={width * 0.8}
          y={height * 0.1}
          textAnchor="middle"
          className="text-xs font-semibold"
          fill="currentColor"
        >
          {labels[1]}
        </text>
      </svg>
    );
  }

  // 3 sets
  const [a, b, c] = ids;
  const onlyA = region([a]);
  const onlyB = region([b]);
  const onlyC = region([c]);
  const ab = region([a, b]);
  const ac = region([a, c]);
  const bc = region([b, c]);
  const abc = region([a, b, c]);

  const r = Math.min(width, height) * 0.28;
  const cx1 = width * 0.38;
  const cy1 = height * 0.38;
  const cx2 = width * 0.62;
  const cy2 = height * 0.38;
  const cx3 = width * 0.5;
  const cy3 = height * 0.66;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="max-w-full">
      <circle cx={cx1} cy={cy1} r={r} fill="var(--primary)" fillOpacity={0.25} stroke="var(--primary)" />
      <circle cx={cx2} cy={cy2} r={r} fill="var(--accent)" fillOpacity={0.25} stroke="var(--accent)" />
      <circle cx={cx3} cy={cy3} r={r} fill="#C9A227" fillOpacity={0.25} stroke="#C9A227" />

      <text x={cx1 - r * 0.55} y={cy1 + 5} textAnchor="middle" fill="currentColor">
        {onlyA.toLocaleString()}
      </text>
      <text x={cx2 + r * 0.55} y={cy2 + 5} textAnchor="middle" fill="currentColor">
        {onlyB.toLocaleString()}
      </text>
      <text x={cx3} y={cy3 + r * 0.7} textAnchor="middle" fill="currentColor">
        {onlyC.toLocaleString()}
      </text>
      <text x={(cx1 + cx2) / 2} y={cy1 + 5} textAnchor="middle" fill="currentColor">
        {ab.toLocaleString()}
      </text>
      <text x={(cx1 + cx3) / 2 - 10} y={(cy1 + cy3) / 2 + 5} textAnchor="middle" fill="currentColor">
        {ac.toLocaleString()}
      </text>
      <text x={(cx2 + cx3) / 2 + 10} y={(cy2 + cy3) / 2 + 5} textAnchor="middle" fill="currentColor">
        {bc.toLocaleString()}
      </text>
      <text x={(cx1 + cx2 + cx3) / 3} y={(cy1 + cy2 + cy3) / 3 + 5} textAnchor="middle" fill="currentColor">
        {abc.toLocaleString()}
      </text>

      <text x={cx1 - r} y={cy1 - r * 0.9} className="text-xs font-semibold" fill="currentColor">
        {labels[0]}
      </text>
      <text x={cx2 + r} y={cy2 - r * 0.9} textAnchor="end" className="text-xs font-semibold" fill="currentColor">
        {labels[1]}
      </text>
      <text x={cx3} y={cy3 + r * 1.2} textAnchor="middle" className="text-xs font-semibold" fill="currentColor">
        {labels[2]}
      </text>
    </svg>
  );
}
