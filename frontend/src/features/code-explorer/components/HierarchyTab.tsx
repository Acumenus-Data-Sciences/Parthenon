import { useState } from "react";

import { useAncestors } from "../hooks/useAncestors";
import type { AncestorDirection } from "../types";
import { AncestorGraph } from "./AncestorGraph";

export function HierarchyTab({
  sourceKey,
  conceptId,
  onConceptSelect,
}: {
  sourceKey: string;
  conceptId: number;
  onConceptSelect: (conceptId: number) => void;
}) {
  const [direction, setDirection] = useState<AncestorDirection>("both");
  const [maxDepth, setMaxDepth] = useState(3);
  const { data, isLoading, error } = useAncestors(sourceKey, conceptId, direction, maxDepth);

  if (isLoading) return <div className="text-slate-400">Loading hierarchy...</div>;
  if (error) return <div className="text-rose-300">Failed to load. {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-400">Direction</span>
          <select
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
            value={direction}
            onChange={(e) => setDirection(e.target.value as AncestorDirection)}
          >
            <option value="both">Both</option>
            <option value="up">Ancestors only</option>
            <option value="down">Descendants only</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-400">Max depth</span>
          <input
            type="number"
            min={1}
            max={7}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Math.min(7, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))}
            className="w-16 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
          />
        </label>
      </div>
      {data.nodes.length === 0 ? (
        <div className="text-slate-400">No hierarchy data for this concept at depth {maxDepth}.</div>
      ) : (
        <AncestorGraph
          rootConceptId={conceptId}
          nodes={data.nodes}
          edges={data.edges}
          onConceptSelect={onConceptSelect}
        />
      )}
    </div>
  );
}
