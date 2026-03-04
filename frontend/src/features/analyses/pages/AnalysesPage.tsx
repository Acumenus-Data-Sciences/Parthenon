import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";
import { AnalysisList } from "../components/AnalysisList";
import { AnalysisStatsBar } from "../components/AnalysisStatsBar";
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
import { useSccsAnalyses, useCreateSccs } from "@/features/sccs/hooks/useSccs";
import { useEvidenceSynthesisAnalyses, useCreateEvidenceSynthesis } from "@/features/evidence-synthesis/hooks/useEvidenceSynthesis";
import type { CharacterizationDesign, IncidenceRateDesign } from "../types/analysis";
import type { PathwayDesign } from "@/features/pathways/types/pathway";
import type { EstimationDesign } from "@/features/estimation/types/estimation";
import type { PredictionDesign } from "@/features/prediction/types/prediction";
import type { SccsDesign } from "@/features/sccs/types/sccs";
import type { EvidenceSynthesisDesign } from "@/features/evidence-synthesis/types/evidenceSynthesis";

type Tab = "characterizations" | "incidence-rates" | "pathways" | "estimations" | "predictions" | "sccs" | "evidence-synthesis";

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

const defaultSccsDesign: SccsDesign = {
  exposureCohortId: 0,
  outcomeCohortId: 0,
  riskWindows: [
    { start: 1, end: 30, startAnchor: "era_start", endAnchor: "era_start", label: "Risk window 1" },
  ],
  model: { type: "simple" },
  studyPopulation: {
    naivePeriod: 180,
    firstOutcomeOnly: true,
  },
};

const defaultESDesign: EvidenceSynthesisDesign = {
  estimates: [],
  method: "bayesian",
  chainLength: 1100000,
  burnIn: 100000,
  subSample: 1000,
};

export default function AnalysesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("characterizations");
  const [charPage, setCharPage] = useState(1);
  const [irPage, setIRPage] = useState(1);
  const [pathwayPage, setPathwayPage] = useState(1);
  const [estPage, setEstPage] = useState(1);
  const [predPage, setPredPage] = useState(1);
  const [sccsPage, setSccsPage] = useState(1);
  const [esPage, setEsPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset pages when search changes
  useEffect(() => {
    setCharPage(1);
    setIRPage(1);
    setPathwayPage(1);
    setEstPage(1);
    setPredPage(1);
    setSccsPage(1);
    setEsPage(1);
  }, [debouncedSearch]);

  const search = debouncedSearch || undefined;

  const {
    data: charData,
    isLoading: charLoading,
    error: charError,
  } = useCharacterizations(charPage, search);

  const {
    data: irData,
    isLoading: irLoading,
    error: irError,
  } = useIncidenceRates(irPage, search);

  const {
    data: pathwayData,
    isLoading: pathwayLoading,
    error: pathwayError,
  } = usePathways(pathwayPage, search);

  const {
    data: estData,
    isLoading: estLoading,
    error: estError,
  } = useEstimations(estPage, search);

  const {
    data: predData,
    isLoading: predLoading,
    error: predError,
  } = usePredictions(predPage, search);

  const {
    data: sccsData,
    isLoading: sccsLoading,
    error: sccsError,
  } = useSccsAnalyses(sccsPage, search);

  const {
    data: esData,
    isLoading: esLoading,
    error: esError,
  } = useEvidenceSynthesisAnalyses(esPage, search);

  const createCharMutation = useCreateCharacterization();
  const createIRMutation = useCreateIncidenceRate();
  const createPathwayMutation = useCreatePathway();
  const createEstMutation = useCreateEstimation();
  const createPredMutation = useCreatePrediction();
  const createSccsMutation = useCreateSccs();
  const createESMutation = useCreateEvidenceSynthesis();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCharacterization = () => {
    setIsCreating(true);
    createCharMutation.mutate(
      { name: "Untitled Characterization", design_json: defaultCharDesign },
      {
        onSuccess: (c) => navigate(`/analyses/characterizations/${c.id}`),
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreateIncidenceRate = () => {
    setIsCreating(true);
    createIRMutation.mutate(
      { name: "Untitled Incidence Rate Analysis", design_json: defaultIRDesign },
      {
        onSuccess: (ir) => navigate(`/analyses/incidence-rates/${ir.id}`),
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreatePathway = () => {
    setIsCreating(true);
    createPathwayMutation.mutate(
      { name: "Untitled Pathway Analysis", design_json: defaultPathwayDesign },
      {
        onSuccess: (p) => navigate(`/analyses/pathways/${p.id}`),
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreateEstimation = () => {
    setIsCreating(true);
    createEstMutation.mutate(
      { name: "Untitled Estimation", design_json: defaultEstimationDesign },
      {
        onSuccess: (e) => navigate(`/analyses/estimations/${e.id}`),
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreatePrediction = () => {
    setIsCreating(true);
    createPredMutation.mutate(
      { name: "Untitled Prediction", design_json: defaultPredictionDesign },
      {
        onSuccess: (p) => navigate(`/analyses/predictions/${p.id}`),
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreateSccs = () => {
    setIsCreating(true);
    createSccsMutation.mutate(
      { name: "Untitled SCCS Analysis", design_json: defaultSccsDesign },
      {
        onSuccess: (s) => navigate(`/analyses/sccs/${s.id}`),
        onSettled: () => setIsCreating(false),
      },
    );
  };

  const handleCreateES = () => {
    setIsCreating(true);
    createESMutation.mutate(
      { name: "Untitled Evidence Synthesis", design_json: defaultESDesign },
      {
        onSuccess: (es) => navigate(`/analyses/evidence-synthesis/${es.id}`),
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
    { key: "sccs", label: "SCCS" },
    { key: "evidence-synthesis", label: "Evidence Synthesis" },
  ];

  const getCreateHandler = () => {
    switch (activeTab) {
      case "characterizations": return handleCreateCharacterization;
      case "incidence-rates": return handleCreateIncidenceRate;
      case "pathways": return handleCreatePathway;
      case "estimations": return handleCreateEstimation;
      case "predictions": return handleCreatePrediction;
      case "sccs": return handleCreateSccs;
      case "evidence-synthesis": return handleCreateES;
    }
  };

  const getButtonLabel = () => {
    switch (activeTab) {
      case "characterizations": return "New Characterization";
      case "incidence-rates": return "New Incidence Rate";
      case "pathways": return "New Pathway";
      case "estimations": return "New Estimation";
      case "predictions": return "New Prediction";
      case "sccs": return "New SCCS";
      case "evidence-synthesis": return "New Evidence Synthesis";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analyses</h1>
          <p className="page-subtitle">
            Population-level characterization, incidence, pathway, estimation,
            prediction, SCCS, and evidence synthesis studies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="characterization" />
          <button
            type="button"
            onClick={getCreateHandler()}
            disabled={isCreating}
            className="btn btn-primary"
          >
            {isCreating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {getButtonLabel()}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <AnalysisStatsBar />

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
        />
        <input
          type="text"
          placeholder="Search analyses..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-lg border border-[#232328] bg-[#151518] py-2 pl-9 pr-8 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF]/40 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#5A5650] hover:text-[#F0EDE8]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn("tab-item", activeTab === tab.key && "active")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "characterizations" && (
        <AnalysisList
          analyses={charData?.data ?? []}
          type="characterization"
          onSelect={(id) => navigate(`/analyses/characterizations/${id}`)}
          isLoading={charLoading}
          error={charError}
          page={charPage}
          totalPages={charData?.meta?.last_page ?? 1}
          total={charData?.meta?.total ?? 0}
          perPage={charData?.meta?.per_page ?? 15}
          onPageChange={setCharPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "incidence-rates" && (
        <AnalysisList
          analyses={irData?.data ?? []}
          type="incidence-rate"
          onSelect={(id) => navigate(`/analyses/incidence-rates/${id}`)}
          isLoading={irLoading}
          error={irError}
          page={irPage}
          totalPages={irData?.meta?.last_page ?? 1}
          total={irData?.meta?.total ?? 0}
          perPage={irData?.meta?.per_page ?? 15}
          onPageChange={setIRPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "pathways" && (
        <AnalysisList
          analyses={pathwayData?.data ?? []}
          type="pathway"
          onSelect={(id) => navigate(`/analyses/pathways/${id}`)}
          isLoading={pathwayLoading}
          error={pathwayError}
          page={pathwayPage}
          totalPages={pathwayData?.meta?.last_page ?? 1}
          total={pathwayData?.meta?.total ?? 0}
          perPage={pathwayData?.meta?.per_page ?? 15}
          onPageChange={setPathwayPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "estimations" && (
        <AnalysisList
          analyses={estData?.data ?? []}
          type="estimation"
          onSelect={(id) => navigate(`/analyses/estimations/${id}`)}
          isLoading={estLoading}
          error={estError}
          page={estPage}
          totalPages={estData?.meta?.last_page ?? 1}
          total={estData?.meta?.total ?? 0}
          perPage={estData?.meta?.per_page ?? 15}
          onPageChange={setEstPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "predictions" && (
        <AnalysisList
          analyses={predData?.data ?? []}
          type="prediction"
          onSelect={(id) => navigate(`/analyses/predictions/${id}`)}
          isLoading={predLoading}
          error={predError}
          page={predPage}
          totalPages={predData?.meta?.last_page ?? 1}
          total={predData?.meta?.total ?? 0}
          perPage={predData?.meta?.per_page ?? 15}
          onPageChange={setPredPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "sccs" && (
        <AnalysisList
          analyses={sccsData?.data ?? []}
          type="sccs"
          onSelect={(id) => navigate(`/analyses/sccs/${id}`)}
          isLoading={sccsLoading}
          error={sccsError}
          page={sccsPage}
          totalPages={sccsData?.meta?.last_page ?? 1}
          total={sccsData?.meta?.total ?? 0}
          perPage={sccsData?.meta?.per_page ?? 15}
          onPageChange={setSccsPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "evidence-synthesis" && (
        <AnalysisList
          analyses={esData?.data ?? []}
          type="evidence-synthesis"
          onSelect={(id) => navigate(`/analyses/evidence-synthesis/${id}`)}
          isLoading={esLoading}
          error={esError}
          page={esPage}
          totalPages={esData?.meta?.last_page ?? 1}
          total={esData?.meta?.total ?? 0}
          perPage={esData?.meta?.per_page ?? 15}
          onPageChange={setEsPage}
          isSearching={!!debouncedSearch}
        />
      )}
    </div>
  );
}
