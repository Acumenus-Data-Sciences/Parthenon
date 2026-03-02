import { createBrowserRouter } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { SourcesListPage } from "@/features/data-sources/pages/SourcesListPage";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-muted-foreground">Coming soon</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <MainLayout />,
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
      { path: "analyses", element: <PlaceholderPage title="Analyses" /> },
      { path: "studies", element: <PlaceholderPage title="Studies" /> },
      {
        path: "profiles",
        element: <PlaceholderPage title="Patient Profiles" />,
      },
      { path: "jobs", element: <PlaceholderPage title="Jobs" /> },
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
        ],
      },
    ],
  },
]);
