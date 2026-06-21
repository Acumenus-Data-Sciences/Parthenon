import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";

import FhirExportPage from "../pages/FhirExportPage";

let mock: MockAdapter;

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

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

describe("FhirExportPage", () => {
  it("renders the export form with sources and resource types", async () => {
    mock.onGet("/api/v1/sources").reply(200, [{ id: 1, source_name: "Test CDM" }]);

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <FhirExportPage />
      </Wrapper>,
    );

    expect(screen.getByText("Data source")).toBeInTheDocument();
    expect(screen.getByText("Resource types")).toBeInTheDocument();
    expect(screen.getByText("Patient")).toBeInTheDocument();
    expect(screen.getByText("AllergyIntolerance")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Test CDM")).toBeInTheDocument(),
    );
  });

  it("starts an export and lists completed files for download", async () => {
    mock.onGet("/api/v1/sources").reply(200, [{ id: 1, source_name: "Test CDM" }]);
    mock.onPost("/api/v1/fhir/$export").reply(202, { id: "job-1", status: "pending" });
    mock.onGet("/api/v1/fhir/$export/job-1").reply(200, {
      id: "job-1",
      status: "completed",
      resource_types: ["Patient"],
      files: [{ resource_type: "Patient", url: "/x", count: 3 }],
      started_at: null,
      finished_at: null,
      error_message: null,
    });

    const client = makeClient();
    render(
      <Wrapper client={client}>
        <FhirExportPage />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText("Test CDM")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("Start export"));

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    expect(JSON.parse(mock.history.post[0].data as string).source_id).toBe(1);

    await waitFor(() => expect(screen.getByText("Files")).toBeInTheDocument());
    expect(screen.getByText("Patient (3)")).toBeInTheDocument();
  });
});
