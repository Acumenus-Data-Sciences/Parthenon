/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { OidcCallbackPage } from "@/features/auth/pages/OidcCallbackPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { SourcesListPage } from "@/features/data-sources/pages/SourcesListPage";
import { AnalysisRouteError } from "@/features/analyses/components/AnalysisRouteError";
import { useAuthStore } from "@/stores/authStore";

function ProtectedLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <MainLayout />;
}

export const router = createBrowserRouter(
  [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/auth/callback",
    element: <OidcCallbackPage />,
  },
  {
    path: "/shared/:token",
    lazy: () =>
      import(
        "@/features/cohort-definitions/pages/SharedCohortPage"
      ).then((m) => ({ Component: m.default })),
  },
  {
    path: "/survey/:token",
    lazy: () =>
      import(
        "@/features/standard-pros/pages/PublicSurveyPage"
      ).then((m) => ({ Component: m.default })),
  },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: "commons",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/commons/pages/CommonsPage").then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: ":slug",
            lazy: () =>
              import("@/features/commons/pages/CommonsPage").then((m) => ({
                Component: m.default,
              })),
          },
        ],
      },
      { path: "data-sources", element: <SourcesListPage /> },
      {
        path: "ingestion",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/ingestion/pages/DataIngestionPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          // Deep-link routes for ingestion job workflow (used by Upload Files tab)
          {
            path: "upload",
            lazy: () =>
              import("@/features/ingestion/pages/UploadPage").then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: "jobs/:jobId",
            lazy: () =>
              import("@/features/ingestion/pages/JobDetailPage").then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: "jobs/:jobId/schema-mapping",
            lazy: () =>
              import(
                "@/features/ingestion/pages/SchemaMappingPage"
              ).then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: "jobs/:jobId/review",
            lazy: () =>
              import(
                "@/features/ingestion/pages/MappingReviewPage"
              ).then((m) => ({
                Component: m.default,
              })),
          },
        ],
      },
      {
        path: "data-explorer",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/data-explorer/pages/DataExplorerPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: ":sourceId",
            lazy: () =>
              import("@/features/data-explorer/pages/DataExplorerPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
      {
        path: "vocabulary",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/vocabulary/pages/VocabularyPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "compare",
            lazy: () =>
              import("@/features/vocabulary/pages/ConceptComparePage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
      {
        path: "cohort-definitions",
        children: [
          {
            index: true,
            lazy: () =>
              import(
                "@/features/cohort-definitions/pages/CohortDefinitionsPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: ":id",
            lazy: () =>
              import(
                "@/features/cohort-definitions/pages/CohortDefinitionDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: "concept-sets",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/concept-sets/pages/ConceptSetsPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: ":id",
            lazy: () =>
              import(
                "@/features/concept-sets/pages/ConceptSetDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: "jupyter",
        lazy: () =>
          import("@/features/jupyter/pages/JupyterPage").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "analyses",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/analyses/pages/AnalysesPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "characterizations/:id",
            errorElement: <AnalysisRouteError title="Characterization" />,
            lazy: () =>
              import(
                "@/features/analyses/pages/CharacterizationDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "incidence-rates/:id",
            errorElement: <AnalysisRouteError title="Incidence Rate Analysis" />,
            lazy: () =>
              import(
                "@/features/analyses/pages/IncidenceRateDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "pathways/:id",
            errorElement: <AnalysisRouteError title="Pathway Analysis" />,
            lazy: () =>
              import(
                "@/features/pathways/pages/PathwayDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "estimations/:id",
            errorElement: <AnalysisRouteError title="Estimation Analysis" />,
            lazy: () =>
              import(
                "@/features/estimation/pages/EstimationDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "predictions/:id",
            errorElement: <AnalysisRouteError title="Prediction Analysis" />,
            lazy: () =>
              import(
                "@/features/prediction/pages/PredictionDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "sccs/:id",
            errorElement: <AnalysisRouteError title="SCCS Analysis" />,
            lazy: () =>
              import(
                "@/features/sccs/pages/SccsDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "evidence-synthesis/:id",
            errorElement: <AnalysisRouteError title="Evidence Synthesis Analysis" />,
            lazy: () =>
              import(
                "@/features/evidence-synthesis/pages/EvidenceSynthesisDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: "studies",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/studies/pages/StudiesPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "create",
            lazy: () =>
              import("@/features/studies/pages/StudyCreatePage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: ":id",
            lazy: () =>
              import(
                "@/features/studies/pages/StudyDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
      // ── Study Designer (OHDSI StudyAgent) ───────────────────────────────
      ...(import.meta.env.VITE_STUDY_AGENT_ENABLED === "true"
        ? [
            {
              path: "study-designer",
              lazy: () =>
                import("@/features/study-agent/pages/StudyDesignerPage").then(
                  (m) => ({ Component: m.default }),
                ),
            },
          ]
        : []),
      // ── Workbench (always available — individual toolsets gate themselves) ──
      {
        path: "workbench",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/workbench/pages/WorkbenchLauncherPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "finngen",
            element: <Navigate to="/workbench/investigation" replace />,
          },
          {
            // SP4 Phase F — FinnGen Cohort Workbench
            path: "cohorts",
            children: [
              {
                index: true,
                lazy: () =>
                  import(
                    "@/features/finngen-workbench/pages/SessionsListPage"
                  ).then((m) => ({ Component: m.default })),
              },
              {
                path: ":sessionId",
                lazy: () =>
                  import(
                    "@/features/finngen-workbench/pages/WorkbenchPage"
                  ).then((m) => ({ Component: m.default })),
              },
            ],
          },
          {
            // SP4 Polish 2 — standalone FinnGen Analysis Gallery (workbench handoff target)
            path: "finngen-analyses",
            lazy: () =>
              import(
                "@/features/finngen-analyses/pages/FinnGenAnalysesStandalonePage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "community-sdk-demo",
            lazy: () =>
              import(
                "@/features/community-workbench-sdk/pages/CommunityWorkbenchSdkDemoPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "investigation",
            children: [
              {
                index: true,
                lazy: () =>
                  import(
                    "@/features/investigation/pages/InvestigationLandingPage"
                  ).then((m) => ({ Component: m.default })),
              },
              {
                path: "new",
                lazy: () =>
                  import(
                    "@/features/investigation/pages/NewInvestigationPage"
                  ).then((m) => ({ Component: m.default })),
              },
              {
                path: ":investigationId",
                lazy: () =>
                  import(
                    "@/features/investigation/pages/InvestigationPage"
                  ).then((m) => ({ Component: m.default })),
              },
            ],
          },
        ],
      },
      {
        path: "finngen-tools",
        element: <Navigate to="/workbench/investigation" replace />,
      },
      {
        // SP2 Code Explorer moved into Investigation as a domain tab.
        // Preserve the old URL as a redirect for any bookmarks.
        path: "finngen/explore",
        element: <Navigate to="/workbench/investigation" replace />,
      },
      {
        path: "workbench/aqueduct",
        element: <Navigate to="/workbench" replace />,
      },
      {
        path: "workbench/help",
        element: <Navigate to="/workbench/investigation" replace />,
      },
      // ── Strategus Study Packages ─────────────────────────────────────────
      {
        path: "study-packages",
        lazy: () =>
          import("@/features/strategus/pages/StudyPackagePage").then(
            (m) => ({ Component: m.default }),
          ),
      },
      // ── Phenotype Library ────────────────────────────────────────────────
      {
        path: "phenotype-library",
        lazy: () =>
          import(
            "@/features/phenotype-library/pages/PhenotypeLibraryPage"
          ).then((m) => ({ Component: m.default })),
      },
      // ── Mapping Assistant (Ariadne) ──────────────────────────────────────
      {
        path: "mapping-assistant",
        lazy: () =>
          import(
            "@/features/vocabulary/pages/MappingAssistantPage"
          ).then((m) => ({ Component: m.default })),
      },
      {
        path: "publish",
        lazy: () =>
          import("@/features/publish/pages/PublishPage").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "profiles",
        children: [
          {
            index: true,
            lazy: () =>
              import(
                "@/features/profiles/pages/PatientProfilePage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: ":personId",
            lazy: () =>
              import(
                "@/features/profiles/pages/PatientProfilePage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
      // ── Risk Scores ──────���───────────────────────────────────────────
      // ── Patient Similarity ────────────────────────────────────────
      {
        path: "patient-similarity",
        lazy: () =>
          import(
            "@/features/patient-similarity/pages/PatientSimilarityWorkspace"
          ).then((m) => ({ Component: m.default })),
      },
      {
        path: "patient-similarity/compare",
        lazy: () =>
          import(
            "@/features/patient-similarity/pages/PatientComparisonPage"
          ).then((m) => ({ Component: m.default })),
      },
      {
        path: "risk-scores",
        children: [
          {
            index: true,
            lazy: () =>
              import(
                "@/features/risk-scores/pages/RiskScoreHubPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "create",
            lazy: () =>
              import(
                "@/features/risk-scores/pages/RiskScoreCreatePage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: ":id",
            lazy: () =>
              import(
                "@/features/risk-scores/pages/RiskScoreDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
      // ── Standard PROs+ ────────────────────────────────────────────────
      {
        path: "standard-pros",
        children: [
          {
            index: true,
            lazy: () =>
              import(
                "@/features/standard-pros/pages/StandardProsPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: ":id",
            lazy: () =>
              import(
                "@/features/standard-pros/pages/InstrumentDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: "morpheus",
        lazy: () =>
          import("@/features/morpheus/components/MorpheusLayout").then((m) => ({
            Component: m.default,
          })),
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/morpheus/pages/MorpheusDashboardPage").then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: "journey",
            lazy: () =>
              import("@/features/morpheus/pages/PatientJourneyPage").then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: "journey/:subjectId",
            lazy: () =>
              import("@/features/morpheus/pages/PatientJourneyPage").then((m) => ({
                Component: m.default,
              })),
          },
        ],
      },
      {
        path: "care-gaps",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/care-gaps/pages/CareGapsPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: ":id",
            lazy: () =>
              import("@/features/care-gaps/pages/BundleDetailPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
      {
        path: "jobs",
        lazy: () =>
          import("@/features/jobs/pages/JobsPage").then((m) => ({
            Component: m.default,
          })),
      },
      // ── Phase 15: Genomics ────────────────────────────────────────────────
      {
        path: "genomics",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/genomics/pages/GenomicsPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "uploads/:id",
            lazy: () =>
              import("@/features/genomics/pages/UploadDetailPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "analysis",
            lazy: () =>
              import("@/features/genomics/pages/GenomicAnalysisPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "tumor-board",
            lazy: () =>
              import("@/features/genomics/pages/TumorBoardPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
      // ── Phase 16: Imaging ─────────────────────────────────────────────
      {
        path: "imaging",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/imaging/pages/ImagingPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "studies/:id",
            lazy: () =>
              import("@/features/imaging/pages/ImagingStudyPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
      // ── Phase 17: HEOR ────────────────────────────────────────────────
      {
        path: "heor",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/heor/pages/HeorPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: ":id",
            lazy: () =>
              import("@/features/heor/pages/HeorAnalysisPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
      // ── Query Assistant (Text-to-SQL) ────────────────────────────────
      {
        path: "query-assistant",
        lazy: () =>
          import(
            "@/features/text-to-sql/pages/QueryAssistantPage"
          ).then((m) => ({ Component: m.default })),
      },
      // ── Legacy route redirects → unified Data Ingestion page ──────────
      {
        path: "source-profiler",
        element: <Navigate to="/ingestion?tab=profiler" replace />,
      },
      {
        path: "fhir-ingestion",
        element: <Navigate to="/ingestion?tab=fhir" replace />,
      },
      {
        path: "etl-tools",
        element: <Navigate to="/ingestion?tab=aqueduct" replace />,
      },
      // ── GIS Explorer ────────────────────────────────────────────────
      {
        path: "gis",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/gis/pages/GisPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
        ],
      },
      // ── User Settings ────────────────────────────────────────────────
      {
        path: "settings",
        lazy: () =>
          import("@/features/settings/pages/SettingsPage").then((m) => ({
            Component: m.default,
          })),
      },
      // ── Administration ────────────────────────────────────────────────
      {
        path: "admin",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/administration/pages/AdminDashboardPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "users",
            lazy: () =>
              import("@/features/administration/pages/UsersPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "user-audit",
            lazy: () =>
              import("@/features/administration/pages/UserAuditPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "roles",
            lazy: () =>
              import("@/features/administration/pages/RolesPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "auth-providers",
            lazy: () =>
              import("@/features/administration/pages/AuthProvidersPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "ai-providers",
            lazy: () =>
              import("@/features/administration/pages/AiProvidersPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "system-health",
            lazy: () =>
              import("@/features/administration/pages/SystemHealthPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "honest-broker",
            lazy: () =>
              import("@/features/administration/pages/HonestBrokerPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "system-health/:key",
            lazy: () =>
              import("@/features/administration/pages/ServiceDetailPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "vocabulary",
            lazy: () =>
              import("@/features/administration/pages/VocabularyPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
          {
            path: "webapi-registry",
            lazy: () =>
              import("@/features/data-sources/pages/WebApiRegistryPage").then(
                (m) => ({ Component: m.WebApiRegistryPage }),
              ),
          },
{
            path: "fhir-connections",
            lazy: () =>
              import(
                "@/features/administration/pages/FhirConnectionsPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "fhir-sync-monitor",
            lazy: () =>
              import(
                "@/features/administration/pages/FhirSyncDashboardPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "solr",
            lazy: () =>
              import(
                "@/features/administration/pages/SolrAdminPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "notifications",
            lazy: () =>
              import(
                "@/features/settings/pages/NotificationSettingsPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "fhir-export",
            lazy: () =>
              import(
                "@/features/administration/pages/FhirExportPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
    ],
  },
  ],
);
