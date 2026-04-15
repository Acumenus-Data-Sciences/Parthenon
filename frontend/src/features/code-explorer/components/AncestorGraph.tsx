import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge as RfEdge,
  type Node as RfNode,
} from "reactflow";
import "reactflow/dist/style.css";

import type { AncestorEdge, AncestorNode } from "../types";

export function AncestorGraph({
  rootConceptId,
  nodes,
  edges,
  onConceptSelect,
}: {
  rootConceptId: number;
  nodes: AncestorNode[];
  edges: AncestorEdge[];
  onConceptSelect: (conceptId: number) => void;
}) {
  const { rfNodes, rfEdges } = useMemo(() => {
    const ancestorIds = new Set(edges.filter((e) => e.dst === rootConceptId).map((e) => e.src));
    const descendantIds = new Set(edges.filter((e) => e.src === rootConceptId).map((e) => e.dst));

    const byLayer: Record<"ancestor" | "root" | "descendant", AncestorNode[]> = {
      ancestor: [],
      root: [],
      descendant: [],
    };
    for (const n of nodes) {
      if (n.concept_id === rootConceptId) byLayer.root.push(n);
      else if (ancestorIds.has(n.concept_id)) byLayer.ancestor.push(n);
      else if (descendantIds.has(n.concept_id)) byLayer.descendant.push(n);
      else byLayer.descendant.push(n);
    }

    const spacingX = 220;
    const layerY: Record<"ancestor" | "root" | "descendant", number> = {
      ancestor: 0,
      root: 180,
      descendant: 360,
    };

    const rfNodes: RfNode[] = [];
    for (const layer of ["ancestor", "root", "descendant"] as const) {
      const items = byLayer[layer];
      items.forEach((n, i) => {
        const x = (i - (items.length - 1) / 2) * spacingX;
        rfNodes.push({
          id: String(n.concept_id),
          position: { x, y: layerY[layer] },
          data: { label: n.concept_name },
          style: {
            padding: 8,
            borderRadius: 6,
            border:
              layer === "root"
                ? "2px solid #C9A227"
                : "1px solid #475569",
            background: layer === "root" ? "#1f2937" : "#0f172a",
            color: "#e2e8f0",
            fontSize: 12,
            maxWidth: 200,
          },
        });
      });
    }

    const rfEdges: RfEdge[] = edges.map((e, i) => ({
      id: `e-${i}-${e.src}-${e.dst}`,
      source: String(e.src),
      target: String(e.dst),
      animated: false,
      style: { stroke: "#64748b" },
    }));

    return { rfNodes, rfEdges };
  }, [nodes, edges, rootConceptId]);

  return (
    <div style={{ width: "100%", height: 600 }} className="rounded border border-slate-700">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        onNodeClick={(_evt, node) => {
          const id = Number.parseInt(node.id, 10);
          if (!Number.isNaN(id) && id !== rootConceptId) {
            onConceptSelect(id);
          }
        }}
      >
        <Background color="#334155" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
