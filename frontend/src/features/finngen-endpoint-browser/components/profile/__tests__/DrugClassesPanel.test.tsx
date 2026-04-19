// Phase 18 (Plan 18-06) — DrugClassesPanel real assertions (GREEN flip).
// Covers D-14 (90d pre-index ATC3 timeline) per UI-SPEC §DrugClassesPanel copy.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrugClassesPanel } from "../DrugClassesPanel";
import type { EndpointProfileDrugClass } from "../../../api";

const FIXTURE: EndpointProfileDrugClass[] = [
  {
    atc3_code: "C09",
    atc3_name: "C09: agents acting on the RAAS",
    subjects_on_drug: 384,
    subjects_total: 1000,
    pct_on_drug: 38.4,
    rank: 1,
  },
  {
    atc3_code: "B01",
    atc3_name: "B01: antithrombotic agents",
    subjects_on_drug: 220,
    subjects_total: 1000,
    pct_on_drug: 22.0,
    rank: 2,
  },
];

describe("DrugClassesPanel", () => {
  it("renders the panel heading and denominator clarifier", () => {
    render(
      <DrugClassesPanel drugClasses={FIXTURE} sourceHasDrugData={true} />,
    );
    expect(screen.getByText("Drug classes (90d pre-index)")).toBeTruthy();
    expect(
      screen.getByText(
        "Subjects with no drug records in the 90d window are excluded from the denominator.",
      ),
    ).toBeTruthy();
  });

  it("renders the horizontal Recharts BarChart wrapper when drugClasses is non-empty", () => {
    const { container } = render(
      <DrugClassesPanel drugClasses={FIXTURE} sourceHasDrugData={true} />,
    );
    // Recharts ResponsiveContainer renders a div with class
    // 'recharts-responsive-container'. It carries width 100% and the
    // computed height = drugClasses.length * 32 + 40.
    const responsive = container.querySelector(
      ".recharts-responsive-container",
    );
    expect(responsive).toBeTruthy();
  });

  it("renders empty-state copy when drugClasses=[] and sourceHasDrugData=true", () => {
    render(<DrugClassesPanel drugClasses={[]} sourceHasDrugData={true} />);
    expect(
      screen.getByText(
        "No drug records in the 90-day pre-index window for this endpoint × source.",
      ),
    ).toBeTruthy();
  });

  it("renders empty-state copy when sourceHasDrugData=false", () => {
    render(<DrugClassesPanel drugClasses={[]} sourceHasDrugData={false} />);
    expect(
      screen.getByText(
        "This source has no drug-exposure data. Drug timeline cannot be rendered.",
      ),
    ).toBeTruthy();
  });
});
