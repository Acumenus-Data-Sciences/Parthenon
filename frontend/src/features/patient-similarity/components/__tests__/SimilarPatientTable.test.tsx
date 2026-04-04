import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { SimilarPatientTable } from "../SimilarPatientTable";

describe("SimilarPatientTable", () => {
  it("renders safely when scores and shared feature categories are partial", () => {
    renderWithProviders(
      <SimilarPatientTable
        showPersonId
        seedPersonId={101}
        sourceId={7}
        patients={[
          {
            person_id: 202,
            overall_score: Number.NaN,
            dimension_scores: {
              demographics: undefined,
              conditions: 0.71,
              measurements: null,
              drugs: undefined,
              procedures: 0.42,
              genomics: undefined,
            },
            shared_features: {
              conditions: {
                shared_count: 1,
                seed_count: 2,
                candidate_count: 3,
                top_shared: [{ concept_id: 10, name: "Diabetes" }],
              },
            } as never,
            similarity_summary: "Shared clinical profile.",
          },
        ]}
      />,
    );

    expect(screen.getAllByText("N/A").length).toBeGreaterThan(1);
    expect(screen.getByText("0.71")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute(
      "href",
      "/patient-similarity/compare?person_a=101&person_b=202&source_id=7",
    );

    fireEvent.click(screen.getByText("ID: 202"));

    expect(screen.getByText("Shared clinical profile.")).toBeInTheDocument();
    expect(screen.getByText("Diabetes")).toBeInTheDocument();
  });
});
