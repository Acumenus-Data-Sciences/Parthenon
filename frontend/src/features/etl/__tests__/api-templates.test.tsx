import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
import {
  useTemplates,
  useTemplate,
  useTemplateRun,
  useTemplateRunLogs,
  useTemplateRunArtifacts,
  useSubmitTemplateRun,
  useCancelTemplateRun,
  templateRunRefetchInterval,
} from "../api/templates";
import type { TemplateRun } from "../types/templates";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedDel = vi.mocked(apiClient.delete);

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedDel.mockReset();
});

describe("useTemplates", () => {
  it("fetches catalog as a bare array", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{ id: "hello_cdm", name: "Hello CDM" }],
    });
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates");
    expect(result.current.data?.[0].id).toBe("hello_cdm");
  });
});

describe("useSubmitTemplateRun", () => {
  it("POSTs to the template runs endpoint and returns the flat response", async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        id: 42,
        template_run_id: 42,
        ingestion_job_id: null,
        status: "queued",
      },
    });
    const { result } = renderHook(() => useSubmitTemplateRun(), { wrapper });
    const resp = await result.current.mutateAsync({
      templateId: "hello_cdm",
      version: "0.1.0",
      parameters: { target_schema: "demo" },
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/ingestion/templates/hello_cdm/runs",
      { version: "0.1.0", parameters: { target_schema: "demo" } },
    );
    expect(resp.id).toBe(42);
  });
});

describe("useCancelTemplateRun", () => {
  it("DELETEs the run and returns {ok:true}", async () => {
    mockedDel.mockResolvedValueOnce({
      data: { ok: true, id: 7, status: "cancelled" },
    });
    const { result } = renderHook(() => useCancelTemplateRun(7), { wrapper });
    const resp = await result.current.mutateAsync();
    expect(mockedDel).toHaveBeenCalledWith("/ingestion/templates/runs/7");
    expect(resp.ok).toBe(true);
  });
});

describe("templateRunRefetchInterval", () => {
  it("returns 2000 while running", () => {
    const run: Partial<TemplateRun> = { status: "running" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(2000);
  });
  it("returns 2000 while queued", () => {
    const run: Partial<TemplateRun> = { status: "queued" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(2000);
  });
  it("returns false on completed", () => {
    const run: Partial<TemplateRun> = { status: "completed" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(false);
  });
  it("returns false on failed", () => {
    const run: Partial<TemplateRun> = { status: "failed" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(false);
  });
  it("returns false on cancelled", () => {
    const run: Partial<TemplateRun> = { status: "cancelled" };
    expect(templateRunRefetchInterval(run as TemplateRun)).toBe(false);
  });
  it("returns 2000 when undefined (initial fetch)", () => {
    expect(templateRunRefetchInterval(undefined)).toBe(2000);
  });
});

describe("useTemplate / useTemplateRun / logs / artifacts URL shape", () => {
  it("useTemplate hits /ingestion/templates/:id and returns flat manifest", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { id: "hello_cdm", nodes: [], post_conditions: [] },
    });
    const { result } = renderHook(() => useTemplate("hello_cdm"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/hello_cdm");
    expect(result.current.data?.id).toBe("hello_cdm");
  });
  it("useTemplateRun hits /ingestion/templates/runs/:id and returns flat run", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { id: 7, status: "completed" },
    });
    const { result } = renderHook(() => useTemplateRun(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/runs/7");
    expect(result.current.data?.id).toBe(7);
  });
  it("useTemplateRunLogs unwraps {lines:[…]}", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        lines: [
          { timestamp: "t", level: "info", message: "started", node_id: null },
        ],
      },
    });
    const { result } = renderHook(() => useTemplateRunLogs(7, "completed"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/runs/7/logs");
    expect(result.current.data?.[0].message).toBe("started");
  });
  it("useTemplateRunArtifacts unwraps {artifacts:[…]}", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        artifacts: [
          {
            name: "summary.json",
            size_bytes: 100,
            signed_url: "",
            content_type: "application/json",
          },
        ],
      },
    });
    const { result } = renderHook(
      () => useTemplateRunArtifacts(7, "completed"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith(
      "/ingestion/templates/runs/7/artifacts",
    );
    expect(result.current.data?.[0].name).toBe("summary.json");
  });
});
