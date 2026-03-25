import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Database,
  ScanSearch,
  Loader2,
  ArrowRight,
  GitMerge,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import SourceProfilerPage from "./SourceProfilerPage";
import { AqueductCanvas } from "../components/aqueduct/AqueductCanvas";
import { FieldMappingDetail } from "../components/aqueduct/FieldMappingDetail";
import {
  useEtlProjects,
  useCreateEtlProject,
  useEtlProject,
  useTableMappings,
} from "../hooks/useAqueductData";
import { useProfileHistory } from "../hooks/useProfilerData";
import {
  fetchProfile,
  type PersistedFieldProfile,
  type EtlProject,
} from "../api";
import { CDM_SCHEMA_V54 } from "../lib/cdm-schema-v54";

// ---------------------------------------------------------------------------
// Step indicator component
// ---------------------------------------------------------------------------

function StepIndicator({
  activeStep,
  step2Enabled,
  onStepClick,
}: {
  activeStep: 1 | 2;
  step2Enabled: boolean;
  onStepClick: (step: 1 | 2) => void;
}) {
  const steps = [
    { num: 1 as const, label: "Source Profile" },
    { num: 2 as const, label: "ETL Mapping (Aqueduct)" },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const isActive = activeStep === step.num;
        const isEnabled = step.num === 1 || step2Enabled;

        return (
          <div key={step.num} className="flex items-center">
            {idx > 0 && (
              <div
                className={cn(
                  "w-16 h-0.5 mx-1",
                  step2Enabled ? "bg-[#2DD4BF]/40" : "bg-[#2E2E35]",
                )}
              />
            )}
            <button
              type="button"
              disabled={!isEnabled}
              onClick={() => isEnabled && onStepClick(step.num)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-4 py-2.5 transition-colors",
                isActive
                  ? "bg-[rgba(45,212,191,0.1)] border border-[#2DD4BF]/30"
                  : isEnabled
                    ? "bg-[#151518] border border-[#232328] hover:border-[#2DD4BF]/20 cursor-pointer"
                    : "bg-[#151518] border border-[#232328] opacity-50 cursor-not-allowed",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                  isActive
                    ? "bg-[#2DD4BF] text-[#0E0E11]"
                    : isEnabled
                      ? "bg-[#2E2E35] text-[#8A857D]"
                      : "bg-[#1C1C20] text-[#5A5650]",
                )}
              >
                {step.num}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive
                    ? "text-[#2DD4BF]"
                    : isEnabled
                      ? "text-[#C5C0B8]"
                      : "text-[#5A5650]",
                )}
              >
                {step.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aqueduct Step 2 content
// ---------------------------------------------------------------------------

function AqueductStep({
  sourceId,
  sourceProfileId,
  onDrilledMapping,
  drilledDownMappingId,
}: {
  sourceId: number;
  sourceProfileId: number;
  onDrilledMapping: (id: number | null) => void;
  drilledDownMappingId: number | null;
}) {
  const { data: projectsData, isLoading: loadingProjects } = useEtlProjects();
  const createProject = useCreateEtlProject();
  const [cdmVersion, setCdmVersion] = useState("5.4");

  // Find existing project for this source
  const existingProject = useMemo(() => {
    if (!projectsData?.data) return null;
    return projectsData.data.find((p) => p.source_id === sourceId) ?? null;
  }, [projectsData, sourceId]);

  const projectId = existingProject?.id ?? 0;

  const { data: projectDetail } = useEtlProject(projectId);
  const { data: tableMappings = [] } = useTableMappings(projectId);

  // Source fields from profile
  const [sourceFields, setSourceFields] = useState<PersistedFieldProfile[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);

  // Fetch source fields when project exists
  useMemo(() => {
    if (existingProject && sourceProfileId > 0 && !fieldsLoaded) {
      fetchProfile(sourceId, sourceProfileId)
        .then((detail) => {
          setSourceFields(detail.fields);
          setFieldsLoaded(true);
        })
        .catch(() => {
          setFieldsLoaded(true);
        });
    }
  }, [existingProject, sourceId, sourceProfileId, fieldsLoaded]);

  const handleCreateProject = useCallback(() => {
    createProject.mutate({
      source_id: sourceId,
      cdm_version: cdmVersion,
      scan_profile_id: sourceProfileId,
    });
  }, [createProject, sourceId, cdmVersion, sourceProfileId]);

  // -- Drill-down into a specific table mapping --------------------------------
  const drilledMapping = useMemo(() => {
    if (drilledDownMappingId === null) return null;
    return tableMappings.find((m) => m.id === drilledDownMappingId) ?? null;
  }, [tableMappings, drilledDownMappingId]);

  const allMappingIds = useMemo(
    () => tableMappings.map((m) => m.id),
    [tableMappings],
  );

  // Build source columns for field detail
  const drilledSourceColumns = useMemo(() => {
    if (!drilledMapping) return [];
    return sourceFields
      .filter((f) => f.table_name === drilledMapping.source_table)
      .map((f) => ({
        name: f.column_name,
        type: f.inferred_type,
        nullPct: f.null_percentage,
        distinctCount: f.distinct_count,
      }));
  }, [drilledMapping, sourceFields]);

  // Build CDM columns for field detail
  const drilledCdmColumns = useMemo(() => {
    if (!drilledMapping) return [];
    const cdmTable = CDM_SCHEMA_V54.find(
      (t) => t.name === drilledMapping.target_table,
    );
    return (
      cdmTable?.columns.map((c) => ({
        name: c.name,
        type: c.type,
        required: c.required,
        description: c.description,
      })) ?? []
    );
  }, [drilledMapping]);

  // -- Loading state -----------------------------------------------------------
  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
        <span className="ml-3 text-sm text-[#8A857D]">
          Loading ETL projects...
        </span>
      </div>
    );
  }

  // -- No project yet: create one ---------------------------------------------
  if (!existingProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
        <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
          <GitMerge size={28} className="text-[#2DD4BF]" />
        </div>
        <h3 className="text-[#F0EDE8] font-semibold text-lg">
          Create ETL Mapping Project
        </h3>
        <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
          Start mapping your source schema to the OMOP CDM. This will create a
          new Aqueduct project linked to the selected source and its scan
          profile.
        </p>

        <div className="mt-6 flex items-center gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
              CDM Version
            </label>
            <select
              value={cdmVersion}
              onChange={(e) => setCdmVersion(e.target.value)}
              className="rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF]"
            >
              <option value="5.4">OMOP CDM v5.4</option>
              <option value="5.3">OMOP CDM v5.3</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleCreateProject}
            disabled={createProject.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
          >
            {createProject.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={15} />
                Create Project
              </>
            )}
          </button>
        </div>

        {createProject.isError && (
          <p className="mt-3 text-xs text-[#E85A6B]">
            {(createProject.error as Error)?.message ?? "Failed to create project"}
          </p>
        )}
      </div>
    );
  }

  // -- Project exists: field detail drill-down ---------------------------------
  if (drilledDownMappingId !== null && drilledMapping && projectDetail) {
    return (
      <FieldMappingDetail
        project={projectDetail.project}
        tableMapping={drilledMapping}
        sourceColumns={drilledSourceColumns}
        cdmColumns={drilledCdmColumns}
        onBack={() => onDrilledMapping(null)}
        onNavigate={(id) => onDrilledMapping(id)}
        allMappingIds={allMappingIds}
      />
    );
  }

  // -- Project exists: canvas overview -----------------------------------------
  if (projectDetail) {
    return (
      <AqueductCanvas
        project={projectDetail.project}
        tableMappings={tableMappings}
        sourceFields={sourceFields}
        onDrillDown={(id) => onDrilledMapping(id)}
        onBack={() => onDrilledMapping(null)}
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function EtlToolsPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Determine initial step from URL
  const initialStep = useMemo((): 1 | 2 => {
    const stepParam = searchParams.get("step");
    if (stepParam === "mapping") return 2;
    if (stepParam === "profiler") return 1;
    if (location.pathname.includes("source-profiler")) return 1;
    return 1;
  }, [searchParams, location.pathname]);

  // -- State ------------------------------------------------------------------
  const [activeStep, setActiveStep] = useState<1 | 2>(initialStep);
  const [selectedSourceId, setSelectedSourceId] = useState<number | "">("");
  const [drilledDownMappingId, setDrilledDownMappingId] = useState<number | null>(null);

  // -- Queries ----------------------------------------------------------------
  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const sourceIdNum = Number(selectedSourceId) || 0;
  const { data: profileHistoryData } = useProfileHistory(sourceIdNum);
  const profileHistory = profileHistoryData?.data ?? [];

  // Determine if source has scan data (step 2 eligibility)
  const hasScanData = profileHistory.length > 0;
  const latestProfileId = profileHistory.length > 0 ? profileHistory[0].id : 0;

  // If step 2 becomes disabled while active, fall back to step 1
  const effectiveStep = activeStep === 2 && !hasScanData ? 1 : activeStep;

  const handleStepClick = useCallback(
    (step: 1 | 2) => {
      setActiveStep(step);
      if (step !== 2) {
        setDrilledDownMappingId(null);
      }
    },
    [],
  );

  const handleSourceChange = useCallback(
    (newSourceId: number | "") => {
      setSelectedSourceId(newSourceId);
      setDrilledDownMappingId(null);
      // Don't reset step — let them stay on current step
    },
    [],
  );

  const handleStartMapping = useCallback(() => {
    if (hasScanData) {
      setActiveStep(2);
      setDrilledDownMappingId(null);
    }
  }, [hasScanData]);

  // -- Render -----------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            ETL Pipeline
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Profile source databases, then design ETL mappings to OMOP CDM with
            Aqueduct
          </p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(45,212,191,0.12)]">
          <GitMerge size={20} className="text-[#2DD4BF]" />
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator
        activeStep={effectiveStep}
        step2Enabled={hasScanData}
        onStepClick={handleStepClick}
      />

      {/* Source selector — shared between both steps */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-sm space-y-1.5">
            <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
              <Database size={12} className="inline mr-1.5 -mt-0.5" />
              Data Source
            </label>
            <select
              value={selectedSourceId}
              onChange={(e) =>
                handleSourceChange(
                  e.target.value ? Number(e.target.value) : "",
                )
              }
              className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#9B1B30]"
            >
              <option value="">Select a source...</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.source_name}
                </option>
              ))}
            </select>
          </div>

          {/* "Start Mapping" button — visible in step 1 when scan data exists */}
          {effectiveStep === 1 && hasScanData && selectedSourceId && (
            <button
              type="button"
              onClick={handleStartMapping}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
            >
              Start Mapping
              <ArrowRight size={15} />
            </button>
          )}

          {/* Back to profiler button — visible in step 2 */}
          {effectiveStep === 2 && (
            <button
              type="button"
              onClick={() => handleStepClick(1)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#2E2E35] bg-[#1C1C20] px-4 py-2.5 text-sm text-[#C5C0B8] hover:bg-[#232328] transition-colors"
            >
              <ChevronLeft size={15} />
              Back to Profiler
            </button>
          )}
        </div>
      </div>

      {/* Step content */}
      {effectiveStep === 1 && <SourceProfilerPage />}

      {effectiveStep === 2 && selectedSourceId && hasScanData && (
        <AqueductStep
          sourceId={sourceIdNum}
          sourceProfileId={latestProfileId}
          onDrilledMapping={setDrilledDownMappingId}
          drilledDownMappingId={drilledDownMappingId}
        />
      )}

      {effectiveStep === 2 && !selectedSourceId && (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
            <ScanSearch size={28} className="text-[#8A857D]" />
          </div>
          <h3 className="text-[#F0EDE8] font-semibold text-lg">
            Select a source
          </h3>
          <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
            Choose a data source above to begin designing your ETL mapping.
          </p>
        </div>
      )}
    </div>
  );
}
