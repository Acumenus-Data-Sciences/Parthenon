import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  const post = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, delete: del },
    apiClient: { get, post, delete: del },
  };
});

import { apiClient } from "@/lib/api-client";
import { AqueductRunsPage } from "../pages/AqueductRunsPage";

const mockedGet = vi.mocked(apiClient.get);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={["/data-ingestion?tab=aqueduct&subtab=runs"]}
      >
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => mockedGet.mockReset());

const RUN = {
  id: 42,
  template_id: "hello_cdm",
  template_version: "0.1.0",
  parameters: {},
  status: "completed",
  progress: 1.0,
  current_node: null,
  prefect_run_id: null,
  error_message: null,
  post_conditions: [],
  artifacts_path: null,
  submitted_by: 1,
  submitted_at: "2026-05-02T12:00:00Z",
  started_at: "2026-05-02T12:00:01Z",
  finished_at: "2026-05-02T12:00:30Z",
};

describe("AqueductRunsPage", () => {
  it("renders the run history table with a row per run", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [RUN],
        meta: { total: 1, page: 1, per_page: 20 },
      },
    });
    render(<AqueductRunsPage />, { wrapper });
    expect(await screen.findByText("hello_cdm")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("filters by status when chips are toggled", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, per_page: 20 },
      },
    });
    render(<AqueductRunsPage />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /^Failed$/ }));
    await waitFor(() => {
      const lastCall = mockedGet.mock.calls.at(-1);
      expect(lastCall?.[0]).toContain("status%5B%5D=failed");
    });
  });

  it("opens the inspector when a row is clicked", async () => {
    mockedGet.mockImplementation((url?: string) => {
      if (!url) return Promise.resolve({ data: { data: [] } });
      if (url.startsWith("/ingestion/templates/runs?"))
        return Promise.resolve({
          data: {
            data: [RUN],
            meta: { total: 1, page: 1, per_page: 20 },
          },
        });
      if (url === "/ingestion/templates/runs/42")
        return Promise.resolve({ data: { data: RUN } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({
          data: {
            data: { ...RUN, name: "Hello CDM", nodes: [], post_conditions: [] },
          },
        });
      if (url === "/ingestion/templates/runs/42/logs")
        return Promise.resolve({ data: { data: [] } });
      if (url === "/ingestion/templates/runs/42/artifacts")
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<AqueductRunsPage />, { wrapper });
    fireEvent.click(await screen.findByText("hello_cdm"));
    await waitFor(() => expect(screen.getByText(/DAG/i)).toBeInTheDocument());
  });
});
