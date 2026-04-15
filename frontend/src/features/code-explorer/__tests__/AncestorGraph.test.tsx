import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AncestorGraph } from "../components/AncestorGraph";

describe("AncestorGraph", () => {
  // skip: ReactFlow requires ResizeObserver which jsdom does not provide; covered by Playwright E2E.
  it.skip("renders ReactFlow with the expected node count", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <AncestorGraph
        rootConceptId={201826}
        nodes={[
          { concept_id: 201826, concept_name: "Type 2 diabetes" },
          { concept_id: 1, concept_name: "Disease parent" },
        ]}
        edges={[{ src: 1, dst: 201826, depth: 1 }]}
        onConceptSelect={onSelect}
      />,
    );
    expect(container.querySelector(".react-flow")).toBeInTheDocument();
  });
});
