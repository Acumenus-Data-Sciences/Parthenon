import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "@/lib/api-client";
import { MyReportsTab } from "../components/MyReportsTab";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("MyReportsTab", () => {
  it("renders empty-state when no reports", async () => {
    mock.onGet("/finngen/runs").reply(200, { data: [], meta: { page: 1, per_page: 25, total: 0 } });
    render(<MyReportsTab onOpenReport={() => {}} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText(/no reports yet/i)).toBeInTheDocument());
  });

  it("row click fires onOpenReport", async () => {
    mock.onGet("/finngen/runs").reply(200, {
      data: [{
        id: "run_abc",
        user_id: 1,
        source_key: "EUNOMIA",
        analysis_type: "romopapi.report",
        params: { concept_id: 201826 },
        status: "succeeded",
        progress: null,
        artifacts: {},
        summary: null,
        error: null,
        pinned: false,
        artifacts_pruned: false,
        darkstar_job_id: null,
        horizon_job_id: null,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
      meta: { page: 1, per_page: 25, total: 1 },
    });

    const onOpen = vi.fn();
    render(<MyReportsTab onOpenReport={onOpen} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText("EUNOMIA")).toBeInTheDocument());
    await userEvent.click(screen.getByText("EUNOMIA"));
    expect(onOpen).toHaveBeenCalledWith("run_abc");
  });
});
