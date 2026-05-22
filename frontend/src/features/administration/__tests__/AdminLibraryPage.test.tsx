import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";

import AdminLibraryPage from "../pages/AdminLibraryPage";

let mock: MockAdapter;

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

function Wrapper({
  client,
  children,
}: PropsWithChildren<{ client: QueryClient }>) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const sampleRow = {
  item_type: "concept_set" as const,
  id: 7,
  name: "Sample Concept Set",
  description: "demo",
  status: "active" as const,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-12T00:00:00Z",
  archived_at: null,
  deleted_at: null,
  owner: { id: 3, name: "Owner", email: "owner@example.test" },
};

describe("AdminLibraryPage", () => {
  it("renders rows from the union endpoint", async () => {
    mock.onGet("/api/v1/admin/library").reply(200, {
      data: [sampleRow],
      count: 1,
      limit: 500,
      types: ["concept_set"],
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AdminLibraryPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText("Sample Concept Set")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Select concept_set 7")).toBeInTheDocument();
  });

  it("opens the HardDeleteModal when a row is selected and Delete is clicked", async () => {
    mock.onGet("/api/v1/admin/library").reply(200, {
      data: [sampleRow],
      count: 1,
      limit: 500,
      types: ["concept_set"],
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AdminLibraryPage />
      </Wrapper>,
    );

    await screen.findByText("Sample Concept Set");
    fireEvent.click(screen.getByLabelText("Select concept_set 7"));
    fireEvent.click(screen.getByRole("button", { name: /Delete \(1\)/ }));

    await screen.findByRole("dialog");
    expect(screen.getByText(/Delete 1 library item/i)).toBeInTheDocument();
  });

  it("switches to the trash tab and requests include_trash", async () => {
    mock.onGet("/api/v1/admin/library").reply((config) => {
      const includeTrash = String(config.params?.include_trash ?? "");
      if (includeTrash === "1") {
        return [
          200,
          {
            data: [
              {
                ...sampleRow,
                id: 99,
                status: "archived",
                deleted_at: "2026-05-10T00:00:00Z",
              },
            ],
            count: 1,
            limit: 500,
            types: ["concept_set"],
          },
        ];
      }
      return [
        200,
        { data: [sampleRow], count: 1, limit: 500, types: ["concept_set"] },
      ];
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AdminLibraryPage />
      </Wrapper>,
    );

    await screen.findByText("Sample Concept Set");
    fireEvent.click(screen.getByRole("button", { name: "Trash" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Select concept_set 99")).toBeInTheDocument(),
    );
    // Trash tab adds Restore / Purge actions
    expect(
      screen.getByRole("button", { name: /Restore/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Purge/i })).toBeInTheDocument();
  });
});
