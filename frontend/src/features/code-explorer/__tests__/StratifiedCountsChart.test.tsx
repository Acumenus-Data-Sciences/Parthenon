import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StratifiedCountsChart } from "../components/StratifiedCountsChart";
import type { StratifiedCount } from "../types";

const sample: StratifiedCount[] = [
  { year: 2020, gender_concept_id: 8507, age_decile: 5, n_node: 10, n_descendant: 15 },
  { year: 2020, gender_concept_id: 8532, age_decile: 5, n_node: 12, n_descendant: 20 },
  { year: 2021, gender_concept_id: 8507, age_decile: 6, n_node: 14, n_descendant: 18 },
];

describe("StratifiedCountsChart", () => {
  // skip: Recharts ResponsiveContainer renders zero-size under jsdom (no layout); covered by Playwright E2E.
  it.skip("renders without crash on non-empty data", () => {
    const { container } = render(
      <StratifiedCountsChart data={sample} mode="node" groupBy="gender" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders empty-state message on empty array", () => {
    render(<StratifiedCountsChart data={[]} mode="node" groupBy="gender" />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});
