import { useState } from "react";
import LookupGeneratorTab from "../components/LookupGeneratorTab";

type AqueductTab = "schema_mapper" | "concept_matcher" | "lookup_generator";

const TABS: { id: AqueductTab; label: string; available: boolean }[] = [
  { id: "schema_mapper", label: "Schema Mapper", available: false },
  { id: "concept_matcher", label: "Concept Matcher", available: false },
  { id: "lookup_generator", label: "Lookup Generator", available: true },
];

export default function AqueductPage() {
  const [activeTab, setActiveTab] = useState<AqueductTab>("lookup_generator");

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Aqueduct</h1>
        <p className="mt-1 text-sm text-gray-400">
          ETL Mapping Workbench — design source-to-CDM mappings with concept
          matching and vocabulary lookups
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-[#161619] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.available && setActiveTab(tab.id)}
            disabled={!tab.available}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                : tab.available
                  ? "text-gray-400 hover:text-gray-300"
                  : "cursor-not-allowed text-gray-600"
            }`}
          >
            {tab.label}
            {!tab.available && (
              <span className="ml-2 text-xs text-gray-600">(Coming Soon)</span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-[#0E0E11] p-6">
        {activeTab === "lookup_generator" && <LookupGeneratorTab />}
        {activeTab === "schema_mapper" && (
          <div className="py-12 text-center text-gray-500">
            Schema Mapper — Phase 3
          </div>
        )}
        {activeTab === "concept_matcher" && (
          <div className="py-12 text-center text-gray-500">
            Concept Matcher — Phase 2
          </div>
        )}
      </div>
    </div>
  );
}
