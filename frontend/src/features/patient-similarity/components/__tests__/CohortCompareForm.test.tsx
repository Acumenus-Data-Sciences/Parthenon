import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { useSourceStore } from "@/stores/sourceStore";
import { CohortCompareForm } from "../CohortCompareForm";

vi.mock("@/features/cohort-definitions/hooks/useCohortDefinitions", () => ({
  useCohortDefinitions: () => ({
    data: {
      items: [
        { id: 11, name: "Alpha Cohort" },
        { id: 12, name: "Beta Cohort" },
        { id: 13, name: "Gamma Cohort" },
      ],
    },
    isLoading: false,
  }),
  useGenerateCohort: () => ({
    isPending: false,
    isSuccess: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("../../hooks/usePatientSimilarity", () => ({
  useCohortProfile: (cohortDefinitionId?: number) => ({
    data:
      cohortDefinitionId && cohortDefinitionId > 0
        ? {
            generated: true,
            member_count: 10,
            dimensions: {},
            dimensions_available: [],
          }
        : undefined,
    isLoading: false,
  }),
}));

function ControlledForm({ hasComparisonResult }: { hasComparisonResult: boolean }) {
  const [sourceId, setSourceId] = useState(1);

  return (
    <CohortCompareForm
      onCompare={vi.fn()}
      onCrossSearch={vi.fn()}
      isComparing={false}
      isSearching={false}
      hasComparisonResult={hasComparisonResult}
      sourceId={sourceId}
      onSourceChange={setSourceId}
    />
  );
}

describe("CohortCompareForm", () => {
  beforeEach(() => {
    useSourceStore.setState({
      activeSourceId: 1,
      defaultSourceId: 1,
      sources: [{ id: 1, source_name: "Synthetic OMOP" }],
    });
  });

  it("only shows cross-cohort search after comparing the current selection", () => {
    renderWithProviders(<ControlledForm hasComparisonResult />);
    const [, sourceCohortSelect, targetCohortSelect] = screen.getAllByRole("combobox");

    fireEvent.change(sourceCohortSelect, {
      target: { value: "11" },
    });
    fireEvent.change(targetCohortSelect, {
      target: { value: "12" },
    });

    expect(
      screen.queryByRole("button", { name: "Find Matching Patients" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Compare Profiles" }));

    expect(
      screen.getByRole("button", { name: "Find Matching Patients" }),
    ).toBeInTheDocument();

    fireEvent.change(targetCohortSelect, {
      target: { value: "13" },
    });

    expect(
      screen.queryByRole("button", { name: "Find Matching Patients" }),
    ).not.toBeInTheDocument();
  });
});
