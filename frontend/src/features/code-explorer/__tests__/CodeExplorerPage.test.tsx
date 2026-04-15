import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { MemoryRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { CodeExplorerPage } from "../pages/CodeExplorerPage";

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet("/sources").reply(200, { data: [{ source_key: "EUNOMIA", source_name: "Eunomia" }] });
});
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CodeExplorerPage", () => {
  it("mounts with the source picker", async () => {
    render(<CodeExplorerPage />, { wrapper: Wrapper });
    expect(await screen.findByText(/Code Explorer/i)).toBeInTheDocument();
  });

  it("shows the tab nav with 5 tabs", () => {
    render(<CodeExplorerPage />, { wrapper: Wrapper });
    for (const label of ["Counts", "Relationships", "Hierarchy", "Report", "My Reports"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
