import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { SourceReadinessBanner } from "../components/SourceReadinessBanner";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("SourceReadinessBanner", () => {
  it("renders Initialize button when not ready and no active setup", async () => {
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA", ready: false, missing: ["stratified_code_counts"], setup_run_id: null,
    });
    render(<SourceReadinessBanner sourceKey="EUNOMIA" />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole("button", { name: /initialize source/i })).toBeInTheDocument());
  });

  it("renders progress panel when setup_run_id is present", async () => {
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA", ready: false, missing: [], setup_run_id: "run_abc",
    });
    mock.onGet("/finngen/runs/run_abc").reply(200, {
      id: "run_abc", status: "running", progress: { pct: 35, step: "create_tables", message: "Building..." },
    });
    render(<SourceReadinessBanner sourceKey="EUNOMIA" />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText(/setting up EUNOMIA/i)).toBeInTheDocument());
    expect(screen.getByText(/35%/)).toBeInTheDocument();
  });

  it("renders nothing when ready", async () => {
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA", ready: true, missing: [], setup_run_id: null,
    });
    const { container } = render(<SourceReadinessBanner sourceKey="EUNOMIA" />, { wrapper: Wrapper });
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
