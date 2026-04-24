import { useMemo, type ComponentType } from "react";
// @upsetjs/react bundles its own (older) @types/react, which fights the
// project's React 19 types. We cast the component to a structural shape that
// accepts our props; the runtime behavior is unchanged.
import UpSetJSDefault from "@upsetjs/react";
import type { ConditionBundle, UpsetCell } from "../types";

type UpSetLikeProps = {
  sets: { name: string; cardinality: number }[];
  combinations: { name: string; cardinality: number; sets: string[] }[];
  width: number;
  height: number;
  theme?: "light" | "dark" | "vega";
};

const UpSetJS = UpSetJSDefault as unknown as ComponentType<UpSetLikeProps>;

interface Props {
  cells: UpsetCell[];
  bundles: Pick<ConditionBundle, "id" | "bundle_code" | "condition_name">[];
  width?: number;
  height?: number;
}

/**
 * UpSet plot rendered from aggregate count data only — no per-person payload
 * is sent to the browser. Cardinalities are summed from the workbench cells.
 */
export function UpSetPlot({ cells, bundles, width = 700, height = 380 }: Props) {
  const { sets, combinations } = useMemo(() => {
    const bundleById = new Map(bundles.map((b) => [b.id, b.bundle_code]));

    // Per-set cardinality = sum of counts across every cell the set participates in.
    const setSizes = new Map<number, number>();
    for (const cell of cells) {
      for (const id of cell.bundles) {
        setSizes.set(id, (setSizes.get(id) ?? 0) + cell.count);
      }
    }

    const sets = bundles.map((b) => ({
      name: bundleById.get(b.id) ?? String(b.id),
      cardinality: setSizes.get(b.id) ?? 0,
    }));

    const combinations = cells.map((cell) => ({
      name: cell.bundles
        .map((id) => bundleById.get(id) ?? String(id))
        .join(" ∩ "),
      cardinality: cell.count,
      sets: cell.bundles.map((id) => bundleById.get(id) ?? String(id)),
    }));

    return { sets, combinations };
  }, [cells, bundles]);

  if (sets.length < 2) {
    return (
      <p className="p-4 text-sm text-text-ghost">
        Select at least two bundles to see an UpSet plot.
      </p>
    );
  }

  return (
    <div className="p-2">
      <UpSetJS
        sets={sets}
        combinations={combinations}
        width={width}
        height={height}
        theme="dark"
      />
    </div>
  );
}
