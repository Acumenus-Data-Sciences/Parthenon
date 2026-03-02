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
      { path: "vocabulary", element: <PlaceholderPage title="Vocabulary" /> },
      {
        path: "cohort-definitions",
        element: <PlaceholderPage title="Cohort Definitions" />,
      },
      {
        path: "concept-sets",
        element: <PlaceholderPage title="Concept Sets" />,
      },
      { path: "analyses", element: <PlaceholderPage title="Analyses" /> },
      { path: "studies", element: <PlaceholderPage title="Studies" /> },
      {
        path: "profiles",
        element: <PlaceholderPage title="Patient Profiles" />,
      },
      { path: "jobs", element: <PlaceholderPage title="Jobs" /> },
      {
        path: "admin",
        element: <PlaceholderPage title="Administration" />,
      },
    ],
  },
]);
