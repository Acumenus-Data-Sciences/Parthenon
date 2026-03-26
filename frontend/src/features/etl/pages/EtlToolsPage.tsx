import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Database,
  Loader2,
  GitMerge,
  Plus,
} from "lucide-react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
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
} from "../api";
import { CDM_SCHEMA_V54 } from "../lib/cdm-schema-v54";

// ---------------------------------------------------------------------------
// Aqueduct canvas content
// ---------------------------------------------------------------------------

function AqueductContent({
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

  const drilledMapping = useMemo(() => {
    if (drilledDownMappingId === null) return null;
    return tableMappings.find((m) => m.id === drilledDownMappingId) ?? null;
  }, [tableMappings, drilledDownMappingId]);

  const allMappingIds = useMemo(
    () => tableMappings.map((m) => m.id),
    [tableMappings],
  );

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

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
        <span className="ml-3 text-sm text-[#8A857D]">Loading ETL projects...</span>
      </div>
    );
  }

  // No project: show create card
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
          Start mapping your source schema to the OMOP CDM. Select a source
          that has been profiled via the Source Profiler tab first.
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

  // Drill-down into field detail
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

  // Canvas overview
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
// Main Page (Aqueduct tab content)
// ---------------------------------------------------------------------------

export default function EtlToolsPage() {
  const [searchParams] = useSearchParams();
  const sourceParam = searchParams.get("source");

  const [selectedSourceId, setSelectedSourceId] = useState<number | "">(() =>
    sourceParam ? Number(sourceParam) : "",
  );
  const [drilledDownMappingId, setDrilledDownMappingId] = useState<number | null>(null);

  // Auto-select source from URL param (e.g., from "Open in Aqueduct" button)
  useEffect(() => {
    if (sourceParam && Number(sourceParam) > 0) {
      setSelectedSourceId(Number(sourceParam));
    }
  }, [sourceParam]);

  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const sourceIdNum = Number(selectedSourceId) || 0;
  const { data: profileHistoryData } = useProfileHistory(sourceIdNum);
  const profileHistory = profileHistoryData?.data ?? [];
  const hasScanData = profileHistory.length > 0;
  const latestProfileId = profileHistory.length > 0 ? profileHistory[0].id : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Source selector */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-sm space-y-1.5">
            <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
              <Database size={12} className="inline mr-1.5 -mt-0.5" />
              Data Source
            </label>
            <select
              value={selectedSourceId}
              onChange={(e) => {
                setSelectedSourceId(e.target.value ? Number(e.target.value) : "");
                setDrilledDownMappingId(null);
              }}
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
          {selectedSourceId && !hasScanData && (
            <p className="mt-5 text-sm text-[#8A857D]">
              No scan data found. Profile this source in the Source Profiler tab first.
            </p>
          )}
        </div>
      </div>

      {/* Aqueduct content */}
      {selectedSourceId && hasScanData ? (
        <AqueductContent
          sourceId={sourceIdNum}
          sourceProfileId={latestProfileId}
          onDrilledMapping={setDrilledDownMappingId}
          drilledDownMappingId={drilledDownMappingId}
        />
      ) : !selectedSourceId ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
            <GitMerge size={28} className="text-[#8A857D]" />
          </div>
          <h3 className="text-[#F0EDE8] font-semibold text-lg">
            Aqueduct ETL Mapping Designer
          </h3>
          <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
            Select a data source to design ETL mappings from your source schema
            to the OMOP CDM. Sources must be profiled via the Source Profiler tab first.
          </p>
        </div>
      ) : null}
    </div>
  );
}
