import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisList } from "../components/AnalysisList";
import { useCharacterizations } from "../hooks/useCharacterizations";
import { useIncidenceRates } from "../hooks/useIncidenceRates";
import {
  useCreateCharacterization,
} from "../hooks/useCharacterizations";
import {
  useCreateIncidenceRate,
} from "../hooks/useIncidenceRates";
import type { CharacterizationDesign, IncidenceRateDesign } from "../types/analysis";

type Tab = "characterizations" | "incidence-rates";

const defaultCharDesign: CharacterizationDesign = {
  targetCohortIds: [],
  comparatorCohortIds: [],
  featureTypes: ["demographics", "conditions", "drugs"],
  stratifyByGender: false,
  stratifyByAge: false,
  topN: 100,
  minCellCount: 5,
};

const defaultIRDesign: IncidenceRateDesign = {
  targetCohortId: 0,
  outcomeCohortIds: [],
  timeAtRisk: {
    start: { dateField: "StartDate", offset: 0 },
    end: { dateField: "EndDate", offset: 0 },
  },
  stratifyByGender: false,
  stratifyByAge: false,
  ageGroups: [],
  minCellCount: 5,
};

export default function AnalysesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("characterizations");
  const [charPage, setCharPage] = useState(1);
  const [irPage, setIRPage] = useState(1);

  const {
    data: charData,
    isLoading: charLoading,
    error: charError,
  } = useCharacterizations(charPage);

  const {
    data: irData,
    isLoading: irLoading,
    error: irError,
  } = useIncidenceRates(irPage);

  const createCharMutation = useCreateCharacterization();
  const createIRMutation = useCreateIncidenceRate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCharacterization = () => {
    setIsCreating(true);
    createCharMutation.mutate(
      {
        name: "Untitled Characterization",
        design_json: defaultCharDesign,
      },
      {
        onSuccess: (c) => {
          navigate(`/analyses/characterizations/${c.id}`);
        },
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreateIncidenceRate = () => {
    setIsCreating(true);
    createIRMutation.mutate(
      {
        name: "Untitled Incidence Rate Analysis",
        design_json: defaultIRDesign,
      },
      {
        onSuccess: (ir) => {
          navigate(`/analyses/incidence-rates/${ir.id}`);
        },
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "characterizations", label: "Characterizations" },
    { key: "incidence-rates", label: "Incidence Rates" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Analyses</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Characterization and incidence rate analyses for population-level
            studies
          </p>
        </div>
        <button
          type="button"
          onClick={
            activeTab === "characterizations"
              ? handleCreateCharacterization
              : handleCreateIncidenceRate
          }
          disabled={isCreating}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          {activeTab === "characterizations"
            ? "New Characterization"
            : "New Incidence Rate"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#232328]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-[#2DD4BF]"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "characterizations" && (
        <AnalysisList
          analyses={charData?.data ?? []}
          type="characterization"
          onSelect={(id) =>
            navigate(`/analyses/characterizations/${id}`)
          }
          isLoading={charLoading}
          error={charError}
          page={charPage}
          totalPages={charData?.meta?.last_page ?? 1}
          total={charData?.meta?.total ?? 0}
          perPage={charData?.meta?.per_page ?? 15}
          onPageChange={setCharPage}
        />
      )}

      {activeTab === "incidence-rates" && (
        <AnalysisList
          analyses={irData?.data ?? []}
          type="incidence-rate"
          onSelect={(id) =>
            navigate(`/analyses/incidence-rates/${id}`)
          }
          isLoading={irLoading}
          error={irError}
          page={irPage}
          totalPages={irData?.meta?.last_page ?? 1}
          total={irData?.meta?.total ?? 0}
          perPage={irData?.meta?.per_page ?? 15}
          onPageChange={setIRPage}
        />
      )}
    </div>
  );
}
