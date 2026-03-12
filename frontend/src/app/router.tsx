import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { SourcesListPage } from "@/features/data-sources/pages/SourcesListPage";
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
    path: "/shared/:token",
    lazy: () =>
      import(
        "@/features/cohort-definitions/pages/SharedCohortPage"
      ).then((m) => ({ Component: m.default })),
  },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "data-sources", element: <SourcesListPage /> },
      {
        path: "ingestion",
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/ingestion/pages/IngestionDashboardPage").then(
                (m) => ({ Component: m.default }),
              ),
          },
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
            lazy: () =>
              import(
                "@/features/analyses/pages/CharacterizationDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "incidence-rates/:id",
            lazy: () =>
              import(
                "@/features/analyses/pages/IncidenceRateDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "pathways/:id",
            lazy: () =>
              import(
                "@/features/pathways/pages/PathwayDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "estimations/:id",
            lazy: () =>
              import(
                "@/features/estimation/pages/EstimationDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "predictions/:id",
            lazy: () =>
              import(
                "@/features/prediction/pages/PredictionDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "sccs/:id",
            lazy: () =>
              import(
                "@/features/sccs/pages/SccsDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "evidence-synthesis/:id",
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
  {}
);
