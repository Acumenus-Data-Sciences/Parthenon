import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Loader2,
  Search,
  X,
  ChevronDown,
  BarChart3,
  TrendingUp,
  GitBranch,
  Scale,
  Brain,
  Clock,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";
import { AnalysisList } from "../components/AnalysisList";
import { useAnalysisStats } from "../components/AnalysisStatsBar";
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
  tarConfigs: [],
  stratification: { by_age: false, by_gender: false, by_year: false, age_breaks: [] },
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

interface TabDef {
  key: Tab;
  label: string;
  icon: typeof BarChart3;
  color: string;
  statsKey: "characterizations" | "incidence_rates" | "pathways" | "estimations" | "predictions" | "sccs" | "evidence_synthesis";
}

const tabDefs: TabDef[] = [
  { key: "characterizations", label: "Characterizations", icon: BarChart3, color: "var(--info)", statsKey: "characterizations" },
  { key: "incidence-rates", label: "Incidence Rates", icon: TrendingUp, color: "var(--success)", statsKey: "incidence_rates" },
  { key: "pathways", label: "Pathways", icon: GitBranch, color: "var(--accent)", statsKey: "pathways" },
  { key: "estimations", label: "Estimations", icon: Scale, color: "var(--domain-observation)", statsKey: "estimations" },
  { key: "predictions", label: "Predictions", icon: Brain, color: "var(--domain-procedure)", statsKey: "predictions" },
  { key: "sccs", label: "SCCS", icon: Clock, color: 'var(--domain-device)', statsKey: "sccs" },
  { key: "evidence-synthesis", label: "Evidence Synthesis", icon: Layers, color: 'var(--success)', statsKey: "evidence_synthesis" },
];

const createMenuItems: { key: Tab; label: string; icon: typeof BarChart3; color: string }[] = [
  { key: "characterizations", label: "Characterization", icon: BarChart3, color: "var(--info)" },
  { key: "incidence-rates", label: "Incidence Rate", icon: TrendingUp, color: "var(--success)" },
  { key: "pathways", label: "Pathway", icon: GitBranch, color: "var(--accent)" },
  { key: "estimations", label: "Estimation", icon: Scale, color: "var(--domain-observation)" },
  { key: "predictions", label: "Prediction", icon: Brain, color: "var(--domain-procedure)" },
  { key: "sccs", label: "SCCS", icon: Clock, color: 'var(--domain-device)' },
  { key: "evidence-synthesis", label: "Evidence Synthesis", icon: Layers, color: 'var(--success)' },
];

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
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useAnalysisStats();

  // Close create menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    if (showCreateMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCreateMenu]);

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

  const handleCreate = (type: Tab) => {
    setShowCreateMenu(false);
    setIsCreating(true);
    switch (type) {
      case "characterizations":
        createCharMutation.mutate(
          { name: "Untitled Characterization", design_json: defaultCharDesign },
          { onSuccess: (c) => navigate(`/analyses/characterizations/${c.id}`), onSettled: () => setIsCreating(false) },
        );
        break;
      case "incidence-rates":
        createIRMutation.mutate(
          { name: "Untitled Incidence Rate Analysis", design_json: defaultIRDesign },
          { onSuccess: (ir) => navigate(`/analyses/incidence-rates/${ir.id}`), onSettled: () => setIsCreating(false) },
        );
        break;
      case "pathways":
        createPathwayMutation.mutate(
          { name: "Untitled Pathway Analysis", design_json: defaultPathwayDesign },
          { onSuccess: (p) => navigate(`/analyses/pathways/${p.id}`), onSettled: () => setIsCreating(false) },
        );
        break;
      case "estimations":
        createEstMutation.mutate(
          { name: "Untitled Estimation", design_json: defaultEstimationDesign },
          { onSuccess: (e) => navigate(`/analyses/estimations/${e.id}`), onSettled: () => setIsCreating(false) },
        );
        break;
      case "predictions":
        createPredMutation.mutate(
          { name: "Untitled Prediction", design_json: defaultPredictionDesign },
          { onSuccess: (p) => navigate(`/analyses/predictions/${p.id}`), onSettled: () => setIsCreating(false) },
        );
        break;
      case "sccs":
        createSccsMutation.mutate(
          { name: "Untitled SCCS Analysis", design_json: defaultSccsDesign },
          { onSuccess: (s) => navigate(`/analyses/sccs/${s.id}`), onSettled: () => setIsCreating(false) },
        );
        break;
      case "evidence-synthesis":
        createESMutation.mutate(
          { name: "Untitled Evidence Synthesis", design_json: defaultESDesign },
          { onSuccess: (es) => navigate(`/analyses/evidence-synthesis/${es.id}`), onSettled: () => setIsCreating(false) },
        );
        break;
    }
  };

  const getCount = (statsKey: TabDef["statsKey"]) => {
    if (!stats) return undefined;
    return stats[statsKey]?.total;
  };

  return (
    <div className="space-y-5">
      {/* Header — title left, search center, create dropdown right */}
      <div className="flex items-start justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-text-primary">Analyses</h1>
          <p className="mt-1 text-sm text-text-muted">
            Population-level research studies across 7 analysis types
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center max-w-lg mx-4 pt-1">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <input
              type="text"
              placeholder="Search across all analyses..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-9 pr-8 text-sm text-text-primary placeholder:text-text-ghost focus:border-success/40 focus:outline-none focus:ring-1 focus:ring-success/40"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-ghost hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <HelpButton helpKey="analyses" />
          <div className="relative" ref={createMenuRef}>
            <button
              type="button"
              onClick={() => setShowCreateMenu((v) => !v)}
              disabled={isCreating}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success transition-colors disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              New Analysis
              <ChevronDown size={14} className={cn("transition-transform", showCreateMenu && "rotate-180")} />
            </button>

            {showCreateMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border-default bg-surface-overlay py-1 shadow-xl">
                {createMenuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleCreate(item.key)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated transition-colors"
                  >
                    <item.icon size={14} style={{ color: item.color }} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs with inline counts — replaces both stats bar and old tab bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
        {tabDefs.map((tab) => {
          const count = getCount(tab.statsKey);
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-border-subtle border border-border-default text-text-primary"
                  : "border border-transparent text-text-ghost hover:text-text-muted hover:bg-surface-raised",
              )}
            >
              <Icon
                size={14}
                style={{ color: isActive ? tab.color : undefined }}
                className={cn(!isActive && "opacity-50")}
              />
              <span>{tab.label}</span>
              {count !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-xs font-semibold font-['IBM_Plex_Mono',monospace]",
                    isActive
                      ? "text-surface-base"
                      : "bg-surface-overlay text-text-ghost",
                  )}
                  style={isActive ? { backgroundColor: tab.color } : undefined}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-border-subtle" />

      {/* Tab Content */}
      {activeTab === "characterizations" && (
        <AnalysisList
          analyses={charData?.items ?? []}
          type="characterization"
          onSelect={(id) => navigate(`/analyses/characterizations/${id}`)}
          isLoading={charLoading}
          error={charError}
          page={charPage}
          totalPages={charData ? Math.ceil(charData.total / charData.limit) : 1}
          total={charData?.total ?? 0}
          perPage={charData?.limit ?? 15}
          onPageChange={setCharPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "incidence-rates" && (
        <AnalysisList
          analyses={irData?.items ?? []}
          type="incidence-rate"
          onSelect={(id) => navigate(`/analyses/incidence-rates/${id}`)}
          isLoading={irLoading}
          error={irError}
          page={irPage}
          totalPages={irData ? Math.ceil(irData.total / irData.limit) : 1}
          total={irData?.total ?? 0}
          perPage={irData?.limit ?? 15}
          onPageChange={setIRPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "pathways" && (
        <AnalysisList
          analyses={pathwayData?.items ?? []}
          type="pathway"
          onSelect={(id) => navigate(`/analyses/pathways/${id}`)}
          isLoading={pathwayLoading}
          error={pathwayError}
          page={pathwayPage}
          totalPages={pathwayData ? Math.ceil(pathwayData.total / pathwayData.limit) : 1}
          total={pathwayData?.total ?? 0}
          perPage={pathwayData?.limit ?? 15}
          onPageChange={setPathwayPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "estimations" && (
        <AnalysisList
          analyses={estData?.items ?? []}
          type="estimation"
          onSelect={(id) => navigate(`/analyses/estimations/${id}`)}
          isLoading={estLoading}
          error={estError}
          page={estPage}
          totalPages={estData ? Math.ceil(estData.total / estData.limit) : 1}
          total={estData?.total ?? 0}
          perPage={estData?.limit ?? 15}
          onPageChange={setEstPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "predictions" && (
        <AnalysisList
          analyses={predData?.items ?? []}
          type="prediction"
          onSelect={(id) => navigate(`/analyses/predictions/${id}`)}
          isLoading={predLoading}
          error={predError}
          page={predPage}
          totalPages={predData ? Math.ceil(predData.total / predData.limit) : 1}
          total={predData?.total ?? 0}
          perPage={predData?.limit ?? 15}
          onPageChange={setPredPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "sccs" && (
        <AnalysisList
          analyses={sccsData?.items ?? []}
          type="sccs"
          onSelect={(id) => navigate(`/analyses/sccs/${id}`)}
          isLoading={sccsLoading}
          error={sccsError}
          page={sccsPage}
          totalPages={sccsData ? Math.ceil(sccsData.total / sccsData.limit) : 1}
          total={sccsData?.total ?? 0}
          perPage={sccsData?.limit ?? 15}
          onPageChange={setSccsPage}
          isSearching={!!debouncedSearch}
        />
      )}

      {activeTab === "evidence-synthesis" && (
        <AnalysisList
          analyses={esData?.items ?? []}
          type="evidence-synthesis"
          onSelect={(id) => navigate(`/analyses/evidence-synthesis/${id}`)}
          isLoading={esLoading}
          error={esError}
          page={esPage}
          totalPages={esData ? Math.ceil(esData.total / esData.limit) : 1}
          total={esData?.total ?? 0}
          perPage={esData?.limit ?? 15}
          onPageChange={setEsPage}
          isSearching={!!debouncedSearch}
        />
      )}
    </div>
  );
}
