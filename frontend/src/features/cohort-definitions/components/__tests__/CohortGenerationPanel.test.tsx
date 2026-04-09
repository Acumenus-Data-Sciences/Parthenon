import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { CohortGenerationPanel } from "../CohortGenerationPanel";
import {
  useGenerateCohort,
} from "../../hooks/useCohortDefinitions";
import { useCohortGeneration } from "../../hooks/useCohortGeneration";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";

vi.mock("../../hooks/useCohortDefinitions", () => ({
  useGenerateCohort: vi.fn(),
}));

vi.mock("../../hooks/useCohortGeneration", () => ({
  useCohortGeneration: vi.fn(),
}));

vi.mock("@/features/data-sources/api/sourcesApi", () => ({
  fetchSources: vi.fn(),
}));

const mockUseGenerateCohort = useGenerateCohort as unknown as Mock;
const mockUseCohortGeneration = useCohortGeneration as unknown as Mock;
const mockFetchSources = fetchSources as unknown as Mock;

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("CohortGenerationPanel", () => {
  beforeEach(() => {
    mockUseGenerateCohort.mockReset();
    mockUseCohortGeneration.mockReset();
    mockFetchSources.mockReset();
    mockFetchSources.mockResolvedValue([
      { id: 1, source_name: "Acumenus CDM" },
    ]);
    mockUseGenerateCohort.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    });
    mockUseCohortGeneration.mockReturnValue({ data: undefined });
  });

  it("renders the Generate Cohort header", () => {
    wrap(<CohortGenerationPanel definitionId={1} />);
    expect(screen.getByText("Generate Cohort")).toBeInTheDocument();
  });

  it("disables the Generate button when no source is selected", () => {
    wrap(<CohortGenerationPanel definitionId={1} />);
    const generateBtn = screen.getByRole("button", { name: /Generate/i });
    expect(generateBtn).toBeDisabled();
  });

  it("shows the 'Generation complete' state when a completed gen is active", () => {
    mockUseCohortGeneration.mockReturnValue({
      data: {
        id: 10,
        status: "completed",
        person_count: 1234,
        fail_message: null,
      },
    });
    wrap(<CohortGenerationPanel definitionId={1} />);
    expect(screen.getByText("Generation complete")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("shows an error state when generation fails with a message", () => {
    mockUseCohortGeneration.mockReturnValue({
      data: {
        id: 10,
        status: "failed",
        person_count: null,
        fail_message: "SQL execution error",
      },
    });
    wrap(<CohortGenerationPanel definitionId={1} />);
    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(screen.getByText("SQL execution error")).toBeInTheDocument();
  });
});
