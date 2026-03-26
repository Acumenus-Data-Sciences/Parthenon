import dagre from "@dagrejs/dagre";

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  group: "source" | "cdm" | "stem";
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

/**
 * Compute node positions using dagre for a left-to-right layout.
 * Source nodes on the left, CDM nodes on the right.
 */
export function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): PositionedNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    nodesep: 20,
    ranksep: 250,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }

  // Add edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Force source nodes to rank 0, CDM nodes to rank 1
  // dagre handles this via the edges, but we add invisible edges
  // for unconnected nodes to maintain column alignment
  const sourceNodes = nodes.filter((n) => n.group === "source");
  const cdmNodes = nodes.filter((n) => n.group === "cdm");

  // If there are unconnected source or CDM nodes, add invisible alignment
  if (sourceNodes.length > 0 && cdmNodes.length > 0) {
    const firstSource = sourceNodes[0].id;
    const firstCdm = cdmNodes[0].id;
    // Ensure at least one edge exists for column separation
    if (!edges.some((e) => e.source === firstSource && e.target === firstCdm)) {
      g.setEdge(firstSource, firstCdm, { weight: 0, minlen: 1 });
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      x: (pos.x ?? 0) - node.width / 2,
      y: (pos.y ?? 0) - node.height / 2,
    };
  });
}
