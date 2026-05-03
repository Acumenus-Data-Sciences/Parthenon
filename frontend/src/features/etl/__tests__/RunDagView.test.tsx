import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunDagView } from "../components/aqueduct/templates/RunDagView";
import type { TemplateNode } from "../types/templates";

const NODES: TemplateNode[] = [
  { id: "fetch", kind: "generic_file", inputs: [], outputs: ["raw"] },
  { id: "load", kind: "db_writer", inputs: ["raw"], outputs: ["loaded"] },
  { id: "summarize", kind: "sql_node", inputs: ["loaded"], outputs: [] },
];

describe("RunDagView", () => {
  it("renders one circle per node with the node id label", () => {
    render(<RunDagView nodes={NODES} currentNode="load" status="running" />);
    expect(screen.getByText("fetch")).toBeInTheDocument();
    expect(screen.getByText("load")).toBeInTheDocument();
    expect(screen.getByText("summarize")).toBeInTheDocument();
  });

  it("marks nodes before currentNode as completed (success styling)", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode="load" status="running" />,
    );
    const completed = container.querySelector(
      '[data-state="completed"][data-node="fetch"]',
    );
    expect(completed).not.toBeNull();
  });

  it("marks the current node as active when running", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode="load" status="running" />,
    );
    expect(
      container.querySelector('[data-state="active"][data-node="load"]'),
    ).not.toBeNull();
  });

  it("marks the current node as failed when status=failed", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode="load" status="failed" />,
    );
    expect(
      container.querySelector('[data-state="failed"][data-node="load"]'),
    ).not.toBeNull();
  });

  it("marks all nodes completed when status=completed and no currentNode", () => {
    const { container } = render(
      <RunDagView nodes={NODES} currentNode={null} status="completed" />,
    );
    for (const n of NODES) {
      expect(
        container.querySelector(
          `[data-state="completed"][data-node="${n.id}"]`,
        ),
      ).not.toBeNull();
    }
  });
});
