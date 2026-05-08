import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { RunInspector } from "../components/aqueduct/templates/RunInspector";

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedDel = vi.mocked(apiClient.delete);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedDel.mockReset();
});

const RUN_RUNNING = {
  id: 7,
  template_id: "hello_cdm",
  template_version: "0.1.0",
  parameters: {},
  status: "running" as const,
  progress: 0.5,
  current_node: "load",
  prefect_run_id: "00000000-0000-0000-0000-000000000000",
  error_message: null,
  post_conditions: [],
  artifacts_path: null,
  submitted_by: 1,
  submitted_at: "2026-05-02T12:00:00Z",
  started_at: "2026-05-02T12:00:01Z",
  finished_at: null,
};

const RUN_FAILED = { ...RUN_RUNNING, status: "failed" as const };

const MANIFEST = {
  id: "hello_cdm",
  name: "Hello CDM",
  version: "0.1.0",
  description: "",
  category: "bootstrap",
  tags: [],
  cdm_versions: ["5.4"],
  parameters_schema: { type: "object", properties: {} },
  nodes: [
    { id: "fetch", kind: "generic_file", inputs: [], outputs: [] },
    { id: "load", kind: "db_writer", inputs: [], outputs: [] },
  ],
  post_conditions: [],
};

describe("RunInspector", () => {
  it("shows the cancel button while running, hides on terminal", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({ data: RUN_RUNNING });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: MANIFEST });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { lines: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    render(<RunInspector runId={7} />, { wrapper });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Cancel run/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Retry/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the retry button when failed", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({ data: RUN_FAILED });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: MANIFEST });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { lines: [] } });
      if (url === "/ingestion/templates/runs/7/artifacts")
        return Promise.resolve({ data: { artifacts: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    render(<RunInspector runId={7} />, { wrapper });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Retry/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Cancel run/i }),
    ).not.toBeInTheDocument();
  });

  it("DELETEs the run when cancel is clicked", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({ data: RUN_RUNNING });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: MANIFEST });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { lines: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    mockedDel.mockResolvedValueOnce({
      data: { ok: true, id: 7, status: "cancelled" },
    });

    render(<RunInspector runId={7} />, { wrapper });
    const btn = await screen.findByRole("button", { name: /Cancel run/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(mockedDel).toHaveBeenCalledWith("/ingestion/templates/runs/7"),
    );
  });

  it("POSTs a new run with same params when retry is clicked", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates/runs/7")
        return Promise.resolve({
          data: { ...RUN_FAILED, parameters: { foo: "bar" } },
        });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: MANIFEST });
      if (url === "/ingestion/templates/runs/7/logs")
        return Promise.resolve({ data: { lines: [] } });
      if (url === "/ingestion/templates/runs/7/artifacts")
        return Promise.resolve({ data: { artifacts: [] } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    mockedPost.mockResolvedValueOnce({
      data: {
        id: 8,
        template_run_id: 8,
        ingestion_job_id: null,
        status: "queued",
      },
    });

    render(<RunInspector runId={7} />, { wrapper });
    const btn = await screen.findByRole("button", { name: /Retry/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        "/ingestion/templates/hello_cdm/runs",
        { version: "0.1.0", parameters: { foo: "bar" } },
      ),
    );
  });
});
