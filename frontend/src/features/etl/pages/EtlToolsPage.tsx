import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  GitMerge,
  Plus,
} from "lucide-react";
import { fetchIngestionProjects, type IngestionProject } from "@/features/ingestion/api/ingestionApi";
import { AqueductCanvas } from "../components/aqueduct/AqueductCanvas";
import {
  useEtlProjects,
  useCreateEtlProject,
  useEtlProject,
  useTableMappings,
} from "../hooks/useAqueductData";
import {
  fetchIngestionProjectFields,
  suggestMappings,
  type PersistedFieldProfile,
} from "../api";

// ---------------------------------------------------------------------------
// Aqueduct canvas content
// ---------------------------------------------------------------------------

function AqueductContent({
  ingestionProjectId,
}: {
  ingestionProjectId: number;
}) {
  const { data: projectsData, isLoading: loadingProjects } = useEtlProjects();
  const createProject = useCreateEtlProject();
  const [cdmVersion, setCdmVersion] = useState("5.4");

  // Find existing ETL project for this ingestion project
  const existingProject = useMemo(() => {
    if (!projectsData?.data) return null;
    return projectsData.data.find((p) => p.ingestion_project_id === ingestionProjectId) ?? null;
  }, [projectsData, ingestionProjectId]);

  const projectId = existingProject?.id ?? 0;
  const { data: projectDetail } = useEtlProject(projectId);
  const { data: tableMappings = [] } = useTableMappings(projectId);

  // Source fields from ingestion project's field profiles
  const [sourceFields, setSourceFields] = useState<PersistedFieldProfile[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);

  useMemo(() => {
    if (ingestionProjectId > 0 && !fieldsLoaded) {
      fetchIngestionProjectFields(ingestionProjectId)
        .then((fields) => {
          setSourceFields(fields);
          setFieldsLoaded(true);
        })
        .catch(() => {
          setFieldsLoaded(true);
        });
    }
  }, [ingestionProjectId, fieldsLoaded]);

  const handleCreateProject = useCallback(() => {
    createProject.mutate(
      {
        ingestion_project_id: ingestionProjectId,
        cdm_version: cdmVersion,
      },
      {
        onSuccess: (newProject) => {
          suggestMappings(newProject.id).catch(() => {
            // Suggestion is best-effort; failure is non-blocking
          });
        },
      },
    );
  }, [createProject, ingestionProjectId, cdmVersion]);

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

  // Canvas overview
  if (projectDetail) {
    return (
      <AqueductCanvas
        project={projectDetail.project}
        tableMappings={tableMappings}
        sourceFields={sourceFields}
        onBack={() => window.history.back()}
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
  const projectParam = searchParams.get("project");

  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(() =>
    projectParam ? Number(projectParam) : "",
  );

  useEffect(() => {
    if (projectParam && Number(projectParam) > 0) {
      setSelectedProjectId(Number(projectParam));
    }
  }, [projectParam]);

  const { data: projectsData } = useQuery({
    queryKey: ["ingestion-projects"],
    queryFn: fetchIngestionProjects,
  });

  const readyProjects = useMemo(() => {
    const all = projectsData?.data ?? [];
    return all.filter((p: IngestionProject) => p.status === "ready" || p.status === "mapping" || p.status === "completed");
  }, [projectsData]);

  const selectedProjectIdNum = Number(selectedProjectId) || 0;
  const hasJobs = readyProjects.some((p: IngestionProject) => p.id === selectedProjectIdNum);

  if (selectedProjectId && hasJobs) {
    return (
      <AqueductContent ingestionProjectId={selectedProjectIdNum} />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
      <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
        <GitMerge size={28} className="text-[#8A857D]" />
      </div>
      <h3 className="text-[#F0EDE8] font-semibold text-lg">
        Aqueduct ETL Mapping Designer
      </h3>
      <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
        Navigate to an ingestion project and click &ldquo;Open in Aqueduct&rdquo; to start
        designing ETL mappings from your source schema to the OMOP CDM.
      </p>
    </div>
  );
}
