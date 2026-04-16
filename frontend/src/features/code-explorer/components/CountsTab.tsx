import { useState } from "react";
import type { AxiosError } from "axios";

import { useCodeCounts } from "../hooks/useCodeCounts";
import { StratifiedCountsChart } from "./StratifiedCountsChart";
import { SourceReadinessBanner } from "./SourceReadinessBanner";

export function CountsTab({ sourceKey, conceptId }: { sourceKey: string; conceptId: number }) {
  const [mode, setMode] = useState<"node" | "descendant">("descendant");
  const [groupBy, setGroupBy] = useState<"gender" | "age_decile">("gender");
  const { data, error, isLoading } = useCodeCounts(sourceKey, conceptId);

  const errorBody = (error as AxiosError<{ error?: { code?: string; message?: string; action?: { type: string; source_key: string } } }>)?.response?.data;
  const errorCode = errorBody?.error?.code;

  if (errorCode === "FINNGEN_SOURCE_NOT_INITIALIZED") {
    return <SourceReadinessBanner sourceKey={sourceKey} />;
  }

  if (errorCode === "FINNGEN_CONCEPT_NOT_IN_SOURCE") {
    return (
      <div className="rounded border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
        <div className="font-medium">No data for this concept in {sourceKey}</div>
        <div className="mt-1 text-amber-200/80">
          Concept {conceptId} is in the OMOP vocabulary but has no observations in this source's
          stratified code counts. Try a different concept (the search box now scopes to
          concepts that have data in {sourceKey}) or switch to a source that includes this code.
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="text-slate-400">Loading counts...</div>;
  if (error) {
    return (
      <div className="rounded border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200">
        Failed to load counts. {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-medium text-slate-100">{data.concept.concept_name}</div>
          <div className="text-xs text-slate-400">
            {data.concept.vocabulary_id} · concept_id {data.concept.concept_id} · {data.concept.domain_id ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Count</span>
            <select
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
              value={mode}
              onChange={(e) => setMode(e.target.value as "node" | "descendant")}
            >
              <option value="node">Node ({data.node_count.toLocaleString()})</option>
              <option value="descendant">Descendant ({data.descendant_count.toLocaleString()})</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Group</span>
            <select
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as "gender" | "age_decile")}
            >
              <option value="gender">Gender</option>
              <option value="age_decile">Age decile</option>
            </select>
          </label>
        </div>
      </div>
      <StratifiedCountsChart data={data.stratified_counts} mode={mode} groupBy={groupBy} />
    </div>
  );
}
