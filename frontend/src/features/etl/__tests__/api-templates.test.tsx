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
  it("fetches catalog and unwraps data envelope", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [{ id: "hello_cdm", name: "Hello CDM" }] },
    });
    const { result } = renderHook(() => useTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates");
    expect(result.current.data?.[0].id).toBe("hello_cdm");
  });
});

describe("useSubmitTemplateRun", () => {
  it("POSTs to the template runs endpoint", async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 42 } } });
    const { result } = renderHook(() => useSubmitTemplateRun(), { wrapper });
    await result.current.mutateAsync({
      templateId: "hello_cdm",
      version: "0.1.0",
      parameters: { target_schema: "demo" },
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/ingestion/templates/hello_cdm/runs",
      { version: "0.1.0", parameters: { target_schema: "demo" } },
    );
  });
});

describe("useCancelTemplateRun", () => {
  it("DELETEs the run", async () => {
    mockedDel.mockResolvedValueOnce({ data: { data: { ok: true } } });
    const { result } = renderHook(() => useCancelTemplateRun(7), { wrapper });
    await result.current.mutateAsync();
    expect(mockedDel).toHaveBeenCalledWith("/ingestion/templates/runs/7");
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
  it("useTemplate hits /ingestion/templates/:id", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { id: "hello_cdm", nodes: [], post_conditions: [] } },
    });
    const { result } = renderHook(() => useTemplate("hello_cdm"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/hello_cdm");
  });
  it("useTemplateRun hits /ingestion/templates/runs/:id", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { id: 7, status: "completed" } },
    });
    const { result } = renderHook(() => useTemplateRun(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/runs/7");
  });
  it("useTemplateRunLogs hits /ingestion/templates/runs/:id/logs", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    const { result } = renderHook(() => useTemplateRunLogs(7, "completed"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/ingestion/templates/runs/7/logs");
  });
  it("useTemplateRunArtifacts hits /ingestion/templates/runs/:id/artifacts", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    const { result } = renderHook(
      () => useTemplateRunArtifacts(7, "completed"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith(
      "/ingestion/templates/runs/7/artifacts",
    );
  });
});
