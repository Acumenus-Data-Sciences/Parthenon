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
import { usePathways, useCreatePathway } from "@/features/pathways/hooks/usePathways";
import { useEstimations, useCreateEstimation } from "@/features/estimation/hooks/useEstimations";
import { usePredictions, useCreatePrediction } from "@/features/prediction/hooks/usePredictions";
import type { CharacterizationDesign, IncidenceRateDesign } from "../types/analysis";
import type { PathwayDesign } from "@/features/pathways/types/pathway";
import type { EstimationDesign } from "@/features/estimation/types/estimation";
import type { PredictionDesign } from "@/features/prediction/types/prediction";

type Tab = "characterizations" | "incidence-rates" | "pathways" | "estimations" | "predictions";

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

const defaultPathwayDesign: PathwayDesign = {
  targetCohortId: 0,
  eventCohortIds: [],
  maxDepth: 5,
  minCellCount: 5,
  combinationWindow: 1,
  maxPathLength: 5,
};

const defaultEstimationDesign: EstimationDesign = {
  targetCohortId: 0,
  comparatorCohortId: 0,
  outcomeCohortIds: [],
  model: {
    type: "cox",
    timeAtRiskStart: 0,
    timeAtRiskEnd: 0,
    endAnchor: "cohort end",
  },
  propensityScore: {
    enabled: true,
    trimming: 0.05,
    matching: { ratio: 1, caliper: 0.2 },
    stratification: { strata: 5 },
  },
  covariateSettings: {
    useDemographics: true,
    useConditionOccurrence: true,
    useDrugExposure: true,
    useProcedureOccurrence: false,
    useMeasurement: false,
    useObservation: false,
    timeWindows: [{ start: -365, end: 0 }],
  },
  negativeControlOutcomes: [],
};

const defaultPredictionDesign: PredictionDesign = {
  targetCohortId: 0,
  outcomeCohortId: 0,
  model: {
    type: "lasso_logistic_regression",
    hyperParameters: {},
  },
  timeAtRisk: {
    start: 1,
    end: 365,
    endAnchor: "cohort start",
  },
  covariateSettings: {
    useDemographics: true,
    useConditionOccurrence: true,
    useDrugExposure: true,
    useProcedureOccurrence: false,
    useMeasurement: false,
    timeWindows: [{ start: -365, end: 0 }],
  },
  populationSettings: {
    washoutPeriod: 365,
    removeSubjectsWithPriorOutcome: true,
    requireTimeAtRisk: true,
    minTimeAtRisk: 365,
  },
  splitSettings: {
    testFraction: 0.25,
    splitSeed: 42,
  },
};

export default function AnalysesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("characterizations");
  const [charPage, setCharPage] = useState(1);
  const [irPage, setIRPage] = useState(1);
  const [pathwayPage, setPathwayPage] = useState(1);
  const [estPage, setEstPage] = useState(1);
  const [predPage, setPredPage] = useState(1);

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

  const {
    data: pathwayData,
    isLoading: pathwayLoading,
    error: pathwayError,
  } = usePathways(pathwayPage);

  const {
    data: estData,
    isLoading: estLoading,
    error: estError,
  } = useEstimations(estPage);

  const {
    data: predData,
    isLoading: predLoading,
    error: predError,
  } = usePredictions(predPage);

  const createCharMutation = useCreateCharacterization();
  const createIRMutation = useCreateIncidenceRate();
  const createPathwayMutation = useCreatePathway();
  const createEstMutation = useCreateEstimation();
  const createPredMutation = useCreatePrediction();
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

  const handleCreatePathway = () => {
    setIsCreating(true);
    createPathwayMutation.mutate(
      {
        name: "Untitled Pathway Analysis",
        design_json: defaultPathwayDesign,
      },
      {
        onSuccess: (p) => {
          navigate(`/analyses/pathways/${p.id}`);
        },
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreateEstimation = () => {
    setIsCreating(true);
    createEstMutation.mutate(
      {
        name: "Untitled Estimation",
        design_json: defaultEstimationDesign,
      },
      {
        onSuccess: (e) => {
          navigate(`/analyses/estimations/${e.id}`);
        },
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreatePrediction = () => {
    setIsCreating(true);
    createPredMutation.mutate(
      {
        name: "Untitled Prediction",
        design_json: defaultPredictionDesign,
      },
      {
        onSuccess: (p) => {
          navigate(`/analyses/predictions/${p.id}`);
        },
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "characterizations", label: "Characterizations" },
    { key: "incidence-rates", label: "Incidence Rates" },
    { key: "pathways", label: "Pathways" },
    { key: "estimations", label: "Estimations" },
    { key: "predictions", label: "Predictions" },
  ];

  const getCreateHandler = () => {
    switch (activeTab) {
      case "characterizations":
        return handleCreateCharacterization;
      case "incidence-rates":
        return handleCreateIncidenceRate;
      case "pathways":
        return handleCreatePathway;
      case "estimations":
        return handleCreateEstimation;
      case "predictions":
        return handleCreatePrediction;
    }
  };

  const getButtonLabel = () => {
    switch (activeTab) {
      case "characterizations":
        return "New Characterization";
      case "incidence-rates":
        return "New Incidence Rate";
      case "pathways":
        return "New Pathway";
      case "estimations":
        return "New Estimation";
      case "predictions":
        return "New Prediction";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Analyses</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Characterization, incidence rate, pathway, estimation, and prediction
            analyses for population-level studies
          </p>
        </div>
        <button
          type="button"
          onClick={getCreateHandler()}
          disabled={isCreating}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          {getButtonLabel()}
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

      {activeTab === "pathways" && (
        <AnalysisList
          analyses={pathwayData?.data ?? []}
          type="pathway"
          onSelect={(id) =>
            navigate(`/analyses/pathways/${id}`)
          }
          isLoading={pathwayLoading}
          error={pathwayError}
          page={pathwayPage}
          totalPages={pathwayData?.meta?.last_page ?? 1}
          total={pathwayData?.meta?.total ?? 0}
          perPage={pathwayData?.meta?.per_page ?? 15}
          onPageChange={setPathwayPage}
        />
      )}

      {activeTab === "estimations" && (
        <AnalysisList
          analyses={estData?.data ?? []}
          type="estimation"
          onSelect={(id) =>
            navigate(`/analyses/estimations/${id}`)
          }
          isLoading={estLoading}
          error={estError}
          page={estPage}
          totalPages={estData?.meta?.last_page ?? 1}
          total={estData?.meta?.total ?? 0}
          perPage={estData?.meta?.per_page ?? 15}
          onPageChange={setEstPage}
        />
      )}

      {activeTab === "predictions" && (
        <AnalysisList
          analyses={predData?.data ?? []}
          type="prediction"
          onSelect={(id) =>
            navigate(`/analyses/predictions/${id}`)
          }
          isLoading={predLoading}
          error={predError}
          page={predPage}
          totalPages={predData?.meta?.last_page ?? 1}
          total={predData?.meta?.total ?? 0}
          perPage={predData?.meta?.per_page ?? 15}
          onPageChange={setPredPage}
        />
      )}
    </div>
  );
}
