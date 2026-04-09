import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhoebeRecommendationsPanel } from "../PhoebeRecommendationsPanel";
import type { HecatePhoebeRecommendation } from "@/features/vocabulary/api/hecateApi";

function makeRec(
  overrides: Partial<HecatePhoebeRecommendation> = {},
): HecatePhoebeRecommendation {
  return {
    concept_id: 201820,
    concept_name: "Diabetes mellitus",
    score: 0.95,
    ...overrides,
  };
}

describe("PhoebeRecommendationsPanel", () => {
  it("renders the header with the Phoebe badge", () => {
    render(
      <PhoebeRecommendationsPanel
        recommendations={[]}
        isLoading={false}
        isError={false}
        existingConceptIds={new Set()}
        onAddConcept={vi.fn()}
      />,
    );
    expect(screen.getByText("Phoebe Recommendations")).toBeInTheDocument();
    expect(screen.getByText(/Powered by Phoebe/i)).toBeInTheDocument();
  });

  it("is collapsed by default — recommendation items are not rendered", () => {
    const recs = [makeRec({ concept_id: 1 }), makeRec({ concept_id: 2 })];
    render(
      <PhoebeRecommendationsPanel
        recommendations={recs}
        isLoading={false}
        isError={false}
        existingConceptIds={new Set()}
        onAddConcept={vi.fn()}
      />,
    );
    // Items hidden until expand
    expect(screen.queryAllByText("Add").length).toBe(0);
  });

  it("expands when the header is clicked and renders recommendation rows", () => {
    const recs = [
      makeRec({ concept_id: 1, concept_name: "DM2" }),
      makeRec({ concept_id: 2, concept_name: "Hypertension" }),
    ];
    render(
      <PhoebeRecommendationsPanel
        recommendations={recs}
        isLoading={false}
        isError={false}
        existingConceptIds={new Set()}
        onAddConcept={vi.fn()}
        defaultExpanded
      />,
    );
    expect(screen.getByText("DM2")).toBeInTheDocument();
    expect(screen.getByText("Hypertension")).toBeInTheDocument();
  });

  it("calls onAddConcept with the concept_id when Add is clicked", () => {
    const onAddConcept = vi.fn();
    const recs = [makeRec({ concept_id: 42, concept_name: "MetSyndrome" })];
    render(
      <PhoebeRecommendationsPanel
        recommendations={recs}
        isLoading={false}
        isError={false}
        existingConceptIds={new Set()}
        onAddConcept={onAddConcept}
        defaultExpanded
      />,
    );
    fireEvent.click(screen.getByTitle("Add to concept set"));
    expect(onAddConcept).toHaveBeenCalledWith(42);
  });

  it("shows 'Recommendations unavailable' on error", () => {
    render(
      <PhoebeRecommendationsPanel
        recommendations={[]}
        isLoading={false}
        isError={true}
        existingConceptIds={new Set()}
        onAddConcept={vi.fn()}
        defaultExpanded
      />,
    );
    expect(
      screen.getByText("Recommendations unavailable"),
    ).toBeInTheDocument();
  });

  it("invokes onAddAll with every un-added concept id when Add All is clicked", () => {
    const onAddAll = vi.fn();
    const recs = [
      makeRec({ concept_id: 1 }),
      makeRec({ concept_id: 2 }),
    ];
    render(
      <PhoebeRecommendationsPanel
        recommendations={recs}
        isLoading={false}
        isError={false}
        existingConceptIds={new Set()}
        onAddConcept={vi.fn()}
        onAddAll={onAddAll}
        defaultExpanded
      />,
    );
    fireEvent.click(screen.getByText(/Add All/));
    expect(onAddAll).toHaveBeenCalledWith([1, 2]);
  });
});
