import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigate };
});

import { apiClient } from "@/lib/api-client";
import { AqueductTemplatesPage } from "../pages/AqueductTemplatesPage";

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  navigate.mockReset();
});

const TEMPLATES = [
  {
    id: "hello_cdm",
    name: "Hello CDM",
    version: "0.1.0",
    description: "Bootstrap an empty CDM",
    category: "bootstrap",
    tags: ["smoke"],
    cdm_versions: ["5.4"],
    parameters_schema: { type: "object", properties: {} },
  },
];

const MANIFEST = {
  ...TEMPLATES[0],
  nodes: [],
  post_conditions: [],
};

describe("AqueductTemplatesPage", () => {
  it("shows the empty state when no templates", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });
    render(<AqueductTemplatesPage />, { wrapper });
    expect(
      await screen.findByText(/No templates available/i),
    ).toBeInTheDocument();
  });

  it("renders a card per template", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: TEMPLATES } });
    render(<AqueductTemplatesPage />, { wrapper });
    expect(await screen.findByText("Hello CDM")).toBeInTheDocument();
  });

  it("opens the parameter modal on card click", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates")
        return Promise.resolve({ data: { data: TEMPLATES } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    render(<AqueductTemplatesPage />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Hello CDM/ }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
  });

  it("submits the run and navigates to ?subtab=runs&run=<id>", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/ingestion/templates")
        return Promise.resolve({ data: { data: TEMPLATES } });
      if (url === "/ingestion/templates/hello_cdm")
        return Promise.resolve({ data: { data: MANIFEST } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 42 } } });

    render(<AqueductTemplatesPage />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Hello CDM/ }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^Run$/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.stringMatching(/subtab=runs&run=42/),
      ),
    );
  });
});
