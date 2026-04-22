import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAncestors } from "../hooks/useAncestors";
import { getHierarchyDirectionLabel } from "../lib/i18n";
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
  const { t } = useTranslation("app");
  const [direction, setDirection] = useState<AncestorDirection>("both");
  const [maxDepth, setMaxDepth] = useState(3);
  const { data, isLoading, error } = useAncestors(sourceKey, conceptId, direction, maxDepth);

  if (isLoading) return <div className="text-slate-400">{t("codeExplorer.hierarchy.loading")}</div>;
  if (error) return <div className="text-rose-300">{t("codeExplorer.hierarchy.failed")} {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-400">{t("codeExplorer.hierarchy.direction")}</span>
          <select
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
            value={direction}
            onChange={(e) => setDirection(e.target.value as AncestorDirection)}
          >
            <option value="both">{getHierarchyDirectionLabel(t, "both")}</option>
            <option value="up">{getHierarchyDirectionLabel(t, "up")}</option>
            <option value="down">{getHierarchyDirectionLabel(t, "down")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-400">{t("codeExplorer.hierarchy.maxDepth")}</span>
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
        <div className="text-slate-400">
          {t("codeExplorer.hierarchy.empty", { depth: maxDepth })}
        </div>
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
