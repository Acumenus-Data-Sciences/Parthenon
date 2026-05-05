import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Loader2, GitMerge, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";
import {
  fetchIngestionProjects,
  type IngestionProject,
} from "@/features/ingestion/api/ingestionApi";
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
import { useTemplatesEnabled } from "../hooks/useAppSettings";

// Lazy-load template sub-tabs (matches DataIngestionPage pattern).
const AqueductTemplatesPage = lazy(() =>
  import("./AqueductTemplatesPage").then((m) => ({
    default: m.AqueductTemplatesPage,
  })),
);
const AqueductRunsPage = lazy(() =>
  import("./AqueductRunsPage").then((m) => ({
    default: m.AqueductRunsPage,
  })),
);

type SubTabId = "mappings" | "templates" | "runs";

function SubTabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  );
}

// ── Mappings sub-tab content (preserves existing behavior verbatim) ────────

function AqueductContent({
  ingestionProjectId,
}: {
  ingestionProjectId: number;
}) {
  const { t } = useTranslation("app");
  const { data: projectsData, isLoading: loadingProjects } = useEtlProjects();
  const createProject = useCreateEtlProject();
  const [cdmVersion, setCdmVersion] = useState("5.4");

  // Find existing ETL project for this ingestion project
  const existingProject = useMemo(() => {
    if (!projectsData?.data) return null;
    return (
      projectsData.data.find(
        (p) => p.ingestion_project_id === ingestionProjectId,
      ) ?? null
    );
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
        <Loader2 size={24} className="animate-spin text-success" />
        <span className="ml-3 text-sm text-text-muted">
          {t("etl.toolsPage.loadingProjects")}
        </span>
      </div>
    );
  }

  // No project: show create card
  if (!existingProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-border-default bg-surface-raised">
        <div className="w-16 h-16 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
          <GitMerge size={28} className="text-success" />
        </div>
        <h3 className="text-text-primary font-semibold text-lg">
          {t("etl.toolsPage.createTitle")}
        </h3>
        <p className="text-sm text-text-muted mt-1 text-center max-w-md">
          {t("etl.toolsPage.createDescription")}
        </p>
        <div className="mt-6 flex items-center gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
              {t("etl.toolsPage.cdmVersion")}
            </label>
            <select
              value={cdmVersion}
              onChange={(e) => setCdmVersion(e.target.value)}
              className="rounded-lg bg-surface-overlay border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success"
            >
              <option value="5.4">{t("etl.toolsPage.cdm54")}</option>
              <option value="5.3">{t("etl.toolsPage.cdm53")}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreateProject}
            disabled={createProject.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
          >
            {createProject.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {t("etl.toolsPage.creating")}
              </>
            ) : (
              <>
                <Plus size={15} />
                {t("etl.toolsPage.createProject")}
              </>
            )}
          </button>
        </div>
        {createProject.isError && (
          <p className="mt-3 text-xs text-critical">
            {(createProject.error as Error)?.message ??
              t("etl.toolsPage.createFailed")}
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

function MappingsTab() {
  const { t } = useTranslation("app");
  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get("project");

  const { data: projectsData } = useQuery({
    queryKey: ["ingestion-projects"],
    queryFn: fetchIngestionProjects,
  });

  const readyProjects = useMemo(() => {
    const all = projectsData?.data ?? [];
    return all.filter(
      (p: IngestionProject) =>
        p.status === "ready" ||
        p.status === "mapping" ||
        p.status === "completed",
    );
  }, [projectsData]);

  const selectedProjectIdNum = projectParam ? Number(projectParam) || 0 : 0;
  const hasJobs = readyProjects.some(
    (p: IngestionProject) => p.id === selectedProjectIdNum,
  );

  if (projectParam && hasJobs) {
    return <AqueductContent ingestionProjectId={selectedProjectIdNum} />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-border-default bg-surface-raised">
      <div className="w-16 h-16 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
        <GitMerge size={28} className="text-text-muted" />
      </div>
      <h3 className="text-text-primary font-semibold text-lg">
        {t("etl.toolsPage.emptyTitle")}
      </h3>
      <p className="text-sm text-text-muted mt-1 text-center max-w-md">
        {t("etl.toolsPage.emptyDescription")}
      </p>
    </div>
  );
}

// ── Sub-tab strip ──────────────────────────────────────────────────────────

const ALL_SUBTABS: { id: SubTabId; labelKey: string }[] = [
  { id: "mappings", labelKey: "aqueduct.subtabs.mappings" },
  { id: "templates", labelKey: "aqueduct.subtabs.templates" },
  { id: "runs", labelKey: "aqueduct.subtabs.runs" },
];

// ---------------------------------------------------------------------------
// Main Page (Aqueduct tab content)
//
// NOTE: This component is the default export because DataIngestionPage.tsx
// lazy-imports it via the default slot. Preserve that contract.
// ---------------------------------------------------------------------------

export default function EtlToolsPage() {
  const { t } = useTranslation("app");
  const templatesEnabled = useTemplatesEnabled();
  const [searchParams, setSearchParams] = useSearchParams();
  const subtabParam = searchParams.get("subtab");

  const visibleSubtabs = useMemo(
    () =>
      templatesEnabled
        ? ALL_SUBTABS
        : ALL_SUBTABS.filter((s) => s.id === "mappings"),
    [templatesEnabled],
  );

  // Derive activeSubtab from URL — no useState/useEffect cascade.
  // If subtabParam is invalid or hidden by the feature flag, fall back to "mappings".
  const activeSubtab: SubTabId = useMemo(() => {
    if (subtabParam && visibleSubtabs.some((s) => s.id === subtabParam)) {
      return subtabParam as SubTabId;
    }
    return "mappings";
  }, [subtabParam, visibleSubtabs]);

  const handleSubtabClick = useCallback(
    (id: SubTabId) => {
      const next = new URLSearchParams(searchParams);
      next.set("subtab", id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div
          role="tablist"
          aria-label={t("aqueduct.subtabs.aria", {
            defaultValue: "Aqueduct sub-tabs",
          })}
          className="flex items-center gap-1 border-b border-border-default flex-1"
        >
          {visibleSubtabs.map((sub) => (
            <button
              key={sub.id}
              role="tab"
              aria-selected={activeSubtab === sub.id}
              type="button"
              onClick={() => handleSubtabClick(sub.id)}
              className={cn(
                "relative px-4 py-2.5 text-sm uppercase tracking-wide transition-colors",
                activeSubtab === sub.id
                  ? "text-text-primary font-medium"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {t(sub.labelKey)}
              {activeSubtab === sub.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>
        <HelpButton helpKey="etl-tools" />
      </div>

      <Suspense fallback={<SubTabFallback />}>
        {activeSubtab === "mappings" && <MappingsTab />}
        {activeSubtab === "templates" && templatesEnabled && (
          <AqueductTemplatesPage />
        )}
        {activeSubtab === "runs" && templatesEnabled && <AqueductRunsPage />}
      </Suspense>
    </div>
  );
}
