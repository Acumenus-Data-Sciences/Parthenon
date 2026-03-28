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

// ---------------------------------------------------------------------------
// Column-based layout: source nodes pinned left, CDM nodes pinned right,
// stem nodes centered between connected pairs.
// ---------------------------------------------------------------------------

const MARGIN_X = 30;
const MARGIN_Y = 40;
const ROW_GAP = 16;
const COLUMN_GAP = 600; // horizontal space between source and CDM columns

/**
 * Compute node positions using explicit two-column layout.
 * Source nodes on the left, CDM nodes on the right, stem nodes in between.
 * This replaces the Dagre-based layout which failed to separate unconnected
 * nodes into distinct columns.
 */
export function computeLayout(
  nodes: LayoutNode[],
  _edges: LayoutEdge[],
): PositionedNode[] {
  const sourceNodes = nodes.filter((n) => n.group === "source");
  const cdmNodes = nodes.filter((n) => n.group === "cdm");
  const stemNodes = nodes.filter((n) => n.group === "stem");

  const results: PositionedNode[] = [];

  // Source column: pinned to the left
  const sourceX = MARGIN_X;
  let sourceY = MARGIN_Y;
  for (const node of sourceNodes) {
    results.push({ id: node.id, x: sourceX, y: sourceY });
    sourceY += node.height + ROW_GAP;
  }

  // CDM column: pinned to the right
  const maxSourceWidth = sourceNodes.length > 0
    ? Math.max(...sourceNodes.map((n) => n.width))
    : 200;
  const cdmX = sourceX + maxSourceWidth + COLUMN_GAP;
  let cdmY = MARGIN_Y;
  for (const node of cdmNodes) {
    results.push({ id: node.id, x: cdmX, y: cdmY });
    cdmY += node.height + ROW_GAP;
  }

  // Stem column: centered between source and CDM
  if (stemNodes.length > 0) {
    const stemX = sourceX + maxSourceWidth + COLUMN_GAP / 2 - (stemNodes[0]?.width ?? 200) / 2;
    let stemY = MARGIN_Y;
    for (const node of stemNodes) {
      results.push({ id: node.id, x: stemX, y: stemY });
      stemY += node.height + ROW_GAP;
    }
  }

  return results;
}
