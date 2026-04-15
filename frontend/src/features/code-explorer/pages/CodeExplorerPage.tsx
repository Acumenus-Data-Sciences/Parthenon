import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ConceptSearchInput } from "@/components/concept/ConceptSearchInput";

import { CountsTab } from "../components/CountsTab";
import { HierarchyTab } from "../components/HierarchyTab";
import { MyReportsTab } from "../components/MyReportsTab";
import { RelationshipsTab } from "../components/RelationshipsTab";
import { ReportTab } from "../components/ReportTab";
import { SourcePicker } from "../components/SourcePicker";
import { SourceReadinessBanner } from "../components/SourceReadinessBanner";

type Tab = "counts" | "relationships" | "hierarchy" | "report" | "my-reports";

export function CodeExplorerPage() {
  const [params, setParams] = useSearchParams();
  const [sourceKey, setSourceKey] = useState<string | null>(params.get("source"));
  const [conceptId, setConceptId] = useState<number | null>(() => {
    const raw = params.get("concept_id");
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  });
  const [activeTab, setActiveTab] = useState<Tab>(
    (params.get("tab") as Tab) ?? "counts",
  );
  const initialReportRunId = params.get("report_run_id");

  const updateUrl = (next: { source?: string | null; conceptId?: number | null; tab?: Tab }) => {
    const p = new URLSearchParams(params);
    if (next.source !== undefined) {
      if (next.source) p.set("source", next.source);
      else p.delete("source");
    }
    if (next.conceptId !== undefined) {
      if (next.conceptId) p.set("concept_id", String(next.conceptId));
      else p.delete("concept_id");
    }
    if (next.tab !== undefined) p.set("tab", next.tab);
    setParams(p, { replace: true });
  };

  const handleSourceChange = (key: string) => {
    setSourceKey(key);
    updateUrl({ source: key });
  };

  const handleConceptChange = (id: number | null) => {
    setConceptId(id);
    updateUrl({ conceptId: id });
  };

  const handleConceptInputChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    handleConceptChange(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    updateUrl({ tab });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "counts", label: "Counts" },
    { id: "relationships", label: "Relationships" },
    { id: "hierarchy", label: "Hierarchy" },
    { id: "report", label: "Report" },
    { id: "my-reports", label: "My Reports" },
  ];

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 p-6">
      <aside className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-slate-100">Code Explorer</h1>
        <SourcePicker value={sourceKey} onChange={handleSourceChange} />
        {sourceKey ? (
          <>
            <SourceReadinessBanner sourceKey={sourceKey} />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-300">Concept</span>
              <ConceptSearchInput
                value={conceptId ? String(conceptId) : ""}
                onChange={handleConceptInputChange}
                paramType="number"
                placeholder="Search or enter concept_id"
              />
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500">Pick a source to begin.</div>
        )}
      </aside>

      <main className="flex flex-col gap-4">
        <nav className="flex gap-1 border-b border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "border-b-2 border-cyan-500 text-cyan-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {sourceKey && conceptId ? (
          <section>
            {activeTab === "counts" && <CountsTab sourceKey={sourceKey} conceptId={conceptId} />}
            {activeTab === "relationships" && (
              <RelationshipsTab
                sourceKey={sourceKey}
                conceptId={conceptId}
                onConceptSelect={handleConceptChange}
              />
            )}
            {activeTab === "hierarchy" && (
              <HierarchyTab
                sourceKey={sourceKey}
                conceptId={conceptId}
                onConceptSelect={handleConceptChange}
              />
            )}
            {activeTab === "report" && (
              <ReportTab
                sourceKey={sourceKey}
                conceptId={conceptId}
                initialRunId={initialReportRunId}
              />
            )}
          </section>
        ) : activeTab === "my-reports" ? null : (
          <div className="text-slate-400">Pick a source and concept to view data.</div>
        )}

        {activeTab === "my-reports" && (
          <MyReportsTab
            onOpenReport={(runId) => {
              const p = new URLSearchParams(params);
              p.set("tab", "report");
              p.set("report_run_id", runId);
              setParams(p, { replace: true });
              setActiveTab("report");
            }}
          />
        )}
      </main>
    </div>
  );
}
