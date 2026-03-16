import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  CircleAlert,
  Database,
  FileCode2,
  FlaskConical,
  GitBranchPlus,
  Loader2,
  Network,
  PanelsTopLeft,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useCohortDefinition, useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import { useFinnGenServices } from "../hooks/useFinnGenServices";
import {
  exportFinnGenRun,
  fetchFinnGenRun,
  fetchFinnGenRuns,
  previewFinnGenCo2Analysis,
  previewFinnGenCohortOperations,
  previewFinnGenHadesExtras,
  previewFinnGenRomopapi,
  replayFinnGenRun,
} from "../api";
import type {
  FinnGenCo2AnalysisResult,
  FinnGenCohortOperationsResult,
  FinnGenHadesExtrasResult,
  FinnGenRun,
  FinnGenRuntime,
  FinnGenRomopapiResult,
  FinnGenService,
  FinnGenSource,
} from "../types";
import type { CohortDefinition } from "@/features/cohort-definitions/types/cohortExpression";

type ServiceName =
  | "finngen_romopapi"
  | "finngen_hades_extras"
  | "finngen_cohort_operations"
  | "finngen_co2_analysis";

const serviceOrder: ServiceName[] = [
  "finngen_romopapi",
  "finngen_hades_extras",
  "finngen_cohort_operations",
  "finngen_co2_analysis",
];

const serviceIcons: Record<ServiceName, typeof FlaskConical> = {
  finngen_cohort_operations: FlaskConical,
  finngen_co2_analysis: Radar,
  finngen_hades_extras: FileCode2,
  finngen_romopapi: Database,
};

const serviceDescriptors: Record<
  ServiceName,
  { shortLabel: string; accent: string; summary: string }
> = {
  finngen_cohort_operations: {
    shortLabel: "Cohort Ops",
    accent: "#9B1B30",
    summary: "Compile and inspect cohort attrition against the selected CDM source.",
  },
  finngen_co2_analysis: {
    shortLabel: "CO2 Modules",
    accent: "#C9A227",
    summary: "Stage a comparative analysis module and preview visual outputs.",
  },
  finngen_hades_extras: {
    shortLabel: "HADES Extras",
    accent: "#2DD4BF",
    summary: "Render SQL and package artifacts for the selected dialect and schema.",
  },
  finngen_romopapi: {
    shortLabel: "ROMOPAPI",
    accent: "#60A5FA",
    summary: "Inspect OMOP schema metadata, hierarchy, and query planning against the selected source.",
  },
};

const cohortPresets = [
  {
    label: "Condition cohort",
    value: JSON.stringify(
      {
        conceptSets: [{ id: 1, name: "Target conditions", expression: { items: [] } }],
        PrimaryCriteria: {
          CriteriaList: [
            {
              ConditionOccurrence: {
                CodesetId: 1,
                ConditionTypeExclude: false,
              },
            },
          ],
          ObservationWindow: { PriorDays: 0, PostDays: 0 },
        },
        AdditionalCriteria: { CriteriaList: [] },
        QualifiedLimit: { Type: "First" },
        ExpressionLimit: { Type: "First" },
      },
      null,
      2,
    ),
  },
  {
    label: "Drug exposure cohort",
    value: JSON.stringify(
      {
        conceptSets: [{ id: 1, name: "Target drugs", expression: { items: [] } }],
        PrimaryCriteria: {
          CriteriaList: [
            {
              DrugExposure: {
                CodesetId: 1,
                DrugTypeExclude: false,
              },
            },
          ],
          ObservationWindow: { PriorDays: 30, PostDays: 0 },
        },
        AdditionalCriteria: { CriteriaList: [] },
        QualifiedLimit: { Type: "All" },
        ExpressionLimit: { Type: "All" },
      },
      null,
      2,
    ),
  },
] as const;

const moduleOptions = [
  { value: "comparative_effectiveness", label: "Comparative effectiveness" },
  { value: "codewas_preview", label: "CodeWAS preview" },
  { value: "condition_burden", label: "Condition burden" },
  { value: "cohort_demographics_preview", label: "Cohort demographics" },
  { value: "drug_utilization", label: "Drug utilization" },
  { value: "sex_stratified_preview", label: "Sex stratified preview" },
] as const;

const burdenDomainOptions = [
  { value: "condition_occurrence", label: "Condition occurrence" },
  { value: "procedure_occurrence", label: "Procedure occurrence" },
  { value: "drug_exposure", label: "Drug exposure" },
] as const;

const exposureWindowOptions = [
  { value: "30 days", label: "30 days" },
  { value: "90 days", label: "90 days" },
  { value: "180 days", label: "180 days" },
  { value: "365 days", label: "365 days" },
] as const;

const stratifyByOptions = [
  { value: "sex", label: "Sex" },
  { value: "age_band", label: "Age band" },
  { value: "care_site", label: "Care site" },
] as const;

const queryTemplates = [
  "condition_occurrence -> person -> observation_period",
  "drug_exposure -> person -> visit_occurrence",
  "measurement -> person -> concept",
] as const;

const romopapiDomainOptions = [
  { value: "all", label: "All domains" },
  { value: "Condition", label: "Condition" },
  { value: "Drug", label: "Drug" },
  { value: "Measurement", label: "Measurement" },
] as const;

const romopapiStratifyOptions = [
  { value: "overall", label: "Overall" },
  { value: "age_band", label: "Age band" },
  { value: "sex", label: "Sex" },
  { value: "care_site", label: "Care site" },
] as const;

const romopapiLimitOptions = [10, 25, 50, 100] as const;

const romopapiLineageDepthOptions = [2, 3, 4, 5] as const;

const hadesConfigProfiles = [
  { value: "acumenus_default", label: "Acumenus default" },
  { value: "cohort_generation", label: "Cohort generation" },
  { value: "analysis_bundle", label: "Analysis bundle" },
] as const;

const hadesArtifactModes = [
  { value: "sql_only", label: "SQL only" },
  { value: "sql_and_manifest", label: "SQL + manifest" },
  { value: "full_bundle", label: "Full bundle" },
] as const;

const hadesPackageSkeletons = [
  { value: "ohdsi_study", label: "OHDSI study" },
  { value: "lightweight_sql", label: "Lightweight SQL" },
  { value: "finngen_extension", label: "FINNGEN extension" },
] as const;

const cohortImportModes = [
  { value: "parthenon", label: "Parthenon cohorts" },
  { value: "atlas", label: "Atlas/WebAPI" },
  { value: "cohort_table", label: "Cohort table" },
  { value: "json", label: "JSON definition" },
] as const;

const cohortOperationTypes = [
  { value: "union", label: "Union" },
  { value: "intersect", label: "Intersect" },
  { value: "subtract", label: "Subtract" },
] as const;

const cohortMatchingStrategies = [
  { value: "nearest-neighbor", label: "Nearest neighbor" },
  { value: "exact", label: "Exact matching" },
  { value: "stratified", label: "Stratified preview" },
] as const;

const defaultMatchingCovariates = ["age", "sex", "index year"] as const;

export default function FinnGenToolsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useFinnGenServices();
  const [sources, setSources] = useState<FinnGenSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [activeService, setActiveService] = useState<ServiceName>("finngen_romopapi");

  const [cohortJson, setCohortJson] = useState<string>(
    JSON.stringify(
      {
        conceptSets: [],
        PrimaryCriteria: {
          CriteriaList: [
            {
              ConditionOccurrence: {
                CodesetId: null,
                ConditionTypeExclude: false,
              },
            },
          ],
          ObservationWindow: { PriorDays: 0, PostDays: 0 },
        },
        AdditionalCriteria: null,
        QualifiedLimit: { Type: "First" },
        ExpressionLimit: { Type: "First" },
      },
      null,
      2,
    ),
  );
  const [moduleKey, setModuleKey] = useState("comparative_effectiveness");
  const [cohortLabel, setCohortLabel] = useState("Acumenus diabetes cohort");
  const [outcomeName, setOutcomeName] = useState("Heart failure");
  const [comparatorLabel, setComparatorLabel] = useState("Standard care comparator");
  const [sensitivityLabel, setSensitivityLabel] = useState("Sensitivity exposure");
  const [burdenDomain, setBurdenDomain] =
    useState<(typeof burdenDomainOptions)[number]["value"]>("condition_occurrence");
  const [exposureWindow, setExposureWindow] =
    useState<(typeof exposureWindowOptions)[number]["value"]>("90 days");
  const [stratifyBy, setStratifyBy] =
    useState<(typeof stratifyByOptions)[number]["value"]>("sex");
  const [sqlTemplate, setSqlTemplate] = useState(
    "SELECT person_id, COUNT(*) AS condition_count\nFROM @cdm_schema.condition_occurrence\nGROUP BY person_id\nLIMIT 100;",
  );
  const [packageName, setPackageName] = useState("AcumenusFinnGenPackage");
  const [hadesConfigProfile, setHadesConfigProfile] =
    useState<(typeof hadesConfigProfiles)[number]["value"]>("acumenus_default");
  const [hadesArtifactMode, setHadesArtifactMode] =
    useState<(typeof hadesArtifactModes)[number]["value"]>("full_bundle");
  const [hadesPackageSkeleton, setHadesPackageSkeleton] =
    useState<(typeof hadesPackageSkeletons)[number]["value"]>("ohdsi_study");
  const [hadesCohortTable, setHadesCohortTable] = useState("results.cohort");
  const [schemaScope, setSchemaScope] = useState("");
  const [queryTemplate, setQueryTemplate] = useState(
    "condition_occurrence -> person -> observation_period",
  );
  const [conceptDomain, setConceptDomain] =
    useState<(typeof romopapiDomainOptions)[number]["value"]>("all");
  const [romopapiStratifyBy, setRomopapiStratifyBy] =
    useState<(typeof romopapiStratifyOptions)[number]["value"]>("overall");
  const [resultLimit, setResultLimit] = useState<(typeof romopapiLimitOptions)[number]>(25);
  const [lineageDepth, setLineageDepth] = useState<(typeof romopapiLineageDepthOptions)[number]>(3);
  const [operationBuilderOpen, setOperationBuilderOpen] = useState(false);
  const [cohortSearch, setCohortSearch] = useState("");
  const [cohortImportMode, setCohortImportMode] =
    useState<(typeof cohortImportModes)[number]["value"]>("parthenon");
  const [operationType, setOperationType] =
    useState<(typeof cohortOperationTypes)[number]["value"]>("union");
  const [selectedCohortIds, setSelectedCohortIds] = useState<number[]>([]);
  const [atlasCohortIds, setAtlasCohortIds] = useState("101, 202");
  const [cohortTableName, setCohortTableName] = useState("results.cohort");
  const [matchingEnabled, setMatchingEnabled] = useState(true);
  const [matchingStrategy, setMatchingStrategy] =
    useState<(typeof cohortMatchingStrategies)[number]["value"]>("nearest-neighbor");
  const [matchingCovariates, setMatchingCovariates] = useState<string>(
    defaultMatchingCovariates.join(", "),
  );
  const [matchingRatio, setMatchingRatio] = useState("1.0");
  const [matchingCaliper, setMatchingCaliper] = useState("0.20");
  const [exportTarget, setExportTarget] = useState("results.finngen_cohort_preview");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);
  const [co2CohortContext, setCo2CohortContext] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSourcesLoading(true);
    fetchSources()
      .then((result) => {
        if (cancelled) return;
        setSources(result);
        const defaultSource = result.find((source) => source.is_default) ?? result[0] ?? null;
        setSelectedSourceId((current) => current ?? defaultSource?.id ?? null);
        setSchemaScope((current) => current || getSchemaQualifier(defaultSource, "cdm"));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSourcesError(error instanceof Error ? error.message : "Failed to load sources");
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const services = useMemo(() => {
    const items = data?.services ?? [];
    return [...items].sort(
      (left, right) => {
        const leftIndex = serviceOrder.indexOf(left.name as ServiceName);
        const rightIndex = serviceOrder.indexOf(right.name as ServiceName);
        const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return normalizedLeft - normalizedRight;
      },
    );
  }, [data?.services]);
  const finngenServices = useMemo(
    () => services.filter((service) => String(service.name).startsWith("finngen_")),
    [services],
  );
  const communityServices = useMemo(
    () => services.filter((service) => String(service.name).startsWith("community_")),
    [services],
  );

  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null;

  useEffect(() => {
    if (!selectedSource) return;
    if (!schemaScope) {
      setSchemaScope(getSchemaQualifier(selectedSource, "cdm"));
    }
  }, [schemaScope, selectedSource]);

  const selectedService =
    finngenServices.find((service) => service.name === activeService) ?? finngenServices[0] ?? null;
  const enabledCount = services.filter((service) => service.implemented).length;
  const warningCount = data?.warnings.length ?? 0;
  const cohortDefinitionsQuery = useCohortDefinitions({ limit: 50 });
  const selectedPrimaryCohortId = selectedCohortIds[0] ?? null;
  const selectedPrimaryCohortQuery = useCohortDefinition(selectedPrimaryCohortId);
  const runsQuery = useQuery({
    queryKey: ["finngen-runs", activeService, selectedSourceId],
    queryFn: () =>
      fetchFinnGenRuns({
        service_name: activeService,
        source_id: selectedSourceId ?? undefined,
        limit: 8,
      }),
    enabled: Boolean(selectedSourceId),
  });
  const runDetailQuery = useQuery({
    queryKey: ["finngen-run", selectedRunId],
    queryFn: () => fetchFinnGenRun(selectedRunId as number),
    enabled: Boolean(selectedRunId),
  });
  const compareRunDetailQuery = useQuery({
    queryKey: ["finngen-run-compare", compareRunId],
    queryFn: () => fetchFinnGenRun(compareRunId as number),
    enabled: Boolean(compareRunId),
  });

  useEffect(() => {
    setSelectedRunId(null);
    setCompareRunId(null);
  }, [activeService, selectedSourceId]);

  useEffect(() => {
    const runs = runsQuery.data ?? [];
    if (!runs.length) return;

    setSelectedRunId((current) => (runs.some((run) => run.id === current) ? current : runs[0]?.id ?? null));
  }, [runsQuery.data]);

  const cohortDefinitions = cohortDefinitionsQuery.data?.items ?? [];
  const filteredCohorts = cohortDefinitions.filter((cohort) => {
    const search = cohortSearch.trim().toLowerCase();
    if (!search) return true;
    return cohort.name.toLowerCase().includes(search) || (cohort.description ?? "").toLowerCase().includes(search);
  });
  const selectedCohortDefinitions = selectedCohortIds
    .map((id) => cohortDefinitions.find((cohort) => cohort.id === id))
    .filter((cohort): cohort is CohortDefinition => Boolean(cohort));
  const selectedCohortLabels = selectedCohortDefinitions.map((cohort) => cohort.name);
  const effectiveCohortDefinition = useMemo(() => {
    if (cohortImportMode === "parthenon" && selectedPrimaryCohortQuery.data?.expression_json) {
      return selectedPrimaryCohortQuery.data.expression_json as Record<string, unknown>;
    }
    return safeParseJson(cohortJson);
  }, [cohortImportMode, selectedPrimaryCohortQuery.data, cohortJson]);

  useEffect(() => {
    if (moduleKey === "comparative_effectiveness" || moduleKey === "codewas_preview") {
      setOutcomeName((current) => current || "Heart failure");
      setComparatorLabel((current) => current || "Standard care comparator");
      setSensitivityLabel((current) => current || "Sensitivity exposure");
      return;
    }

    if (moduleKey === "condition_burden") {
      setBurdenDomain((current) => current || "condition_occurrence");
      return;
    }

    if (moduleKey === "cohort_demographics_preview") {
      setStratifyBy((current) => current || "age_band");
      setOutcomeName((current) => current || "Cohort demographics");
      return;
    }

    if (moduleKey === "drug_utilization") {
      setExposureWindow((current) => current || "90 days");
      setOutcomeName((current) => current || "Drug utilization");
      return;
    }

    setStratifyBy((current) => current || "sex");
  }, [moduleKey]);

  const cohortMutation = useMutation({
    mutationFn: () =>
      previewFinnGenCohortOperations({
        source: requireSource(selectedSource),
        cohort_definition: effectiveCohortDefinition,
        import_mode: cohortImportMode,
        operation_type: operationType,
        atlas_cohort_ids: parseIntegerList(atlasCohortIds),
        cohort_table_name: cohortTableName,
        selected_cohort_ids: selectedCohortIds,
        selected_cohort_labels: selectedCohortLabels,
        matching_enabled: matchingEnabled,
        matching_strategy: matchingStrategy,
        matching_covariates: parseStringList(matchingCovariates),
        matching_ratio: Number.parseFloat(matchingRatio) || 1,
        matching_caliper: Number.parseFloat(matchingCaliper) || 0.2,
        export_target: exportTarget,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finngen-runs", activeService, selectedSourceId] });
    },
  });
  const co2Mutation = useMutation({
    mutationFn: () =>
      previewFinnGenCo2Analysis({
        source: requireSource(selectedSource),
        module_key: moduleKey,
        cohort_label: cohortLabel,
        outcome_name: outcomeName,
        cohort_context: co2CohortContext ?? undefined,
        comparator_label: comparatorLabel,
        sensitivity_label: sensitivityLabel,
        burden_domain: burdenDomain,
        exposure_window: exposureWindow,
        stratify_by: stratifyBy,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finngen-runs", activeService, selectedSourceId] });
    },
  });
  const hadesMutation = useMutation({
    mutationFn: () =>
      previewFinnGenHadesExtras({
        source: requireSource(selectedSource),
        sql_template: sqlTemplate,
        package_name: packageName,
        render_target: selectedSource?.source_dialect,
        config_profile: hadesConfigProfile,
        artifact_mode: hadesArtifactMode,
        package_skeleton: hadesPackageSkeleton,
        cohort_table: hadesCohortTable,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finngen-runs", activeService, selectedSourceId] });
    },
  });
  const romopapiMutation = useMutation({
    mutationFn: () =>
      previewFinnGenRomopapi({
        source: requireSource(selectedSource),
        schema_scope: schemaScope,
        query_template: queryTemplate,
        concept_domain: conceptDomain,
        stratify_by: romopapiStratifyBy,
        result_limit: resultLimit,
        lineage_depth: lineageDepth,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finngen-runs", activeService, selectedSourceId] });
    },
  });
  const replayRunMutation = useMutation({
    mutationFn: (runId: number) => replayFinnGenRun(runId),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: ["finngen-runs", activeService, selectedSourceId] });
      if (run?.id) {
        setSelectedRunId(run.id);
        setCompareRunId(null);
        queryClient.invalidateQueries({ queryKey: ["finngen-run", run.id] });
      }
    },
  });
  const activeResult =
    activeService === "finngen_cohort_operations"
      ? cohortMutation.data
      : activeService === "finngen_co2_analysis"
        ? co2Mutation.data
        : activeService === "finngen_hades_extras"
          ? hadesMutation.data
          : romopapiMutation.data;

  return (
    <div className="space-y-6">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            backgroundColor: "rgba(155, 27, 48, 0.18)",
            flexShrink: 0,
          }}
        >
          <PanelsTopLeft size={22} style={{ color: "#9B1B30" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#F0EDE8", margin: 0 }}>
            Workbench
          </h1>
          <p style={{ fontSize: "13px", color: "#8A857D", margin: "2px 0 0" }}>
            Source-scoped FINNGEN previews for CohortOperations2,
            CO2AnalysisModules, HadesExtras, and ROMOPAPI
          </p>
        </div>
        <a
          href="/docs/community-workbench-sdk"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-2 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
        >
          Community Workbench SDK
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800/60"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#E85A6B]">
            <Sparkles className="h-3.5 w-3.5" />
            Phase 2A
          </div>
          <h2 className="text-lg font-semibold text-white">Real source selection, read-only preview flows</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Choose the Acumenus source, run a preview per FINNGEN service, and
            inspect the resulting visual contracts in the same shell used by the
            rest of Parthenon.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MetricCard icon={CheckCircle2} label="Services enabled" value={`${enabledCount}/${services.length || 4}`} accent="text-[#2DD4BF]" />
            <MetricCard icon={Database} label="Sources visible" value={sourcesLoading ? "..." : String(sources.length)} accent="text-[#60A5FA]" />
            <MetricCard icon={ShieldCheck} label="Warnings" value={String(warningCount)} accent={warningCount > 0 ? "text-[#E85A6B]" : "text-zinc-300"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/workbench/community-sdk-demo"
              className="inline-flex items-center gap-2 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-2 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
            >
              Explore SDK Demo Tool
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <GitBranchPlus className="h-4 w-4 text-[#9B1B30]" />
            Source Scope
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                CDM Source
              </span>
              <select
                value={selectedSourceId ?? ""}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setSelectedSourceId(nextId);
                  const nextSource = sources.find((source) => source.id === nextId);
                  setSchemaScope(getSchemaQualifier(nextSource, "cdm"));
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.source_name} ({source.source_key})
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-400">
              {selectedSource ? (
                <>
                  <div className="font-medium text-zinc-100">{selectedSource.source_name}</div>
                  <div className="mt-1">{selectedSource.source_key} · {selectedSource.source_dialect}</div>
                  <div className="mt-1">
                    CDM: {getSchemaQualifier(selectedSource, "cdm") || "n/a"} · Results: {getSchemaQualifier(selectedSource, "results") || "n/a"}
                  </div>
                </>
              ) : sourcesLoading ? (
                "Loading visible sources..."
              ) : (
                "No source is available for the current user."
              )}
            </div>
            {sourcesError ? (
              <div className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-3 py-2 text-sm text-[#F0EDE8]">
                {sourcesError}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {communityServices.length > 0 ? (
        <div className="rounded-lg border border-[#2DD4BF]/20 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-[#7CE8D5]">
                Community Tool Spotlight
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                SDK-generated optional tools can appear in Workbench discovery before they are promoted into deeper execution flows.
              </p>
            </div>
            <Link
              to="/workbench/community-sdk-demo"
              className="inline-flex items-center gap-2 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-2 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
            >
              Open Demo
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {communityServices.map((service) => (
              <CommunityToolCard key={service.name} service={service} />
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "2px", borderBottom: "1px solid #232328", overflowX: "auto" }}>
        {(isLoading ? serviceOrder : finngenServices.map((service) => service.name as ServiceName)).map((serviceName) => {
          const service = finngenServices.find((entry) => entry.name === serviceName);
          const descriptor = serviceDescriptors[serviceName];
          const Icon = serviceIcons[serviceName];

          return (
            <TabButton
              key={serviceName}
              active={serviceName === activeService}
              onClick={() => setActiveService(serviceName)}
              icon={<Icon size={15} />}
              label={descriptor.shortLabel}
              status={service?.implemented ? "Enabled" : "Pending"}
            />
          );
        })}
      </div>

      {selectedService ? (
        <div className="space-y-4">
          <ServiceHeader service={selectedService} />
          <RuntimePanel runtime={activeResult?.runtime} />
          <ResultPanel title="Recent Runs" loading={runsQuery.isLoading}>
            {runsQuery.data?.length ? (
              <RecentRunsView
                runs={runsQuery.data}
                selectedRunId={selectedRunId}
                onSelect={setSelectedRunId}
              />
            ) : (
              <EmptyState label="Run history for the active tool and source will appear here once executions are persisted." />
            )}
          </ResultPanel>
          <ResultPanel title="Run Inspector" loading={runDetailQuery.isLoading}>
            {runDetailQuery.data ? (
              <RunInspectorView
                run={runDetailQuery.data}
                onReplay={() => replayRunMutation.mutate(runDetailQuery.data?.id ?? 0)}
                onExport={async () => {
                  const bundle = await exportFinnGenRun(runDetailQuery.data?.id ?? 0);
                  if (bundle) {
                    downloadJson(`finngen-run-${runDetailQuery.data?.id}-bundle.json`, bundle);
                  }
                }}
                replaying={replayRunMutation.isPending}
              />
            ) : (
              <EmptyState label="Select a persisted run to inspect its request, runtime, artifacts, and stored result payload." />
            )}
          </ResultPanel>
          <ResultPanel title="Run Comparison" loading={compareRunDetailQuery.isLoading}>
            {runDetailQuery.data ? (
              <RunComparisonPanel
                runs={runsQuery.data ?? []}
                selectedRun={runDetailQuery.data}
                compareRun={compareRunDetailQuery.data}
                compareRunId={compareRunId}
                onCompareRunChange={setCompareRunId}
              />
            ) : (
              <EmptyState label="Select a primary persisted run first, then choose another run to compare summary and result deltas." />
            )}
          </ResultPanel>
          {activeService === "finngen_cohort_operations" ? (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
                <ControlHeader
                  title="Cohort Preview"
                  description="Start from existing Parthenon cohorts or a raw definition, then preview attrition outputs for the selected source."
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {cohortPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setCohortJson(preset.value)}
                      className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-[#9B1B30]/40 hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Operation Builder
                      </div>
                      <div className="mt-2 text-sm text-zinc-200">
                        {cohortImportModes.find((mode) => mode.value === cohortImportMode)?.label} · {cohortOperationTypes.find((mode) => mode.value === operationType)?.label} · {matchingEnabled ? cohortMatchingStrategies.find((strategy) => strategy.value === matchingStrategy)?.label : "Matching disabled"}
                      </div>
                      <div className="mt-2 text-xs text-zinc-500">
                        {selectedCohortLabels.length
                          ? `Selected Parthenon cohorts: ${selectedCohortLabels.join(", ")}`
                          : "No existing Parthenon cohorts selected yet."}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOperationBuilderOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#9B1B30]/40 bg-[#9B1B30]/10 px-3 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]/20"
                    >
                      <Blocks className="h-4 w-4" />
                      Open Operation Builder
                    </button>
                  </div>
                </div>
                <textarea
                  value={cohortJson}
                  onChange={(e) => setCohortJson(e.target.value)}
                  rows={16}
                  className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                />
                {cohortImportMode === "parthenon" && selectedPrimaryCohortQuery.isLoading ? (
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
                    Loading the primary Parthenon cohort definition for preview compilation.
                  </div>
                ) : null}
                <ActionButton
                  label="Run Cohort Preview"
                  onClick={() => cohortMutation.mutate()}
                  loading={cohortMutation.isPending}
                  disabled={!selectedSource || (cohortImportMode === "parthenon" && selectedCohortIds.length === 0)}
                />
                {cohortMutation.isError ? <ErrorBanner message={getErrorMessage(cohortMutation.error)} /> : null}
                <OperationBuilderModal
                  open={operationBuilderOpen}
                  onClose={() => setOperationBuilderOpen(false)}
                  cohortDefinitions={filteredCohorts}
                  selectedCohortIds={selectedCohortIds}
                  onToggleCohort={(cohortId) => {
                    setSelectedCohortIds((current) =>
                      current.includes(cohortId)
                        ? current.filter((id) => id !== cohortId)
                        : [...current, cohortId],
                    );
                    setCohortImportMode("parthenon");
                  }}
                  searchValue={cohortSearch}
                  onSearchChange={setCohortSearch}
                  importMode={cohortImportMode}
                  onImportModeChange={setCohortImportMode}
                  operationType={operationType}
                  onOperationTypeChange={setOperationType}
                  matchingEnabled={matchingEnabled}
                  onMatchingEnabledChange={setMatchingEnabled}
                  matchingStrategy={matchingStrategy}
                  onMatchingStrategyChange={setMatchingStrategy}
                  matchingCovariates={matchingCovariates}
                  onMatchingCovariatesChange={setMatchingCovariates}
                  matchingRatio={matchingRatio}
                  onMatchingRatioChange={setMatchingRatio}
                  matchingCaliper={matchingCaliper}
                  onMatchingCaliperChange={setMatchingCaliper}
                  atlasCohortIds={atlasCohortIds}
                  onAtlasCohortIdsChange={setAtlasCohortIds}
                  cohortTableName={cohortTableName}
                  onCohortTableNameChange={setCohortTableName}
                  exportTarget={exportTarget}
                  onExportTargetChange={setExportTarget}
                />
              </div>
              <div className="space-y-4">
                <ResultPanel title="Compile Summary" loading={cohortMutation.isPending}>
                  {cohortMutation.data ? (
                    <KeyValueGrid data={cohortMutation.data.compile_summary} />
                  ) : (
                    <EmptyState label="Compile details and source-backed cohort counts will appear here." />
                  )}
                </ResultPanel>
                <ResultPanel title="Attrition Funnel" loading={cohortMutation.isPending}>
                  {cohortMutation.data ? (
                    <AttritionView result={cohortMutation.data} />
                  ) : (
                    <EmptyState label="Run the cohort preview to inspect attrition and artifacts." />
                  )}
                </ResultPanel>
                <ResultPanel title="Criteria Timeline" loading={cohortMutation.isPending}>
                  {cohortMutation.data ? (
                    <TimelineView items={cohortMutation.data.criteria_timeline} />
                  ) : (
                    <EmptyState label="Timeline stages will appear here." />
                  )}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Import & Export" loading={cohortMutation.isPending}>
                    {cohortMutation.data ? (
                      <ImportExportView
                        importMode={cohortImportMode}
                        onImportModeChange={setCohortImportMode}
                        result={cohortMutation.data}
                      />
                    ) : (
                      <EmptyState label="Import posture and export artifacts will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Matching Review" loading={cohortMutation.isPending}>
                    {cohortMutation.data ? (
                      <MatchingReviewView result={cohortMutation.data} />
                    ) : (
                      <EmptyState label="Matching and set-operation diagnostics will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Operation Summary" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.operation_summary ? (
                      <KeyValueGrid data={cohortMutation.data.operation_summary} />
                    ) : (
                      <EmptyState label="Selected cohorts, operation type, and matching covariates will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Operation Evidence" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.operation_evidence?.length ? (
                      <OperationEvidenceView result={cohortMutation.data} />
                    ) : (
                      <EmptyState label="Operation-specific retained, excluded, and candidate row counts will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <ResultPanel title="Operation Comparison" loading={cohortMutation.isPending}>
                  {cohortMutation.data?.operation_comparison?.length ? (
                    <LabelValueList items={cohortMutation.data.operation_comparison.map((item) => ({ label: item.label, value: String(item.value) }))} />
                  ) : (
                    <EmptyState label="Baseline-versus-derived cohort comparison will appear here." />
                  )}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Selected Cohorts" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.selected_cohorts?.length ? (
                      <SelectedCohortsView cohorts={cohortMutation.data.selected_cohorts} />
                    ) : (
                      <EmptyState label="Existing Parthenon cohorts chosen in the operation builder will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Import Review" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.import_review?.length ? (
                      <StatusListView items={cohortMutation.data.import_review} />
                    ) : (
                      <EmptyState label="Import-path readiness will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Cohort Table Summary" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.cohort_table_summary && Object.keys(cohortMutation.data.cohort_table_summary).length ? (
                      <KeyValueGrid data={cohortMutation.data.cohort_table_summary} />
                    ) : (
                      <EmptyState label="Validated cohort-table schema, row count, and cohort ID discovery will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Export Summary" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.export_summary ? (
                      <CohortHandoffView
                        exportSummary={cohortMutation.data.export_summary}
                        onHandoff={() => {
                          const exportSummary = cohortMutation.data?.export_summary ?? {};
                          const operationSummary = cohortMutation.data?.operation_summary ?? {};
                          const matchingSummary = cohortMutation.data?.matching_summary ?? {};
                          const compileSummary = cohortMutation.data?.compile_summary ?? {};
                          const selectedCohorts = cohortMutation.data?.selected_cohorts ?? [];
                          setCohortLabel(
                            String(
                              exportSummary?.cohort_reference ??
                                exportSummary?.export_target ??
                                exportTarget,
                            ),
                          );
                          setOutcomeName(
                            `${String(exportSummary?.operation_type ?? operationType)} cohort outcome`,
                          );
                          setCo2CohortContext({
                            cohort_reference: exportSummary?.cohort_reference ?? null,
                            export_target: exportSummary?.export_target ?? null,
                            operation_type: exportSummary?.operation_type ?? operationType,
                            result_rows:
                              exportSummary?.result_rows ??
                              operationSummary?.result_rows ??
                              matchingSummary?.matched_rows ??
                              compileSummary?.derived_result_rows ??
                              null,
                            retained_ratio:
                              operationSummary?.retained_ratio ??
                              (typeof matchingSummary?.matched_rows === "number" &&
                              typeof matchingSummary?.eligible_rows === "number" &&
                              matchingSummary.eligible_rows > 0
                                ? Number((matchingSummary.matched_rows / matchingSummary.eligible_rows).toFixed(3))
                                : null),
                            selected_cohorts: selectedCohorts.map((cohort) => cohort.name),
                          });
                          setActiveService("finngen_co2_analysis");
                        }}
                      />
                    ) : (
                      <EmptyState label="Export target and handoff readiness will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Compiled SQL" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.sql_preview ? (
                      <CodeBlock title="Preview SQL" code={cohortMutation.data.sql_preview} />
                    ) : (
                      <EmptyState label="Compiled cohort SQL will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Sample Rows" loading={cohortMutation.isPending}>
                    {cohortMutation.data?.sample_rows?.length ? (
                      <RecordTable rows={cohortMutation.data.sample_rows} />
                    ) : (
                      <EmptyState label="First cohort preview rows will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <ResultPanel title="Plausibility Sample" loading={cohortMutation.isPending}>
                  {cohortMutation.data ? (
                    <PlausibilityView serviceName="finngen_cohort_operations" result={cohortMutation.data} />
                  ) : (
                    <EmptyState label="CDM-grounded plausibility signals will appear here once sample rows are available." />
                  )}
                </ResultPanel>
              </div>
            </div>
          ) : null}

          {activeService === "finngen_co2_analysis" ? (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
                <ControlHeader
                  title="Module Preview"
                  description="Select a module and outcome framing for the selected source."
                />
                <FormField label="Module key">
                  <select
                    value={moduleKey}
                    onChange={(e) => setModuleKey(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                  >
                    {moduleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Cohort label">
                  <input
                    value={cohortLabel}
                    onChange={(e) => setCohortLabel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                  />
                </FormField>
                <FormField label="Outcome name">
                  <input
                    value={outcomeName}
                    onChange={(e) => setOutcomeName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                  />
                </FormField>
                {moduleKey === "comparative_effectiveness" || moduleKey === "codewas_preview" ? (
                  <>
                    <FormField label="Comparator label">
                      <input
                        value={comparatorLabel}
                        onChange={(e) => setComparatorLabel(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                      />
                    </FormField>
                    <FormField label="Sensitivity label">
                      <input
                        value={sensitivityLabel}
                        onChange={(e) => setSensitivityLabel(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                      />
                    </FormField>
                  </>
                ) : null}
                {moduleKey === "cohort_demographics_preview" ? (
                  <FormField label="Stratify by">
                    <select
                      value={stratifyBy}
                      onChange={(e) => setStratifyBy(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {stratifyByOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}
                {moduleKey === "condition_burden" ? (
                  <FormField label="Burden domain">
                    <select
                      value={burdenDomain}
                      onChange={(e) => setBurdenDomain(e.target.value as (typeof burdenDomainOptions)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {burdenDomainOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}
                {moduleKey === "drug_utilization" ? (
                  <FormField label="Exposure window">
                    <select
                      value={exposureWindow}
                      onChange={(e) => setExposureWindow(e.target.value as (typeof exposureWindowOptions)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {exposureWindowOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}
                {moduleKey === "sex_stratified_preview" ? (
                  <FormField label="Stratify by">
                    <select
                      value={stratifyBy}
                      onChange={(e) => setStratifyBy(e.target.value as (typeof stratifyByOptions)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {stratifyByOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}
                <ActionButton
                  label="Run Module Preview"
                  onClick={() => co2Mutation.mutate()}
                  loading={co2Mutation.isPending}
                  disabled={!selectedSource}
                />
                {co2Mutation.isError ? <ErrorBanner message={getErrorMessage(co2Mutation.error)} /> : null}
              </div>
              <div className="space-y-4">
                <ResultPanel title="Derived Cohort Context" loading={co2Mutation.isPending}>
                  {co2Mutation.data?.cohort_context ? (
                    <KeyValueGrid data={co2Mutation.data.cohort_context} />
                  ) : co2CohortContext ? (
                    <KeyValueGrid data={co2CohortContext} />
                  ) : (
                    <EmptyState label="Cohort Ops handoff context will appear here once a derived cohort is passed into CO2 Modules." />
                  )}
                </ResultPanel>
                <ResultPanel title="Module Setup" loading={co2Mutation.isPending}>
                  {co2Mutation.data?.module_setup ? (
                    <KeyValueGrid data={co2Mutation.data.module_setup} />
                  ) : (
                    <EmptyState label="Family-specific setup will appear here once the selected module is configured." />
                  )}
                </ResultPanel>
                <ResultPanel title="Analysis Summary" loading={co2Mutation.isPending}>
                  {co2Mutation.data ? (
                    <KeyValueGrid data={co2Mutation.data.analysis_summary} />
                  ) : (
                    <EmptyState label="Module metadata and CDM-backed summary counts will appear here." />
                  )}
                </ResultPanel>
                <ResultPanel title="Handoff Impact" loading={co2Mutation.isPending}>
                  {co2Mutation.data?.handoff_impact?.length ? (
                    <Co2FamilyEvidenceView result={{ ...co2Mutation.data, family_evidence: co2Mutation.data.handoff_impact }} />
                  ) : (
                    <EmptyState label="Derived cohort impact will appear here after Cohort Ops hands a cohort into CO2 Modules." />
                  )}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Family Evidence" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.family_evidence?.length ? (
                      <Co2FamilyEvidenceView result={co2Mutation.data} />
                    ) : (
                      <EmptyState label="Module-family-specific evidence will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Family Notes" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.family_notes?.length ? (
                      <Co2FamilyNotesView result={co2Mutation.data} />
                    ) : (
                      <EmptyState label="Module-family guidance will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Family Result Summary" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.family_result_summary ? (
                      <KeyValueGrid data={co2Mutation.data.family_result_summary} />
                    ) : (
                      <EmptyState label="Family-specific output framing will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Family Result Table" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.result_table?.length ? (
                      <RecordTable rows={co2Mutation.data.result_table} />
                    ) : (
                      <EmptyState label="Family-specific result rows will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Family Spotlight" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.family_spotlight?.length ? (
                      <Co2SpotlightView result={co2Mutation.data} />
                    ) : (
                      <EmptyState label="Family-specific spotlight metrics will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Family Segments" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.family_segments?.length ? (
                      <Co2SegmentsView result={co2Mutation.data} />
                    ) : (
                      <EmptyState label="Family segmentation output will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <ResultPanel title="Forest Plot" loading={co2Mutation.isPending}>
                  {co2Mutation.data ? <ForestPlotView result={co2Mutation.data} /> : <EmptyState label="Preview estimates will appear here." />}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Module Gallery" loading={co2Mutation.isPending}>
                    {co2Mutation.data ? <ModuleGalleryView result={co2Mutation.data} /> : <EmptyState label="Module options will appear here." />}
                  </ResultPanel>
                  <ResultPanel title="Heatmap" loading={co2Mutation.isPending}>
                    {co2Mutation.data ? <HeatmapView result={co2Mutation.data} /> : <EmptyState label="Subgroup intensity will appear here." />}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Subgroup Balance" loading={co2Mutation.isPending}>
                    {co2Mutation.data ? <SubgroupBalanceView result={co2Mutation.data} /> : <EmptyState label="Subgroup comparisons will appear here." />}
                  </ResultPanel>
                  <ResultPanel title="Phenotype Scoring Lens" loading={co2Mutation.isPending}>
                    {co2Mutation.data ? <PhenotypeScoringView result={co2Mutation.data} /> : <EmptyState label="Signal-weighted scoring output will appear here." />}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Module Validation" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.module_validation?.length ? (
                      <StatusListView items={co2Mutation.data.module_validation} />
                    ) : (
                      <EmptyState label="Module settings and result validation will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Overlap Matrix" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.overlap_matrix?.length ? (
                      <OverlapMatrixView result={co2Mutation.data} />
                    ) : (
                      <EmptyState label="Overlap-style views will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <ResultPanel title="Time Profile" loading={co2Mutation.isPending}>
                  {co2Mutation.data?.time_profile?.length ? (
                    <TimeProfileView result={co2Mutation.data} />
                  ) : (
                    <EmptyState label="Temporal analysis slices will appear here." />
                  )}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Subgroup Summary" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.subgroup_summary?.length ? (
                      <LabelValueList items={co2Mutation.data.subgroup_summary} />
                    ) : (
                      <EmptyState label="Family subgroup framing will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Temporal Windows" loading={co2Mutation.isPending}>
                    {co2Mutation.data?.temporal_windows?.length ? (
                      <TemporalWindowsView result={co2Mutation.data} />
                    ) : (
                      <EmptyState label="Windowed temporal results will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Utilization Trend" loading={co2Mutation.isPending}>
                    {co2Mutation.data ? <TrendView result={co2Mutation.data} /> : <EmptyState label="Event trends will appear here." />}
                  </ResultPanel>
                  <ResultPanel title="Top Signals" loading={co2Mutation.isPending}>
                    {co2Mutation.data ? <TopSignalsView result={co2Mutation.data} /> : <EmptyState label="Leading concepts will appear here." />}
                  </ResultPanel>
                </div>
                <ResultPanel title="Plausibility Sample" loading={co2Mutation.isPending}>
                  {co2Mutation.data ? (
                    <PlausibilityView serviceName="finngen_co2_analysis" result={co2Mutation.data} />
                  ) : (
                    <EmptyState label="CDM-grounded domain and signal plausibility will appear here." />
                  )}
                </ResultPanel>
                <ResultPanel title="Execution Timeline" loading={co2Mutation.isPending}>
                  {co2Mutation.data ? <ExecutionTimelineView result={co2Mutation.data} /> : <EmptyState label="Execution stages will appear here." />}
                </ResultPanel>
              </div>
            </div>
          ) : null}

          {activeService === "finngen_hades_extras" ? (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
                <ControlHeader
                  title="Render Preview"
                  description="Render SQL and package artifacts for the selected source."
                />
                <FormField label="Package name">
                  <input
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                  />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Config profile">
                    <select
                      value={hadesConfigProfile}
                      onChange={(e) => setHadesConfigProfile(e.target.value as (typeof hadesConfigProfiles)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {hadesConfigProfiles.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Artifact mode">
                    <select
                      value={hadesArtifactMode}
                      onChange={(e) => setHadesArtifactMode(e.target.value as (typeof hadesArtifactModes)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {hadesArtifactModes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Package skeleton">
                    <select
                      value={hadesPackageSkeleton}
                      onChange={(e) => setHadesPackageSkeleton(e.target.value as (typeof hadesPackageSkeletons)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {hadesPackageSkeletons.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Cohort table">
                    <input
                      value={hadesCohortTable}
                      onChange={(e) => setHadesCohortTable(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    />
                  </FormField>
                </div>
                <FormField label="SQL template">
                  <textarea
                    value={sqlTemplate}
                    onChange={(e) => setSqlTemplate(e.target.value)}
                    rows={12}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                  />
                </FormField>
                <ActionButton
                  label="Render Preview"
                  onClick={() => hadesMutation.mutate()}
                  loading={hadesMutation.isPending}
                  disabled={!selectedSource}
                />
                {hadesMutation.isError ? <ErrorBanner message={getErrorMessage(hadesMutation.error)} /> : null}
              </div>
              <div className="space-y-4">
                <ResultPanel title="Package Setup" loading={hadesMutation.isPending}>
                  {hadesMutation.data?.package_setup ? (
                    <KeyValueGrid data={hadesMutation.data.package_setup} />
                  ) : (
                    <EmptyState label="Applied HADES package setup will appear here once the render profile is configured." />
                  )}
                </ResultPanel>
                <ResultPanel title="Render Summary" loading={hadesMutation.isPending}>
                  {hadesMutation.data ? (
                    <KeyValueGrid data={hadesMutation.data.render_summary} />
                  ) : (
                    <EmptyState label="Rendered package metadata and target dialect details will appear here." />
                  )}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Connection Context" loading={hadesMutation.isPending}>
                    {hadesMutation.data ? (
                      <KeyValueGrid data={hadesMutation.data.source} />
                    ) : (
                      <EmptyState label="Selected source schema and dialect context will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="SQL Diff Lens" loading={hadesMutation.isPending}>
                    {hadesMutation.data ? (
                      <SqlDiffView result={hadesMutation.data} />
                    ) : (
                      <EmptyState label="Template versus rendered SQL changes will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Config Summary" loading={hadesMutation.isPending}>
                    {hadesMutation.data?.config_summary ? (
                      <KeyValueGrid data={hadesMutation.data.config_summary} />
                    ) : (
                      <EmptyState label="Runner config and cohort-table bindings will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Cohort Summary" loading={hadesMutation.isPending}>
                    {hadesMutation.data?.cohort_summary?.length ? (
                      <LabelValueList items={hadesMutation.data.cohort_summary} />
                    ) : (
                      <EmptyState label="Upstream cohort summary helpers will surface here." />
                    )}
                  </ResultPanel>
                </div>
                <ResultPanel title="Operation Lineage" loading={hadesMutation.isPending}>
                  {hadesMutation.data ? (
                    <OperationLineageView result={hadesMutation.data} />
                  ) : (
                    <EmptyState label="Render lineage and schema substitutions will appear here." />
                  )}
                </ResultPanel>
                <ResultPanel title="SQL Preview" loading={hadesMutation.isPending}>
                  {hadesMutation.data ? <SqlPreviewView result={hadesMutation.data} /> : <EmptyState label="Rendered SQL will appear here." />}
                </ResultPanel>
                <ResultPanel title="Artifact Pipeline" loading={hadesMutation.isPending}>
                  {hadesMutation.data ? <PipelineView result={hadesMutation.data} /> : <EmptyState label="Artifact stages will appear here." />}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Package Manifest" loading={hadesMutation.isPending}>
                    {hadesMutation.data?.package_manifest?.length ? (
                      <PackageManifestView result={hadesMutation.data} />
                    ) : (
                      <EmptyState label="Package manifest entries will appear here once the render prepares export files." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Package Bundle" loading={hadesMutation.isPending}>
                    {hadesMutation.data?.package_bundle ? (
                      <PackageBundleView result={hadesMutation.data} />
                    ) : (
                      <EmptyState label="Bundle metadata and download actions will appear here once HADES prepares a package export." />
                    )}
                  </ResultPanel>
                </div>
                <ResultPanel title="Plausibility Sample" loading={hadesMutation.isPending}>
                  {hadesMutation.data ? (
                    <PlausibilityView serviceName="finngen_hades_extras" result={hadesMutation.data} />
                  ) : (
                    <EmptyState label="Rendered SQL and explain-plan plausibility will appear here." />
                  )}
                </ResultPanel>
              </div>
            </div>
          ) : null}

          {activeService === "finngen_romopapi" ? (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
                <ControlHeader
                  title="Metadata & Query Plan"
                  description="Preview schema scope and query lineage for the selected source."
                />
                <FormField label="Schema scope">
                  <input
                    value={schemaScope}
                    onChange={(e) => setSchemaScope(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                  />
                </FormField>
                <FormField label="Query template">
                  <textarea
                    value={queryTemplate}
                    onChange={(e) => setQueryTemplate(e.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                  />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Concept domain">
                    <select
                      value={conceptDomain}
                      onChange={(e) => setConceptDomain(e.target.value as (typeof romopapiDomainOptions)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {romopapiDomainOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Stratify by">
                    <select
                      value={romopapiStratifyBy}
                      onChange={(e) => setRomopapiStratifyBy(e.target.value as (typeof romopapiStratifyOptions)[number]["value"])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {romopapiStratifyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Result limit">
                    <select
                      value={String(resultLimit)}
                      onChange={(e) => setResultLimit(Number(e.target.value) as (typeof romopapiLimitOptions)[number])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {romopapiLimitOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Lineage depth">
                    <select
                      value={String(lineageDepth)}
                      onChange={(e) => setLineageDepth(Number(e.target.value) as (typeof romopapiLineageDepthOptions)[number])}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
                    >
                      {romopapiLineageDepthOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <div className="flex flex-wrap gap-2">
                  {queryTemplates.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setQueryTemplate(template)}
                      className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-[#9B1B30]/40 hover:text-white"
                    >
                      {template}
                    </button>
                  ))}
                </div>
                <ActionButton
                  label="Run Query Plan Preview"
                  onClick={() => romopapiMutation.mutate()}
                  loading={romopapiMutation.isPending}
                  disabled={!selectedSource}
                />
                {romopapiMutation.isError ? <ErrorBanner message={getErrorMessage(romopapiMutation.error)} /> : null}
              </div>
              <div className="space-y-4">
                <ResultPanel title="Query Controls" loading={romopapiMutation.isPending}>
                  {romopapiMutation.data?.query_controls ? (
                    <KeyValueGrid data={romopapiMutation.data.query_controls} />
                  ) : (
                    <EmptyState label="Applied domain, stratification, limit, and lineage controls will appear here." />
                  )}
                </ResultPanel>
                <ResultPanel title="Metadata Summary" loading={romopapiMutation.isPending}>
                  {romopapiMutation.data ? (
                    <KeyValueGrid data={romopapiMutation.data.metadata_summary} />
                  ) : (
                    <EmptyState label="Schema scope, dialect, and surfaced table counts will appear here." />
                  )}
                </ResultPanel>
                <ResultPanel title="Schema Graph" loading={romopapiMutation.isPending}>
                  {romopapiMutation.data ? <SchemaNodeView result={romopapiMutation.data} /> : <EmptyState label="Schema nodes will appear here." />}
                </ResultPanel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Hierarchy Map" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data ? <HierarchyMapView result={romopapiMutation.data} /> : <EmptyState label="Hierarchy traversal will appear here." />}
                  </ResultPanel>
                  <ResultPanel title="Schema Density" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data ? <SchemaDensityView result={romopapiMutation.data} /> : <EmptyState label="Table connection density will appear here." />}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Count Surface" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data ? <CountSurfaceView result={romopapiMutation.data} /> : <EmptyState label="Estimated count surfaces will appear here." />}
                  </ResultPanel>
                  <ResultPanel title="Report Preview" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data ? <ReportPreviewView result={romopapiMutation.data} /> : <EmptyState label="Report summary and export actions will appear here." />}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Code Counts" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data?.code_counts?.length ? (
                      <CodeCountsView result={romopapiMutation.data} />
                    ) : (
                      <EmptyState label="Concept count outputs will appear here." />
                    )}
                  </ResultPanel>
                  <ResultPanel title="Stratified Counts" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data?.stratified_counts?.length ? (
                      <StratifiedCountsView result={romopapiMutation.data} />
                    ) : (
                      <EmptyState label="Stratified result surfaces will appear here." />
                    )}
                  </ResultPanel>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ResultPanel title="Lineage" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data ? <LineageView result={romopapiMutation.data} /> : <EmptyState label="Join lineage will appear here." />}
                  </ResultPanel>
                  <ResultPanel title="Result Profile" loading={romopapiMutation.isPending}>
                    {romopapiMutation.data ? <ResultProfileView result={romopapiMutation.data} /> : <EmptyState label="Projected query profile will appear here." />}
                  </ResultPanel>
                </div>
                <ResultPanel title="Query Plan" loading={romopapiMutation.isPending}>
                  {romopapiMutation.data ? (
                    <KeyValueGrid data={romopapiMutation.data.query_plan} />
                  ) : (
                    <EmptyState label="Join and filter planning details will appear here." />
                  )}
                </ResultPanel>
                <ResultPanel title="Plausibility Sample" loading={romopapiMutation.isPending}>
                  {romopapiMutation.data ? (
                    <PlausibilityView serviceName="finngen_romopapi" result={romopapiMutation.data} />
                  ) : (
                    <EmptyState label="Code-count and schema plausibility will appear here." />
                  )}
                </ResultPanel>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
          No FINNGEN services are visible yet. Enable the FINNGEN flags in the StudyAgent runtime.
        </div>
      )}

      {(isError || warningCount > 0) && (
        <div className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 p-4">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
            <div>
              <div className="text-sm font-medium text-[#F0EDE8]">Registry diagnostics</div>
              <div className="mt-1 space-y-1 text-sm text-zinc-300">
                {isError ? <div>Workbench metadata could not be loaded from StudyAgent.</div> : null}
                {data?.warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommunityToolCard({ service }: { service: FinnGenService }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">
              {service.ui_hints?.title ?? service.name}
            </h2>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${service.implemented ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-zinc-800 text-zinc-300"}`}>
              {service.implemented ? "Enabled" : "Pending"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {service.ui_hints?.summary ?? service.description ?? "Community-generated workbench tool"}
          </p>
        </div>
        <div className="rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#7CE8D5]">
          Sample
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/workbench/community-sdk-demo"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          View Demo
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <a
          href="/docs/community-workbench-sdk"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          SDK Docs
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <button
          type="button"
          disabled
          title="Stub for the future in-workbench execution surface for community tools."
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-500 opacity-70"
        >
          Execution Surface Stub
        </button>
      </div>
    </div>
  );
}

function ServiceHeader({ service }: { service: FinnGenService }) {
  const name = service.name as ServiceName;
  const descriptor = serviceDescriptors[name];
  const Icon = serviceIcons[name];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${descriptor.accent}22` }}>
            <Icon className="h-5 w-5" style={{ color: descriptor.accent }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                {service.ui_hints?.title ?? descriptor.shortLabel}
              </h2>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${service.implemented ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-zinc-800 text-zinc-300"}`}>
                {service.implemented ? "Enabled" : "Pending"}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {service.ui_hints?.summary ?? descriptor.summary}
            </p>
          </div>
        </div>
        {service.ui_hints?.repository ? (
          <a
            href={service.ui_hints.repository}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/70 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Repository
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function RuntimePanel({ runtime }: { runtime?: FinnGenRuntime }) {
  if (!runtime) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
        Run the active tool once to inspect its execution path and adapter readiness.
      </div>
    );
  }

  const accentClass =
    runtime.mode === "parthenon_native"
      ? "border-[#C9A227]/30 bg-[#C9A227]/10 text-[#F3D97A]"
      : "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#7CE8D5]";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">Runtime Path</div>
          <div className="mt-1 text-sm text-zinc-400">
            {runtime.mode_label}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}>
          {runtime.fallback_active ? "Fallback Active" : "Adapter Configured"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RuntimeMetric
          label="Mode"
          value={runtime.mode.replaceAll("_", " ")}
        />
        <RuntimeMetric
          label="Adapter"
          value={runtime.adapter_configured ? "Configured" : "Not configured"}
        />
        <RuntimeMetric
          label="Capabilities"
          value={String(
            Object.values(runtime.capabilities ?? {}).filter(Boolean).length,
          )}
        />
      </div>
      {(runtime.adapter_label ||
        runtime.upstream_package ||
        runtime.upstream_repo_path ||
        runtime.missing_dependencies?.length) ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <RuntimeMetric
            label="Adapter Engine"
            value={runtime.adapter_label ?? "Unknown"}
          />
          <RuntimeMetric
            label="Upstream Package"
            value={runtime.upstream_package ?? "Unavailable"}
          />
          <RuntimeMetric
            label="Upstream Ready"
            value={
              runtime.upstream_ready == null
                ? "Unknown"
                : runtime.upstream_ready
                  ? "Ready"
                  : "Blocked"
            }
          />
          <RuntimeMetric
            label="Compatibility Mode"
            value={
              runtime.compatibility_mode == null
                ? "Unknown"
                : runtime.compatibility_mode
                  ? "Enabled"
                  : "Disabled"
            }
          />
        </div>
      ) : null}
      {runtime.notes?.length ? (
        <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
          {runtime.notes.map((note) => (
            <div key={note}>{note}</div>
          ))}
          {runtime.upstream_repo_path ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-zinc-300">
              Repo: {runtime.upstream_repo_path}
            </div>
          ) : null}
          {runtime.missing_dependencies?.length ? (
            <div className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-3 py-2 text-[#F3D97A]">
              Missing dependencies: {runtime.missing_dependencies.join(", ")}
            </div>
          ) : null}
          {runtime.last_error ? (
            <div className="rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2 text-[#F0EDE8]">
              {runtime.last_error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ControlHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function SelectedCohortsView({ cohorts }: { cohorts: Array<{ id: number; name: string; description?: string | null }> }) {
  return (
    <div className="space-y-2">
      {cohorts.map((cohort) => (
        <div
          key={cohort.id}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3"
        >
          <div className="text-sm font-medium text-zinc-100">{cohort.name}</div>
          <div className="mt-1 text-xs text-zinc-500">Parthenon cohort #{cohort.id}</div>
          {cohort.description ? (
            <div className="mt-2 text-sm text-zinc-400">{cohort.description}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface OperationBuilderModalProps {
  open: boolean;
  onClose: () => void;
  cohortDefinitions: CohortDefinition[];
  selectedCohortIds: number[];
  onToggleCohort: (cohortId: number) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  importMode: (typeof cohortImportModes)[number]["value"];
  onImportModeChange: (value: (typeof cohortImportModes)[number]["value"]) => void;
  operationType: (typeof cohortOperationTypes)[number]["value"];
  onOperationTypeChange: (value: (typeof cohortOperationTypes)[number]["value"]) => void;
  matchingEnabled: boolean;
  onMatchingEnabledChange: (value: boolean) => void;
  matchingStrategy: (typeof cohortMatchingStrategies)[number]["value"];
  onMatchingStrategyChange: (value: (typeof cohortMatchingStrategies)[number]["value"]) => void;
  matchingCovariates: string;
  onMatchingCovariatesChange: (value: string) => void;
  matchingRatio: string;
  onMatchingRatioChange: (value: string) => void;
  matchingCaliper: string;
  onMatchingCaliperChange: (value: string) => void;
  atlasCohortIds: string;
  onAtlasCohortIdsChange: (value: string) => void;
  cohortTableName: string;
  onCohortTableNameChange: (value: string) => void;
  exportTarget: string;
  onExportTargetChange: (value: string) => void;
}

function OperationBuilderModal({
  open,
  onClose,
  cohortDefinitions,
  selectedCohortIds,
  onToggleCohort,
  searchValue,
  onSearchChange,
  importMode,
  onImportModeChange,
  operationType,
  onOperationTypeChange,
  matchingEnabled,
  onMatchingEnabledChange,
  matchingStrategy,
  onMatchingStrategyChange,
  matchingCovariates,
  onMatchingCovariatesChange,
  matchingRatio,
  onMatchingRatioChange,
  matchingCaliper,
  onMatchingCaliperChange,
  atlasCohortIds,
  onAtlasCohortIdsChange,
  cohortTableName,
  onCohortTableNameChange,
  exportTarget,
  onExportTargetChange,
}: OperationBuilderModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Operation Builder"
      size="xl"
      footer={(
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            Builder choices are stored with the FINNGEN run and reused on replay.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#7F1526]"
          >
            Apply Builder
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Import path</span>
            <select
              value={importMode}
              onChange={(e) => onImportModeChange(e.target.value as (typeof cohortImportModes)[number]["value"])}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {cohortImportModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Operation type</span>
            <select
              value={operationType}
              onChange={(e) => onOperationTypeChange(e.target.value as (typeof cohortOperationTypes)[number]["value"])}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {cohortOperationTypes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Existing Parthenon Cohorts</div>
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter cohorts by name or description..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#9B1B30] focus:outline-none"
          />
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {cohortDefinitions.map((cohort) => {
              const selected = selectedCohortIds.includes(cohort.id);
              return (
                <label
                  key={cohort.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
                    selected
                      ? "border-[#9B1B30]/40 bg-[#9B1B30]/10"
                      : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleCohort(cohort.id)}
                    className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-[#9B1B30] focus:ring-[#9B1B30]"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100">{cohort.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">Cohort #{cohort.id}</div>
                    {cohort.description ? (
                      <div className="mt-2 text-sm text-zinc-400">{cohort.description}</div>
                    ) : null}
                  </div>
                </label>
              );
            })}
            {!cohortDefinitions.length ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-4 text-sm text-zinc-500">
                No visible Parthenon cohorts match this filter.
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Atlas cohort IDs</span>
            <input
              value={atlasCohortIds}
              onChange={(e) => onAtlasCohortIdsChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Cohort table name</span>
            <input
              value={cohortTableName}
              onChange={(e) => onCohortTableNameChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">Matching</div>
              <div className="mt-1 text-xs text-zinc-500">
                Use the same guided setup style as the rest of Parthenon for matching and balance inputs.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={matchingEnabled}
              onClick={() => onMatchingEnabledChange(!matchingEnabled)}
              className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                matchingEnabled ? "bg-[#9B1B30]" : "bg-zinc-700"
              }`}
            >
              <span
                className={`ml-1 h-4 w-4 rounded-full bg-white transition-transform ${
                  matchingEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Matching strategy</span>
              <select
                value={matchingStrategy}
                onChange={(e) => onMatchingStrategyChange(e.target.value as (typeof cohortMatchingStrategies)[number]["value"])}
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              >
                {cohortMatchingStrategies.map((strategy) => (
                  <option key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Matching covariates</span>
              <input
                value={matchingCovariates}
                onChange={(e) => onMatchingCovariatesChange(e.target.value)}
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Match ratio</span>
              <input
                value={matchingRatio}
                onChange={(e) => onMatchingRatioChange(e.target.value)}
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Caliper</span>
              <input
                value={matchingCaliper}
                onChange={(e) => onMatchingCaliperChange(e.target.value)}
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Export target / handoff</span>
          <input
            value={exportTarget}
            onChange={(e) => onExportTargetChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}

function ActionButton({
  label,
  onClick,
  loading,
  disabled,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#9B1B30]/80 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {label}
    </button>
  );
}

function ResultPanel({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-3 text-sm font-medium text-white">{title}</div>
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running preview...
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function RuntimeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-sm font-medium capitalize text-zinc-100">{value}</div>
    </div>
  );
}

function AttritionView({ result }: { result: FinnGenCohortOperationsResult }) {
  const maxCount = Math.max(...result.attrition.map((item) => item.count ?? 0), 1);

  return (
    <div className="space-y-4">
      {result.attrition.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-zinc-200">{item.label}</span>
            <span className="text-zinc-400">{item.count?.toLocaleString()} · {item.percent}%</span>
          </div>
          <div className="h-3 rounded-full bg-zinc-800">
            <div
              className="h-3 rounded-full bg-[#9B1B30] transition-all"
              style={{ width: `${((item.count ?? 0) / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Artifacts</div>
        <div className="space-y-2 text-sm text-zinc-300">
          {result.artifacts.map((artifact) => (
            <div key={artifact.name}>{artifact.name} · {artifact.summary}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineView({ items }: { items: FinnGenCohortOperationsResult["criteria_timeline"] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={`${item.step}-${item.title}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-100">{item.title}</div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
              {item.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">{item.window}</div>
          <div className="mt-2 text-sm text-zinc-300">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ImportExportView({
  importMode,
  onImportModeChange,
  result,
}: {
  importMode: (typeof cohortImportModes)[number]["value"];
  onImportModeChange: (value: (typeof cohortImportModes)[number]["value"]) => void;
  result: FinnGenCohortOperationsResult;
}) {
  const sourceKey = String(result.compile_summary.source_key ?? result.source.source_key ?? "source");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {cohortImportModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onImportModeChange(mode.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              importMode === mode.value
                ? "border-[#9B1B30]/40 bg-[#9B1B30]/10 text-[#E85A6B]"
                : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-[#9B1B30]/30 hover:text-white"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        {importMode === "parthenon"
          ? `Existing Parthenon cohorts are active. This preview now uses the selected cohort set and the chosen operation semantics before exporting the derived cohort and handoff artifacts.`
          : importMode === "atlas"
          ? `Atlas/WebAPI import is the target parity path. This preview is compiled for ${sourceKey} and can already be exported as SQL and sample artifacts.`
          : importMode === "cohort_table"
            ? `Cohort-table import is now validating the selected table against the source and exposing discovered cohort IDs, row counts, and downstream artifacts.`
            : `JSON definition import is active now. This preview uses the current definition payload and returns the first exportable artifacts below.`}
      </div>
      <div className="space-y-2">
        {result.artifacts.map((artifact) => (
          <div key={artifact.name} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-100">{artifact.name}</div>
              <div className="mt-1 text-xs text-zinc-500">{artifact.summary ?? artifact.type ?? "Artifact"}</div>
            </div>
            <button
              type="button"
              onClick={() => downloadJson(`${artifact.name.replaceAll("/", "_")}.json`, artifact)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-[#9B1B30]/30 hover:text-white"
            >
              Export
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CohortHandoffView({
  exportSummary,
  onHandoff,
}: {
  exportSummary: Record<string, unknown>;
  onHandoff: () => void;
}) {
  const handoffReady = Boolean(exportSummary.handoff_ready);

  return (
    <div className="space-y-4">
      <KeyValueGrid data={exportSummary} />
      <button
        type="button"
        onClick={onHandoff}
        disabled={!handoffReady}
        className="inline-flex items-center gap-2 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ArrowUpRight className="h-4 w-4" />
        Hand Off To CO2 Modules
      </button>
    </div>
  );
}

function MatchingReviewView({ result }: { result: FinnGenCohortOperationsResult }) {
  const compiled = Number(result.compile_summary.criteria_count ?? 0);
  const additional = Number(result.compile_summary.additional_criteria_count ?? 0);
  const baseline = Math.max(Number(result.matching_summary?.eligible_rows ?? result.compile_summary.cohort_count ?? 0), 1);
  const matched = Math.max(0, Number(result.matching_summary?.matched_rows ?? Math.round(baseline * 0.84)));
  const excluded = Math.max(0, Number(result.matching_summary?.excluded_rows ?? baseline - matched));
  const strategy = String(result.matching_summary?.match_strategy ?? "nearest-neighbor preview");
  const ratio = String(result.matching_summary?.match_ratio ?? "1.0");
  const caliper = String(result.matching_summary?.match_caliper ?? "0.20");
  const balanceScore = Number(result.matching_summary?.balance_score ?? 0);
  const operationType = String(result.operation_summary?.operation_type ?? result.compile_summary.operation_type ?? "union");
  const operationPhrase = String(result.operation_summary?.operation_phrase ?? "set-operation preview");
  const matchedSamples = Array.isArray(result.matching_review?.matched_samples) ? result.matching_review?.matched_samples ?? [] : [];
  const excludedSamples = Array.isArray(result.matching_review?.excluded_samples) ? result.matching_review?.excluded_samples ?? [] : [];
  const balanceNotes = Array.isArray(result.matching_review?.balance_notes) ? result.matching_review?.balance_notes ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <MiniMetric label="Primary rules" value={String(compiled)} />
        <MiniMetric label="Additional rules" value={String(additional)} />
        <MiniMetric label="Matched rows" value={matched.toLocaleString()} />
        <MiniMetric label="Ratio" value={ratio} />
        <MiniMetric label="Caliper" value={caliper} />
      </div>
      <div className="space-y-3">
        <ProgressRow label="Eligible set" value={baseline} total={baseline} color="#60A5FA" />
        <ProgressRow label="Matched set" value={matched} total={baseline} color="#2DD4BF" />
        <ProgressRow label="Excluded in review" value={excluded} total={baseline} color="#C9A227" />
      </div>
      {balanceScore > 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Balance score</div>
          <ProgressRow label="Estimated balance" value={Math.round(balanceScore * 100)} total={100} color="#2DD4BF" />
        </div>
      ) : null}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        {operationType.toUpperCase()} preview with {operationPhrase}. Matching strategy: {strategy}.
      </div>
      {balanceNotes.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Balance notes</div>
          <div className="space-y-2 text-sm text-zinc-300">
            {balanceNotes.map((note) => (
              <div key={note}>{note}</div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Matched samples</div>
          {matchedSamples.length ? <RecordTable rows={matchedSamples} /> : <EmptyState label="Matched sample evidence will appear here." />}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Excluded samples</div>
          {excludedSamples.length ? <RecordTable rows={excludedSamples} /> : <EmptyState label="Excluded sample evidence will appear here." />}
        </div>
      </div>
    </div>
  );
}

function OperationEvidenceView({ result }: { result: FinnGenCohortOperationsResult }) {
  const evidence = result.operation_evidence ?? [];

  return (
    <div className="space-y-3">
      {evidence.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={Number(item.value ?? 0)}
          total={Math.max(Number(result.operation_summary?.candidate_rows ?? evidence[0]?.value ?? 1), 1)}
          color={
            item.emphasis === "result"
              ? "#2DD4BF"
              : item.emphasis === "delta"
                ? "#C9A227"
                : "#60A5FA"
          }
        />
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        Derived cohort: {String(result.operation_summary?.derived_cohort_label ?? result.export_summary?.cohort_reference ?? "Workbench cohort preview")}
      </div>
    </div>
  );
}

function ForestPlotView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const family = String(result.module_family ?? result.analysis_summary.module_family ?? "comparative_effectiveness");
  const titleLabel =
    family === "condition_burden"
      ? "Burden intensity"
      : family === "drug_utilization"
        ? "Exposure intensity"
        : family === "sex_stratified"
          ? "Sex-stratified effect"
          : "Comparative effect";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs uppercase tracking-wide text-zinc-400">
        {titleLabel}
      </div>
      {result.forest_plot.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-200">{item.label}</span>
            <span className="text-zinc-400">
              HR {item.effect} ({item.lower}, {item.upper})
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-zinc-800">
            <div className="absolute left-1/2 top-[-4px] h-4 w-px bg-[#C9A227]" />
            <div
              className="absolute top-0 h-2 rounded-full bg-[#9B1B30]"
              style={{
                left: `${Math.max(0, ((item.lower ?? 0.5) / 2) * 100)}%`,
                width: `${Math.max(4, (((item.upper ?? 1) - (item.lower ?? 0.5)) / 2) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ModuleGalleryView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-2">
      {result.module_gallery.map((item) => (
        <div key={item.name} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">{item.name}</div>
              <div className="mt-1 text-xs text-zinc-500">{item.family}</div>
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${item.status === "selected" ? "bg-[#9B1B30]/15 text-[#E85A6B]" : "bg-zinc-800 text-zinc-300"}`}>
              {item.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Co2FamilyEvidenceView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-3">
      {result.family_evidence?.map((item) => (
        <div
          key={item.label}
          className={`rounded-lg border px-3 py-3 ${
            item.emphasis === "result"
              ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10"
              : item.emphasis === "delta"
                ? "border-[#C9A227]/30 bg-[#C9A227]/10"
                : "border-zinc-800 bg-zinc-950/70"
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
          <div className="mt-2 text-lg font-semibold text-zinc-100">{String(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

function Co2FamilyNotesView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-2">
      {result.family_notes?.map((note) => (
        <div
          key={note}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm text-zinc-300"
        >
          {note}
        </div>
      ))}
    </div>
  );
}

function Co2SpotlightView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-3">
      {(result.family_spotlight ?? []).map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
          <div className="mt-2 text-lg font-semibold text-zinc-100">{String(item.value)}</div>
          {item.detail ? <div className="mt-1 text-xs text-zinc-400">{item.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

function Co2SegmentsView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const segments = result.family_segments ?? [];
  const maxCount = Math.max(...segments.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {segments.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={item.count}
          total={maxCount}
          color="#2DD4BF"
          suffix={typeof item.share === "number" ? `${Math.round(item.share * 100)}%` : undefined}
        />
      ))}
    </div>
  );
}

function HeatmapView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {result.heatmap.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 p-4"
          style={{ backgroundColor: `rgba(201, 162, 39, ${0.12 + item.value * 0.6})` }}
        >
          <div className="text-sm font-medium text-zinc-100">{item.label}</div>
          <div className="mt-1 text-xs text-zinc-800">{item.value.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}

function TrendView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const maxCount = Math.max(...result.utilization_trend.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {result.utilization_trend.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-zinc-300">{item.label}</span>
            <span className="text-zinc-500">{item.count.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#C9A227]"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TopSignalsView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-2">
      {result.top_signals.map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{item.label}</div>
            <div className="text-xs text-zinc-500">{item.count.toLocaleString()} events</div>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#2DD4BF]"
              style={{
                width: `${Math.min(100, (item.count / Math.max(...result.top_signals.map((signal) => signal.count), 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExecutionTimelineView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-3">
      {result.execution_timeline.map((item) => (
        <div key={`${item.stage}-${item.duration_ms}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-100">{item.stage}</div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
              {item.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {typeof item.duration_ms === "number" ? `${item.duration_ms} ms` : "n/a"}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubgroupBalanceView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const total = Math.max(
    ...result.heatmap.map((item) => item.value),
    0,
  );

  return (
    <div className="space-y-3">
      {result.heatmap.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={Math.round(item.value * 1000)}
          total={Math.round(total * 1000) || 1}
          color="#C9A227"
          suffix={`${Math.round(item.value * 100)}%`}
        />
      ))}
    </div>
  );
}

function PhenotypeScoringView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const maxSignals = Math.max(...result.top_signals.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {result.top_signals.slice(0, 4).map((item, index) => {
        const score = item.count / maxSignals;
        return (
          <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-100">{item.label}</div>
              <div className="text-xs text-zinc-500">Score {(score * 100).toFixed(0)}</div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div
                className="h-2 rounded-full bg-[#9B1B30]"
                style={{ width: `${score * 100}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Rank {index + 1} of {result.top_signals.length} candidate phenotypes
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OverlapMatrixView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {(result.overlap_matrix ?? []).map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 p-4"
          style={{ backgroundColor: `rgba(155, 27, 48, ${0.14 + item.value * 0.45})` }}
        >
          <div className="text-sm font-medium text-zinc-100">{item.label}</div>
          <div className="mt-2 text-xl font-semibold text-white">{Math.round(item.value * 100)}%</div>
        </div>
      ))}
    </div>
  );
}

function TimeProfileView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const points = result.time_profile ?? [];
  const maxCount = Math.max(...points.map((item) => item.count), 1);

  return (
    <div className="space-y-4">
      {points.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={item.count}
          total={maxCount}
          color="#9B1B30"
        />
      ))}
    </div>
  );
}

function TemporalWindowsView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const windows = result.temporal_windows ?? [];
  const maxCount = Math.max(...windows.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {windows.map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{item.label}</div>
            <div className="text-sm text-zinc-400">{item.count.toLocaleString()}</div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#60A5FA]"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
          {item.detail ? <div className="mt-2 text-xs text-zinc-500">{item.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

function SqlPreviewView({ result }: { result: FinnGenHadesExtrasResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CodeBlock title="Template" code={result.sql_preview.template} />
      <CodeBlock title="Rendered" code={result.sql_preview.rendered} />
    </div>
  );
}

function PipelineView({ result }: { result: FinnGenHadesExtrasResult }) {
  return (
    <div className="space-y-3">
      {result.artifact_pipeline.map((item) => (
        <div key={item.name} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-100">{item.name}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
              {item.status}
            </span>
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        {result.artifacts.map((artifact) => (
          <div key={artifact.name} className="flex items-center justify-between gap-3 py-1">
            <span>{artifact.name}</span>
            {artifact.type ? <span className="text-xs uppercase tracking-wide text-zinc-500">{artifact.type}</span> : null}
          </div>
        ))}
      </div>
      {result.explain_plan?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Explain Plan</div>
          <div className="space-y-2 text-sm text-zinc-300">
            {result.explain_plan.map((row, index) => (
              <div key={`${index}-${JSON.stringify(row)}`}>{Object.values(row).join(" ")}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SqlDiffView({ result }: { result: FinnGenHadesExtrasResult }) {
  const templateLines = result.sql_preview.template.split("\n");
  const renderedLines = result.sql_preview.rendered.split("\n");
  const added = renderedLines.filter((line) => !templateLines.includes(line));
  const retained = renderedLines.filter((line) => templateLines.includes(line));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Template lines" value={String(templateLines.length)} />
        <MiniMetric label="Rendered lines" value={String(renderedLines.length)} />
        <MiniMetric label="New lines" value={String(added.length)} />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Rendered additions</div>
        <div className="space-y-2 text-sm text-zinc-300">
          {(added.length ? added : retained.slice(0, 3)).map((line, index) => (
            <div key={`${index}-${line}`} className="rounded bg-zinc-900/70 px-2 py-1 font-mono text-xs">
              {line || "(blank line)"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OperationLineageView({ result }: { result: FinnGenHadesExtrasResult }) {
  const substitutions = collectSqlSubstitutions(result.sql_preview.template, result.sql_preview.rendered);
  const lineage = result.sql_lineage ?? [];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <MiniMetric label="Artifacts" value={String(result.artifacts.length)} />
        <MiniMetric label="Pipeline stages" value={String(result.artifact_pipeline.length)} />
        <MiniMetric label="Lineage steps" value={String(Math.max(lineage.length, substitutions.length))} />
      </div>
      <div className="space-y-2">
        {(lineage.length ? lineage : result.artifact_pipeline.map((stage) => ({ stage: stage.name, detail: `Status: ${stage.status}` }))).map((stage, index) => (
          <div key={`${stage.stage}-${index}`} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-xs font-semibold text-[#7CE8D5]">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-100">{stage.stage}</div>
              <div className="mt-1 text-xs text-zinc-500">{stage.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Schema substitutions</div>
        <div className="space-y-2 text-sm text-zinc-300">
          {(substitutions.length ? substitutions : ["No schema token substitutions detected in this render."]).map((item) => (
            <div key={item} className="rounded bg-zinc-900/70 px-2 py-1 font-mono text-xs">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PackageManifestView({ result }: { result: FinnGenHadesExtrasResult }) {
  const manifest = result.package_manifest ?? [];

  return (
    <ArtifactList
      artifacts={manifest.map((item) => ({
        name: item.path,
        type: item.kind,
        summary: item.summary,
      }))}
    />
  );
}

function PackageBundleView({ result }: { result: FinnGenHadesExtrasResult }) {
  const bundle = result.package_bundle;

  if (!bundle) {
    return <EmptyState label="No package bundle metadata was returned." />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <MiniMetric label="Bundle name" value={bundle.name ?? "Unavailable"} />
        <MiniMetric label="Format" value={bundle.format ?? "Unavailable"} />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Bundle entrypoints</div>
        <div className="space-y-2 text-sm text-zinc-300">
          {(bundle.entrypoints ?? []).map((item) => (
            <div key={item} className="rounded bg-zinc-900/70 px-2 py-1 font-mono text-xs">
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadJson(bundle.download_name ?? "hades-package-bundle.json", bundle)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#2DD4BF]/40 hover:text-white"
        >
          Download Bundle Metadata
        </button>
        {result.package_manifest?.length ? (
          <button
            type="button"
            onClick={() => downloadJson("hades-package-manifest.json", result.package_manifest)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#2DD4BF]/40 hover:text-white"
          >
            Download Package Manifest
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SchemaNodeView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {result.schema_nodes.map((node) => (
        <div key={node.name} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-sm font-medium text-zinc-100">{node.name}</div>
          <div className="mt-1 text-xs text-zinc-500">{node.group} · {node.connections} connections</div>
          {typeof node.estimated_rows === "number" ? (
            <div className="mt-2 text-xs text-zinc-400">
              Estimated rows: {node.estimated_rows.toLocaleString()}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HierarchyMapView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="space-y-3">
      {result.lineage_trace.map((item, index) => (
        <div key={item.step} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 text-xs font-semibold text-[#93C5FD]">
              {item.step}
            </div>
            {index < result.lineage_trace.length - 1 ? (
              <div className="mt-1 h-8 w-px bg-zinc-800" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="text-sm font-medium text-zinc-100">{item.label}</div>
            <div className="mt-1 text-sm text-zinc-400">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SchemaDensityView({ result }: { result: FinnGenRomopapiResult }) {
  const maxConnections = Math.max(...result.schema_nodes.map((node) => node.connections), 1);

  return (
    <div className="space-y-3">
      {result.schema_nodes.slice(0, 6).map((node) => (
        <div key={node.name}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-zinc-200">{node.name}</span>
            <span className="text-zinc-500">{node.connections} links</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#60A5FA]"
              style={{ width: `${(node.connections / maxConnections) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CountSurfaceView({ result }: { result: FinnGenRomopapiResult }) {
  const rows = result.schema_nodes.map((node) => ({
    table: node.name,
    links: node.connections,
    estimated_rows: node.estimated_rows ?? "n/a",
  }));

  return <RecordTable rows={rows} />;
}

function ReportPreviewView({ result }: { result: FinnGenRomopapiResult }) {
  const markdownReport =
    result.report_content?.markdown ??
    [
      "# ROMOPAPI Report",
      "",
      `- Schema scope: ${String(result.metadata_summary.schema_scope ?? "n/a")}`,
      `- Tables surfaced: ${result.schema_nodes.length}`,
      `- Estimated join rows: ${String(result.query_plan.estimated_rows ?? "n/a")}`,
      `- Primary path: ${String(result.query_plan.template ?? "n/a")}`,
    ].join("\n");
  const htmlReport = result.report_content?.html;
  const manifest = Array.isArray(result.report_content?.manifest) ? result.report_content.manifest : [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Report snapshot</div>
        <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-300">{markdownReport}</pre>
      </div>
      {manifest.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Report manifest</div>
          <div className="space-y-2">
            {manifest.map((item) => (
              <div key={item.name} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                <div className="text-sm font-medium text-zinc-100">{item.name}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {item.kind}
                  {item.summary ? ` · ${item.summary}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {htmlReport ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">HTML preview</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-300">{htmlReport}</pre>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadText("romopapi-report.md", markdownReport)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
        >
          Download Markdown Report
        </button>
        {htmlReport ? (
          <button
            type="button"
            onClick={() => downloadText("romopapi-report.html", htmlReport)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
          >
            Download HTML Report
          </button>
        ) : null}
        {manifest.length ? (
          <button
            type="button"
            onClick={() => downloadJson("romopapi-report-manifest.json", manifest)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
          >
            Download Manifest
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => downloadJson("romopapi-result.json", result)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
        >
          Download JSON
        </button>
        {result.report_artifacts?.length ? (
          <button
            type="button"
            onClick={() => downloadJson("romopapi-artifacts.json", result.report_artifacts)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
          >
            Download Artifact Index
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CodeCountsView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <RecordTable
      rows={(result.code_counts ?? []).map((row) => ({
        concept: row.concept,
        domain: row.domain ?? "n/a",
        stratum: row.stratum ?? "overall",
        count: row.count,
      }))}
    />
  );
}

function StratifiedCountsView({ result }: { result: FinnGenRomopapiResult }) {
  const items = result.stratified_counts ?? [];
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={item.count}
          total={maxCount}
          color="#60A5FA"
          suffix={item.percent != null ? `${Math.round(item.percent * 100)}%` : undefined}
        />
      ))}
    </div>
  );
}

function LineageView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="space-y-3">
      {result.lineage_trace.map((item) => (
        <div key={item.step} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-sm font-medium text-zinc-100">{item.step}. {item.label}</div>
          <div className="mt-1 text-sm text-zinc-400">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ResultProfileView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="space-y-3">
      {result.result_profile.map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
          <div className="mt-1 text-sm font-medium text-zinc-100">{item.value}</div>
        </div>
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        Planned query: {String(result.query_plan.template ?? "")}
      </div>
    </div>
  );
}

function KeyValueGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== undefined && value !== "");

  if (entries.length === 0) {
    return <EmptyState label="No details were returned for this run." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{humanizeKey(key)}</div>
          <div className="mt-2 text-sm font-medium text-zinc-100">{formatValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function RecordTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) {
    return <EmptyState label="No rows were returned." />;
  }

  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row))),
  ).slice(0, 8);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/70">
      <table className="min-w-full divide-y divide-zinc-800 text-left text-sm text-zinc-300">
        <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold">
                {humanizeKey(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 align-top text-zinc-300">
                  {formatValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LabelValueList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
          <div className="mt-1 text-sm font-medium text-zinc-100">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function StatusListView({
  items,
}: {
  items: Array<{ label: string; status: string; detail: string }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={`${item.label}-${item.status}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{item.label}</div>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                item.status === "ready"
                  ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  : item.status === "review"
                    ? "bg-[#C9A227]/15 text-[#F3D97A]"
                    : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {item.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function RecentRunsView({
  runs,
  selectedRunId,
  onSelect,
}: {
  runs: FinnGenRun[];
  selectedRunId: number | null;
  onSelect: (runId: number) => void;
}) {
  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => onSelect(run.id)}
          className={`block w-full rounded-lg border p-4 text-left transition-colors ${
            run.id === selectedRunId
              ? "border-[#9B1B30]/50 bg-[#9B1B30]/10"
              : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">Run #{run.id}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {String(run.source.source_key ?? "source")} · {run.submitted_at ? formatTimestamp(run.submitted_at) : "Pending timestamp"}
              </div>
            </div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
              {run.status}
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <KeyValueGrid data={run.summary ?? {}} />
          </div>
          {run.artifacts?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {run.artifacts.slice(0, 3).map((artifact) => (
                <span key={artifact.name} className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                  {artifact.name}
                </span>
              ))}
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function RunInspectorView({
  run,
  onReplay,
  onExport,
  replaying,
}: {
  run: FinnGenRun;
  onReplay: () => void;
  onExport: () => void;
  replaying: boolean;
}) {
  const resultPayload = (run.result_payload ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
        >
          Export Bundle
        </button>
        <button
          type="button"
          onClick={onReplay}
          disabled={replaying}
          className="inline-flex items-center gap-2 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]/20 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {replaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Replay Run
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <MiniMetric label="Run" value={`#${run.id}`} />
        <MiniMetric label="Status" value={String(run.status ?? "unknown")} />
        <MiniMetric label="Submitted" value={run.submitted_at ? formatTimestamp(run.submitted_at) : "n/a"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Source Snapshot</div>
            <KeyValueGrid data={run.source ?? {}} />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Runtime</div>
            <KeyValueGrid data={flattenRecord(run.runtime ?? {})} />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Summary</div>
            <KeyValueGrid data={run.summary ?? {}} />
          </div>
        </div>
        <div className="space-y-4">
          <JsonPreview title="Stored Request" value={run.request_payload ?? {}} />
          <JsonPreview title="Stored Result" value={run.result_payload ?? {}} />
        </div>
      </div>
      {run.artifacts?.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Artifacts</div>
            <button
              type="button"
              onClick={() => downloadJson(`finngen-run-${run.id}-artifacts.json`, run.artifacts)}
              className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
            >
              Download Index
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {run.artifacts.map((artifact) => (
              <span
                key={`${artifact.name}-${artifact.type ?? "artifact"}`}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300"
              >
                {artifact.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Plausibility Sample</div>
        <PlausibilityView serviceName={run.service_name} result={resultPayload} persisted />
      </div>
      <PersistedResultHighlights serviceName={run.service_name} result={resultPayload} runId={run.id} />
    </div>
  );
}

function PlausibilityView({
  serviceName,
  result,
  persisted = false,
}: {
  serviceName: string;
  result: Record<string, unknown>;
  persisted?: boolean;
}) {
  if (serviceName === "finngen_cohort_operations") {
    const sampleRows = Array.isArray(result.sample_rows) ? result.sample_rows : [];
    const compileSummary = (result.compile_summary ?? {}) as Record<string, unknown>;
    const cohortCount = Number(compileSummary.cohort_count ?? 0);
    const conceptSetCount = Number(compileSummary.concept_set_count ?? 0);

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <PlausibilityBadge
            label="Rows surfaced"
            value={sampleRows.length ? `${sampleRows.length} sample rows` : "No samples"}
            tone={sampleRows.length ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Cohort scale"
            value={cohortCount > 0 ? cohortCount.toLocaleString() : "Unavailable"}
            tone={cohortCount > 0 ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Concept framing"
            value={conceptSetCount > 0 ? `${conceptSetCount} concept sets` : "No concept sets"}
            tone={conceptSetCount > 0 ? "good" : "warn"}
          />
        </div>
        {sampleRows.length ? (
          <RecordTable rows={sampleRows.slice(0, 3) as Array<Record<string, unknown>>} />
        ) : (
          <EmptyState label={`${persisted ? "Persisted" : "Live"} cohort sample rows will appear here when the CDM preview returns them.`} />
        )}
      </div>
    );
  }

  if (serviceName === "finngen_co2_analysis") {
    const analysisSummary = (result.analysis_summary ?? {}) as Record<string, unknown>;
    const topSignals = Array.isArray(result.top_signals) ? result.top_signals : [];
    const trend = Array.isArray(result.utilization_trend) ? result.utilization_trend : [];

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <PlausibilityBadge
            label="Population base"
            value={formatValue(analysisSummary.person_count ?? "Unavailable")}
            tone={Number(analysisSummary.person_count ?? 0) > 0 ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Signal count"
            value={topSignals.length ? `${topSignals.length} concepts` : "No signals"}
            tone={topSignals.length ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Trend buckets"
            value={trend.length ? `${trend.length} periods` : "No periods"}
            tone={trend.length ? "good" : "warn"}
          />
        </div>
        {topSignals.length ? (
          <div className="space-y-2">
            {topSignals.slice(0, 4).map((signal, index) => {
              const record = signal as Record<string, unknown>;
              return (
                <div key={`${String(record.label ?? "signal")}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">{String(record.label ?? "Signal")}</div>
                    <div className="text-sm text-zinc-400">{formatValue(record.count ?? 0)} events</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState label={`${persisted ? "Persisted" : "Live"} CO2 signal samples will appear here when CDM-backed modules return them.`} />
        )}
      </div>
    );
  }

  if (serviceName === "finngen_hades_extras") {
    const sqlPreview = (result.sql_preview ?? {}) as Record<string, unknown>;
    const explainPlan = Array.isArray(result.explain_plan) ? result.explain_plan : [];
    const artifactPipeline = Array.isArray(result.artifact_pipeline) ? result.artifact_pipeline : [];

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <PlausibilityBadge
            label="SQL rendered"
            value={typeof sqlPreview.rendered === "string" && sqlPreview.rendered.length ? "Rendered" : "Missing"}
            tone={typeof sqlPreview.rendered === "string" && sqlPreview.rendered.length ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Explain rows"
            value={explainPlan.length ? `${explainPlan.length} plan rows` : "No plan"}
            tone={explainPlan.length ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Artifacts staged"
            value={artifactPipeline.length ? `${artifactPipeline.length} stages` : "No stages"}
            tone={artifactPipeline.length ? "good" : "warn"}
          />
        </div>
        {typeof sqlPreview.rendered === "string" && sqlPreview.rendered.length ? (
          <CodeBlock title="Rendered SQL sample" code={sqlPreview.rendered.split("\n").slice(0, 6).join("\n")} />
        ) : (
          <EmptyState label={`${persisted ? "Persisted" : "Live"} rendered SQL samples will appear here when available.`} />
        )}
      </div>
    );
  }

  if (serviceName === "finngen_romopapi") {
    const metadataSummary = (result.metadata_summary ?? {}) as Record<string, unknown>;
    const codeCounts = Array.isArray(result.code_counts) ? result.code_counts : [];
    const resultProfile = Array.isArray(result.result_profile) ? result.result_profile : [];

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <PlausibilityBadge
            label="Schema scope"
            value={formatValue(metadataSummary.schema_scope ?? "Unknown")}
            tone={metadataSummary.schema_scope ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Code counts"
            value={codeCounts.length ? `${codeCounts.length} rows` : "No counts"}
            tone={codeCounts.length ? "good" : "warn"}
          />
          <PlausibilityBadge
            label="Result profile"
            value={resultProfile.length ? `${resultProfile.length} facets` : "No profile"}
            tone={resultProfile.length ? "good" : "warn"}
          />
        </div>
        {codeCounts.length ? (
          <div className="space-y-2">
            {codeCounts.slice(0, 4).map((row, index) => {
              const record = row as Record<string, unknown>;
              return (
                <div key={`${String(record.concept ?? "concept")}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">{String(record.concept ?? "Concept")}</div>
                    <div className="text-sm text-zinc-400">{formatValue(record.count ?? 0)}</div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{String(record.domain ?? "Domain unavailable")}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState label={`${persisted ? "Persisted" : "Live"} ROMOPAPI code-count samples will appear here when available.`} />
        )}
      </div>
    );
  }

  return <EmptyState label="No plausibility heuristics are available for this result payload yet." />;
}

function PlausibilityBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn";
}) {
  const styles =
    tone === "good"
      ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#D8FFF6]"
      : "border-[#C9A227]/30 bg-[#C9A227]/10 text-[#F6E7A5]";

  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function RunComparisonPanel({
  runs,
  selectedRun,
  compareRun,
  compareRunId,
  onCompareRunChange,
}: {
  runs: FinnGenRun[];
  selectedRun: FinnGenRun;
  compareRun: FinnGenRun | null | undefined;
  compareRunId: number | null;
  onCompareRunChange: (runId: number | null) => void;
}) {
  const compareCandidates = runs.filter((run) => run.id !== selectedRun.id);

  return (
    <div className="space-y-4">
      {compareCandidates.length ? (
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Compare Against
          </span>
          <select
            value={compareRunId ?? ""}
            onChange={(event) => onCompareRunChange(event.target.value ? Number(event.target.value) : null)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          >
            <option value="">Choose a prior run</option>
            {compareCandidates.map((run) => (
              <option key={run.id} value={run.id}>
                Run #{run.id} · {run.submitted_at ? formatTimestamp(run.submitted_at) : "No timestamp"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <EmptyState label="At least two persisted runs for the active tool and source are required for comparison." />
      )}

      {compareRun ? (
        <RunComparisonView left={selectedRun} right={compareRun} />
      ) : compareCandidates.length ? (
        <EmptyState label="Choose a second run to inspect summary and result deltas." />
      ) : null}
    </div>
  );
}

function RunComparisonView({ left, right }: { left: FinnGenRun; right: FinnGenRun }) {
  const leftResult = (left.result_payload ?? {}) as Record<string, unknown>;
  const rightResult = (right.result_payload ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#9B1B30]/40 bg-[#9B1B30]/10 p-4">
          <div className="text-xs uppercase tracking-wide text-[#E85A6B]">Primary</div>
          <div className="mt-1 text-sm font-medium text-zinc-100">Run #{left.id}</div>
          <div className="mt-1 text-xs text-zinc-400">{left.submitted_at ? formatTimestamp(left.submitted_at) : "No timestamp"}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Comparison</div>
          <div className="mt-1 text-sm font-medium text-zinc-100">Run #{right.id}</div>
          <div className="mt-1 text-xs text-zinc-400">{right.submitted_at ? formatTimestamp(right.submitted_at) : "No timestamp"}</div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Summary Delta</div>
          <ComparisonTable left={left.summary ?? {}} right={right.summary ?? {}} />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Runtime Delta</div>
          <ComparisonTable left={flattenRecord(left.runtime ?? {})} right={flattenRecord(right.runtime ?? {})} />
        </div>
      </div>
      <ServiceComparisonHighlights serviceName={left.service_name} left={leftResult} right={rightResult} />
    </div>
  );
}

function ServiceComparisonHighlights({
  serviceName,
  left,
  right,
}: {
  serviceName: string;
  left: Record<string, unknown>;
  right: Record<string, unknown>;
}) {
  if (serviceName === "finngen_cohort_operations") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Attrition Delta</div>
          <ArrayMetricComparison
            left={toLabeledNumbers(left.attrition, "count")}
            right={toLabeledNumbers(right.attrition, "count")}
            unit="rows"
          />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Export Delta</div>
          <ComparisonTable
            left={(left.export_summary ?? {}) as Record<string, unknown>}
            right={(right.export_summary ?? {}) as Record<string, unknown>}
          />
        </div>
      </div>
    );
  }

  if (serviceName === "finngen_co2_analysis") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Top Signal Delta</div>
          <ArrayMetricComparison
            left={toLabeledNumbers(left.top_signals, "count")}
            right={toLabeledNumbers(right.top_signals, "count")}
            unit="events"
          />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Time Profile Delta</div>
          <ArrayMetricComparison
            left={toLabeledNumbers(left.time_profile, "count")}
            right={toLabeledNumbers(right.time_profile, "count")}
            unit="events"
          />
        </div>
      </div>
    );
  }

  if (serviceName === "finngen_hades_extras") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Render Summary Delta</div>
          <ComparisonTable
            left={(left.render_summary ?? {}) as Record<string, unknown>}
            right={(right.render_summary ?? {}) as Record<string, unknown>}
          />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Lineage Stage Delta</div>
          <ArrayMetricComparison
            left={toLabeledNumbers(left.sql_lineage, "detail", true)}
            right={toLabeledNumbers(right.sql_lineage, "detail", true)}
            unit="stages"
          />
        </div>
      </div>
    );
  }

  if (serviceName === "finngen_romopapi") {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Metadata Delta</div>
          <ComparisonTable
            left={(left.metadata_summary ?? {}) as Record<string, unknown>}
            right={(right.metadata_summary ?? {}) as Record<string, unknown>}
          />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Code Count Delta</div>
          <ArrayMetricComparison
            left={toLabeledNumbers(left.code_counts, "count", false, "concept")}
            right={toLabeledNumbers(right.code_counts, "count", false, "concept")}
            unit="counts"
          />
        </div>
      </div>
    );
  }

  return null;
}

function ComparisonTable({
  left,
  right,
}: {
  left: Record<string, unknown>;
  right: Record<string, unknown>;
}) {
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();

  if (!keys.length) {
    return <EmptyState label="No comparable fields were stored for these runs." />;
  }

  return (
    <div className="space-y-2">
      {keys.map((key) => (
        <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{humanizeKey(key)}</div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div className="text-sm text-zinc-300">{formatValue(left[key]) || "n/a"}</div>
            <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">vs</div>
            <div className="text-sm text-zinc-100">{formatValue(right[key]) || "n/a"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArrayMetricComparison({
  left,
  right,
  unit,
}: {
  left: Record<string, number>;
  right: Record<string, number>;
  unit: string;
}) {
  const labels = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();

  if (!labels.length) {
    return <EmptyState label="No comparable series were stored for these runs." />;
  }

  return (
    <div className="space-y-2">
      {labels.map((label) => {
        const leftValue = left[label] ?? 0;
        const rightValue = right[label] ?? 0;
        const delta = leftValue - rightValue;

        return (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-100">{label}</div>
              <div className={`text-xs font-medium ${delta >= 0 ? "text-[#2DD4BF]" : "text-[#E85A6B]"}`}>
                {delta >= 0 ? "+" : ""}
                {delta.toLocaleString()} {unit}
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3 text-sm">
              <div className="text-zinc-300">{leftValue.toLocaleString()}</div>
              <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">vs</div>
              <div className="text-zinc-100">{rightValue.toLocaleString()}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PersistedResultHighlights({
  serviceName,
  result,
  runId,
}: {
  serviceName: string;
  result: Record<string, unknown>;
  runId: number;
}) {
  if (serviceName === "finngen_cohort_operations") {
    const attrition = Array.isArray(result.attrition) ? result.attrition : [];
    const criteriaTimeline = Array.isArray(result.criteria_timeline) ? result.criteria_timeline : [];
    const importReview = Array.isArray(result.import_review) ? result.import_review : [];
    const sampleRows = Array.isArray(result.sample_rows) ? result.sample_rows : [];

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-100">Persisted Attrition</div>
              <button
                type="button"
                onClick={() => downloadJson(`finngen-run-${runId}-attrition.json`, attrition)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
              >
                Download
              </button>
            </div>
            {attrition.length ? (
              <AttritionView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  compile_summary: (result.compile_summary ?? {}) as Record<string, unknown>,
                  attrition: attrition as FinnGenMetricPoint[],
                  criteria_timeline: criteriaTimeline as FinnGenTimelineStep[],
                  import_review: importReview as Array<{ label: string; status: string; detail: string }>,
                  matching_summary: (result.matching_summary ?? {}) as Record<string, unknown>,
                  matching_review: (result.matching_review ?? {}) as FinnGenCohortOperationsResult["matching_review"],
                  export_summary: (result.export_summary ?? {}) as Record<string, unknown>,
                  artifacts: (result.artifacts ?? []) as FinnGenArtifact[],
                  sql_preview: typeof result.sql_preview === "string" ? result.sql_preview : undefined,
                  sample_rows: sampleRows as Array<Record<string, unknown>>,
                }}
              />
            ) : (
              <EmptyState label="Persisted cohort attrition will appear here when the stored run includes it." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Matching Review</div>
            {result.matching_summary ? (
              <MatchingReviewView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  compile_summary: (result.compile_summary ?? {}) as Record<string, unknown>,
                  attrition: attrition as FinnGenMetricPoint[],
                  criteria_timeline: criteriaTimeline as FinnGenTimelineStep[],
                  import_review: importReview as Array<{ label: string; status: string; detail: string }>,
                  matching_summary: (result.matching_summary ?? {}) as Record<string, unknown>,
                  matching_review: (result.matching_review ?? {}) as FinnGenCohortOperationsResult["matching_review"],
                  export_summary: (result.export_summary ?? {}) as Record<string, unknown>,
                  artifacts: (result.artifacts ?? []) as FinnGenArtifact[],
                  sql_preview: typeof result.sql_preview === "string" ? result.sql_preview : undefined,
                  sample_rows: sampleRows as Array<Record<string, unknown>>,
                }}
              />
            ) : (
              <EmptyState label="Persisted matching metrics will appear here when the stored run includes them." />
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Import Review</div>
            {importReview.length ? (
              <StatusListView
                items={importReview as Array<{ label: string; status: string; detail: string }>}
              />
            ) : (
              <EmptyState label="Persisted import review stages will appear here when the run stores them." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Export Summary</div>
            {result.export_summary ? (
              <KeyValueGrid data={(result.export_summary ?? {}) as Record<string, unknown>} />
            ) : (
              <EmptyState label="Persisted export metadata will appear here when the run stores it." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Operation Comparison</div>
            {Array.isArray(result.operation_comparison) && result.operation_comparison.length ? (
              <LabelValueList
                items={result.operation_comparison.map((item) => ({
                  label: String(item.label ?? "Metric"),
                  value: String(item.value ?? ""),
                }))}
              />
            ) : (
              <EmptyState label="Persisted operation comparison will appear here when the run stores overlap-grounded evidence." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Sample Rows Snapshot</div>
            {sampleRows.length ? (
              <JsonPreview title="Sample Rows" value={sampleRows} />
            ) : (
              <EmptyState label="Persisted sample rows will appear here when available." />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (serviceName === "finngen_co2_analysis") {
    const cohortContext = result.cohort_context && typeof result.cohort_context === "object" ? (result.cohort_context as Record<string, unknown>) : {};
    const handoffImpact = Array.isArray(result.handoff_impact) ? result.handoff_impact : [];
    const familySpotlight = Array.isArray(result.family_spotlight) ? result.family_spotlight : [];
    const familySegments = Array.isArray(result.family_segments) ? result.family_segments : [];
    const moduleSetup = result.module_setup && typeof result.module_setup === "object" ? (result.module_setup as Record<string, unknown>) : {};
    const moduleValidation = Array.isArray(result.module_validation) ? result.module_validation : [];
    const overlapMatrix = Array.isArray(result.overlap_matrix) ? result.overlap_matrix : [];
    const timeProfile = Array.isArray(result.time_profile) ? result.time_profile : [];
    const topSignals = Array.isArray(result.top_signals) ? result.top_signals : [];

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Derived Cohort Context</div>
            {Object.keys(cohortContext).length ? (
              <KeyValueGrid data={cohortContext} />
            ) : (
              <EmptyState label="Persisted derived cohort context will appear here when CO2 runs are launched from Cohort Ops." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Module Setup</div>
            {Object.keys(moduleSetup).length ? (
              <KeyValueGrid data={moduleSetup} />
            ) : (
              <EmptyState label="Persisted module setup will appear here when the run stores family-specific configuration." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Handoff Impact</div>
            {handoffImpact.length ? (
              <Co2FamilyEvidenceView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  analysis_summary: (result.analysis_summary ?? {}) as Record<string, unknown>,
                  handoff_impact: handoffImpact as Array<{ label: string; value: string | number; emphasis?: string }>,
                  family_evidence: handoffImpact as Array<{ label: string; value: string | number; emphasis?: string }>,
                  module_validation: moduleValidation as Array<{ label: string; status: string; detail: string }>,
                  module_gallery: (result.module_gallery ?? []) as Array<{ name: string; family: string; status: string }>,
                  forest_plot: (result.forest_plot ?? []) as FinnGenMetricPoint[],
                  heatmap: (result.heatmap ?? []) as Array<{ label: string; value: number }>,
                  time_profile: timeProfile as Array<{ label: string; count: number }>,
                  overlap_matrix: overlapMatrix as Array<{ label: string; value: number }>,
                  top_signals: topSignals as Array<{ label: string; count: number }>,
                  utilization_trend: (result.utilization_trend ?? []) as Array<{ label: string; count: number }>,
                  execution_timeline: (result.execution_timeline ?? []) as FinnGenTimelineStep[],
                }}
              />
            ) : (
              <EmptyState label="Persisted handoff impact will appear here when the run stores derived cohort impact metrics." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Module Validation</div>
            {moduleValidation.length ? (
              <StatusListView
                items={moduleValidation as Array<{ label: string; status: string; detail: string }>}
              />
            ) : (
              <EmptyState label="Persisted module validation will appear here when the run stores it." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Family Spotlight</div>
            {familySpotlight.length ? (
              <Co2SpotlightView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  analysis_summary: (result.analysis_summary ?? {}) as Record<string, unknown>,
                  family_spotlight: familySpotlight as Array<{ label: string; value: string | number; detail?: string }>,
                  module_validation: moduleValidation as Array<{ label: string; status: string; detail: string }>,
                  module_gallery: (result.module_gallery ?? []) as Array<{ name: string; family: string; status: string }>,
                  forest_plot: (result.forest_plot ?? []) as FinnGenMetricPoint[],
                  heatmap: (result.heatmap ?? []) as Array<{ label: string; value: number }>,
                  time_profile: timeProfile as Array<{ label: string; count: number }>,
                  overlap_matrix: overlapMatrix as Array<{ label: string; value: number }>,
                  top_signals: topSignals as Array<{ label: string; count: number }>,
                  utilization_trend: (result.utilization_trend ?? []) as Array<{ label: string; count: number }>,
                  execution_timeline: (result.execution_timeline ?? []) as FinnGenTimelineStep[],
                }}
              />
            ) : (
              <EmptyState label="Persisted family spotlight metrics will appear here when the run stores them." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Overlap Matrix</div>
            {overlapMatrix.length ? (
              <OverlapMatrixView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  analysis_summary: (result.analysis_summary ?? {}) as Record<string, unknown>,
                  module_validation: moduleValidation as Array<{ label: string; status: string; detail: string }>,
                  module_gallery: (result.module_gallery ?? []) as Array<{ name: string; family: string; status: string }>,
                  forest_plot: (result.forest_plot ?? []) as FinnGenMetricPoint[],
                  heatmap: (result.heatmap ?? []) as Array<{ label: string; value: number }>,
                  time_profile: timeProfile as Array<{ label: string; count: number }>,
                  overlap_matrix: overlapMatrix as Array<{ label: string; value: number }>,
                  top_signals: topSignals as Array<{ label: string; count: number }>,
                  utilization_trend: (result.utilization_trend ?? []) as Array<{ label: string; count: number }>,
                  execution_timeline: (result.execution_timeline ?? []) as FinnGenTimelineStep[],
                }}
              />
            ) : (
              <EmptyState label="Persisted overlap metrics will appear here when the run stores them." />
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Family Segments</div>
            {familySegments.length ? (
              <Co2SegmentsView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  analysis_summary: (result.analysis_summary ?? {}) as Record<string, unknown>,
                  family_segments: familySegments as Array<{ label: string; count: number; share?: number }>,
                  module_validation: moduleValidation as Array<{ label: string; status: string; detail: string }>,
                  module_gallery: (result.module_gallery ?? []) as Array<{ name: string; family: string; status: string }>,
                  forest_plot: (result.forest_plot ?? []) as FinnGenMetricPoint[],
                  heatmap: (result.heatmap ?? []) as Array<{ label: string; value: number }>,
                  time_profile: timeProfile as Array<{ label: string; count: number }>,
                  overlap_matrix: overlapMatrix as Array<{ label: string; value: number }>,
                  top_signals: topSignals as Array<{ label: string; count: number }>,
                  utilization_trend: (result.utilization_trend ?? []) as Array<{ label: string; count: number }>,
                  execution_timeline: (result.execution_timeline ?? []) as FinnGenTimelineStep[],
                }}
              />
            ) : (
              <EmptyState label="Persisted family segments will appear here when the run stores them." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-100">Persisted Time Profile</div>
              <button
                type="button"
                onClick={() => downloadJson(`finngen-run-${runId}-time-profile.json`, timeProfile)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
              >
                Download
              </button>
            </div>
            {timeProfile.length ? (
              <TimeProfileView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  analysis_summary: (result.analysis_summary ?? {}) as Record<string, unknown>,
                  module_validation: moduleValidation as Array<{ label: string; status: string; detail: string }>,
                  module_gallery: (result.module_gallery ?? []) as Array<{ name: string; family: string; status: string }>,
                  forest_plot: (result.forest_plot ?? []) as FinnGenMetricPoint[],
                  heatmap: (result.heatmap ?? []) as Array<{ label: string; value: number }>,
                  time_profile: timeProfile as Array<{ label: string; count: number }>,
                  overlap_matrix: overlapMatrix as Array<{ label: string; value: number }>,
                  top_signals: topSignals as Array<{ label: string; count: number }>,
                  utilization_trend: (result.utilization_trend ?? []) as Array<{ label: string; count: number }>,
                  execution_timeline: (result.execution_timeline ?? []) as FinnGenTimelineStep[],
                }}
              />
            ) : (
              <EmptyState label="Persisted time-profile data will appear here when the run stores it." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Phenotype Signals</div>
            {topSignals.length ? (
              <PhenotypeScoringView
                result={{
                  status: String(result.status ?? "ok"),
                  runtime: (result.runtime ?? {}) as FinnGenRuntime,
                  source: (result.source ?? {}) as Record<string, unknown>,
                  analysis_summary: (result.analysis_summary ?? {}) as Record<string, unknown>,
                  module_validation: moduleValidation as Array<{ label: string; status: string; detail: string }>,
                  module_gallery: (result.module_gallery ?? []) as Array<{ name: string; family: string; status: string }>,
                  forest_plot: (result.forest_plot ?? []) as FinnGenMetricPoint[],
                  heatmap: (result.heatmap ?? []) as Array<{ label: string; value: number }>,
                  time_profile: timeProfile as Array<{ label: string; count: number }>,
                  overlap_matrix: overlapMatrix as Array<{ label: string; value: number }>,
                  top_signals: topSignals as Array<{ label: string; count: number }>,
                  utilization_trend: (result.utilization_trend ?? []) as Array<{ label: string; count: number }>,
                  execution_timeline: (result.execution_timeline ?? []) as FinnGenTimelineStep[],
                }}
              />
            ) : (
              <EmptyState label="Persisted phenotype signals will appear here when the run stores them." />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (serviceName === "finngen_romopapi") {
    const queryControls = result.query_controls && typeof result.query_controls === "object" ? (result.query_controls as Record<string, unknown>) : {};
    const codeCounts = Array.isArray(result.code_counts) ? result.code_counts : [];
    const stratifiedCounts = Array.isArray(result.stratified_counts) ? result.stratified_counts : [];
    const reportArtifacts = Array.isArray(result.report_artifacts) ? result.report_artifacts : [];

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Query Controls</div>
            {Object.keys(queryControls).length ? (
              <KeyValueGrid data={queryControls} />
            ) : (
              <EmptyState label="Persisted ROMOPAPI query controls will appear here when the run stores them." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-100">Persisted Code Counts</div>
              <button
                type="button"
                onClick={() => downloadJson(`finngen-run-${runId}-code-counts.json`, codeCounts)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
              >
                Download
              </button>
            </div>
            {codeCounts.length ? (
              <div className="space-y-2">
                {codeCounts.slice(0, 6).map((row, index) => (
                  <div key={`${String(row.concept ?? "concept")}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-zinc-100">{String(row.concept ?? "Unknown concept")}</div>
                      <div className="text-sm text-zinc-400">{formatValue(row.count)}</div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {String(row.domain ?? "unknown domain")}
                      {row.stratum ? ` · ${String(row.stratum)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="Persisted code counts will appear here when ROMOPAPI stores them in the run payload." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Stratification</div>
            {stratifiedCounts.length ? (
              <div className="space-y-3">
                {stratifiedCounts.map((row, index) => (
                  <ProgressRow
                    key={`${String(row.label ?? "stratum")}-${index}`}
                    label={String(row.label ?? "Stratum")}
                    value={Number(row.count ?? 0)}
                    total={Math.max(...stratifiedCounts.map((item) => Number(item.count ?? 0)), 1)}
                    color="#60A5FA"
                    suffix={row.percent ? `${formatValue(row.percent)}%` : undefined}
                  />
                ))}
              </div>
            ) : (
              <EmptyState label="Persisted stratified counts will appear here when ROMOPAPI returns them." />
            )}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">Report Artifacts</div>
            <button
              type="button"
              onClick={() => downloadJson(`finngen-run-${runId}-report-artifacts.json`, reportArtifacts)}
              className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
            >
              Download
            </button>
          </div>
          {reportArtifacts.length ? (
            <ArtifactList artifacts={reportArtifacts} />
          ) : (
            <EmptyState label="Persisted ROMOPAPI report artifacts will appear here once the adapter stores them." />
          )}
        </div>
      </div>
    );
  }

  if (serviceName === "finngen_hades_extras") {
    const packageSetup = result.package_setup && typeof result.package_setup === "object" ? (result.package_setup as Record<string, unknown>) : {};
    const sqlLineage = Array.isArray(result.sql_lineage) ? result.sql_lineage : [];
    const artifactPipeline = Array.isArray(result.artifact_pipeline) ? result.artifact_pipeline : [];
    const explainPlan = Array.isArray(result.explain_plan) ? result.explain_plan : [];
    const packageManifest = Array.isArray(result.package_manifest) ? result.package_manifest : [];
    const packageBundle = result.package_bundle && typeof result.package_bundle === "object" ? result.package_bundle : null;

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Package Setup</div>
            {Object.keys(packageSetup).length ? (
              <KeyValueGrid data={packageSetup} />
            ) : (
              <EmptyState label="Persisted HADES package setup will appear here when the run stores workflow configuration." />
            )}
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">Persisted SQL Lineage</div>
            <button
              type="button"
              onClick={() => downloadJson(`finngen-run-${runId}-sql-lineage.json`, sqlLineage)}
              className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
            >
              Download
            </button>
          </div>
          {sqlLineage.length ? (
            <div className="space-y-3">
              {sqlLineage.map((stage, index) => (
                <div key={`${String(stage.stage ?? "stage")}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="text-sm font-medium text-zinc-100">{String(stage.stage ?? "Stage")}</div>
                  <div className="mt-1 text-sm text-zinc-400">{String(stage.detail ?? "No detail recorded.")}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="Persisted SQL lineage will appear here when HADES Extras stores transformation stages." />
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Artifact Pipeline</div>
            {artifactPipeline.length ? (
              <div className="space-y-2">
                {artifactPipeline.map((stage, index) => (
                  <div key={`${String(stage.name ?? "artifact")}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
                    <span className="font-medium text-zinc-100">{String(stage.name ?? "Stage")}</span>
                    <span className="text-zinc-400">{String(stage.status ?? "pending")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="Persisted artifact stages will appear here when HADES Extras stores them." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Explain Snapshot</div>
            {explainPlan.length ? (
              <JsonPreview title="Explain Plan" value={explainPlan} />
            ) : (
              <EmptyState label="Persisted explain plan output will appear here when available." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-100">Package Manifest</div>
              {packageManifest.length ? (
                <button
                  type="button"
                  onClick={() => downloadJson(`finngen-run-${runId}-package-manifest.json`, packageManifest)}
                  className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                >
                  Download
                </button>
              ) : null}
            </div>
            {packageManifest.length ? (
              <ArtifactList
                artifacts={packageManifest.map((item) => ({
                  name: String(item.path ?? "Artifact"),
                  type: String(item.kind ?? "file"),
                  summary: "summary" in item ? String(item.summary ?? "") : "",
                }))}
              />
            ) : (
              <EmptyState label="Persisted package manifest entries will appear here once HADES stores bundle contents." />
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">Package Bundle</div>
            {packageBundle ? (
              <JsonPreview title="Bundle Metadata" value={packageBundle} />
            ) : (
              <EmptyState label="Persisted package bundle metadata will appear here when available." />
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ArtifactList({ artifacts }: { artifacts: Array<Record<string, unknown>> }) {
  return (
    <div className="space-y-2">
      {artifacts.map((artifact, index) => (
        <div key={`${String(artifact.name ?? "artifact")}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{String(artifact.name ?? "Artifact")}</div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{String(artifact.type ?? "file")}</div>
          </div>
          {"summary" in artifact ? <div className="mt-1 text-sm text-zinc-400">{String(artifact.summary ?? "")}</div> : null}
        </div>
      ))}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  color,
  suffix,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  suffix?: string;
}) {
  const width = total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-200">{label}</span>
        <span className="text-zinc-500">
          {value.toLocaleString()}
          {suffix ? ` · ${suffix}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800">
        <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function JsonPreview({ title, value }: { title: string; value: unknown }) {
  return <CodeBlock title={title} code={JSON.stringify(value, null, 2)} />;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-3 py-2 text-sm text-[#F0EDE8]">
      {message}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="py-8 text-sm text-zinc-500">{label}</div>;
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  status,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  status: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        background: "none",
        border: "none",
        borderBottom: `2px solid ${active ? "#9B1B30" : "transparent"}`,
        color: active ? "#F0EDE8" : "#8A857D",
        fontSize: "14px",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 150ms",
        marginBottom: "-1px",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      <span>{label}</span>
      <span
        style={{
          marginLeft: "2px",
          padding: "2px 6px",
          borderRadius: "999px",
          background: active ? "#9B1B301A" : "#232328",
          color: active ? "#E85A6B" : "#A1A1AA",
          fontSize: "10px",
          fontWeight: 600,
        }}
      >
        {status}
      </span>
    </button>
  );
}

function getSchemaQualifier(source: FinnGenSource | null | undefined, daimonType: string): string {
  return source?.daimons?.find((item) => item.daimon_type === daimonType)?.table_qualifier ?? "";
}

function safeParseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function requireSource(source: FinnGenSource | null): FinnGenSource {
  if (!source) {
    throw new Error("A source must be selected.");
  }
  return source;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Preview failed.";
}

function humanizeKey(value: string): string {
  return value.replaceAll("_", " ");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(", ");
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value ?? "");
}

function flattenRecord(record: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  return Object.entries(record).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(accumulator, flattenRecord(value as Record<string, unknown>, nextKey));
      return accumulator;
    }

    accumulator[nextKey] = value;
    return accumulator;
  }, {});
}

function toLabeledNumbers(
  value: unknown,
  metricKey: string,
  countEntries = false,
  labelKey = "label",
): Record<string, number> {
  if (!Array.isArray(value)) {
    return {};
  }

  return value.reduce<Record<string, number>>((accumulator, item, index) => {
    if (!item || typeof item !== "object") {
      return accumulator;
    }

    const record = item as Record<string, unknown>;
    const label = String(record[labelKey] ?? record.stage ?? `Item ${index + 1}`);

    if (countEntries) {
      accumulator[label] = 1;
      return accumulator;
    }

    const metric = record[metricKey];
    accumulator[label] = typeof metric === "number" ? metric : Number(metric ?? 0);
    return accumulator;
  }, {});
}

function parseIntegerList(value: string): number[] {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseStringList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function collectSqlSubstitutions(template: string, rendered: string): string[] {
  const substitutions: string[] = [];
  const templateMatches = template.match(/@[a-z_]+/gi) ?? [];

  for (const match of templateMatches) {
    const normalized = match.replace("@", "");
    if (!rendered.includes(match)) {
      substitutions.push(`${match} -> resolved in rendered SQL (${normalized})`);
    }
  }

  return substitutions;
}

function downloadJson(filename: string, payload: unknown): void {
  downloadText(filename, JSON.stringify(payload, null, 2), "application/json");
}

function downloadText(filename: string, content: string, type = "text/plain"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
