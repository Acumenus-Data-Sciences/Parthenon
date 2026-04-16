// frontend/src/features/finngen-workbench/lib/operationTree.ts
//
// SP4 Phase B — pure operation-tree algebra. The frontend OperationBuilder
// component renders this tree; the backend CohortOperationCompiler accepts
// the same shape and emits the upstream HadesExtras operation string.
//
// Invariants enforced by validate():
//   - Op nodes need ≥ 2 children
//   - MINUS nodes need exactly 2 children (binary)
//   - Cohort nodes carry a positive cohort_id
//   - Every node has a stable string id (UUID v4)
//
// All mutators return a NEW tree — never mutate in place.

export type OpKind = "UNION" | "INTERSECT" | "MINUS";

export type CohortNode = {
  kind: "cohort";
  id: string;
  cohort_id: number;
};

export type OpNode = {
  kind: "op";
  id: string;
  op: OpKind;
  children: OperationNode[];
};

export type OperationNode = CohortNode | OpNode;

export type ValidationError = {
  node_id: string;
  code:
    | "OP_NEEDS_AT_LEAST_TWO_CHILDREN"
    | "MINUS_REQUIRES_EXACTLY_TWO_CHILDREN"
    | "COHORT_NODE_MISSING_ID"
    | "DUPLICATE_NODE_ID";
  message: string;
};

// ── ID factory ─────────────────────────────────────────────────────────────

export function newNodeId(): string {
  // crypto.randomUUID is available in modern browsers and Node 19+. The Vite
  // dev/test environment uses jsdom which polyfills it via Node's crypto.
  return crypto.randomUUID();
}

// ── Node constructors ──────────────────────────────────────────────────────

export function makeCohort(cohortId: number): CohortNode {
  return { kind: "cohort", id: newNodeId(), cohort_id: cohortId };
}

export function makeOp(op: OpKind, children: OperationNode[] = []): OpNode {
  return { kind: "op", id: newNodeId(), op, children };
}

// ── Path utilities ─────────────────────────────────────────────────────────
//
// A path is an array of indices walking from the root to a node:
//   [] = root, [0] = root.children[0], [0, 1] = root.children[0].children[1].

export type Path = number[];

export function getNodeAt(root: OperationNode, path: Path): OperationNode | null {
  let cur: OperationNode | null = root;
  for (const idx of path) {
    if (cur === null || cur.kind !== "op") return null;
    cur = cur.children[idx] ?? null;
  }
  return cur;
}

export function findPathById(root: OperationNode, id: string): Path | null {
  if (root.id === id) return [];
  if (root.kind !== "op") return null;
  for (let i = 0; i < root.children.length; i++) {
    const sub = findPathById(root.children[i], id);
    if (sub !== null) return [i, ...sub];
  }
  return null;
}

// ── Immutable mutators ─────────────────────────────────────────────────────

function mapAt(root: OperationNode, path: Path, fn: (n: OpNode) => OpNode): OperationNode {
  if (path.length === 0) {
    if (root.kind !== "op") return root;
    return fn(root);
  }
  if (root.kind !== "op") return root;
  const [head, ...rest] = path;
  return {
    ...root,
    children: root.children.map((c, i) => (i === head ? mapAt(c, rest, fn) : c)),
  };
}

export function appendChild(
  root: OperationNode,
  parentPath: Path,
  child: OperationNode,
): OperationNode {
  return mapAt(root, parentPath, (parent) => ({
    ...parent,
    children: [...parent.children, child],
  }));
}

export function insertChild(
  root: OperationNode,
  parentPath: Path,
  index: number,
  child: OperationNode,
): OperationNode {
  return mapAt(root, parentPath, (parent) => {
    const next = [...parent.children];
    const safeIndex = Math.max(0, Math.min(index, next.length));
    next.splice(safeIndex, 0, child);
    return { ...parent, children: next };
  });
}

export function removeNode(root: OperationNode, id: string): OperationNode {
  if (root.kind !== "op") return root;
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== id)
      .map((c) => removeNode(c, id)),
  };
}

export function moveNode(
  root: OperationNode,
  nodeId: string,
  toParentId: string,
  toIndex: number,
): OperationNode {
  if (nodeId === toParentId) return root; // no-op: can't move into self
  const path = findPathById(root, nodeId);
  if (path === null) return root;
  const node = getNodeAt(root, path);
  if (node === null) return root;
  // Disallow moving an ancestor under its own descendant (would form a cycle).
  if (node.kind === "op" && findPathById(node, toParentId) !== null) return root;

  const without = removeNode(root, nodeId);
  const targetPath = findPathById(without, toParentId);
  if (targetPath === null) return root;
  return insertChild(without, targetPath, toIndex, node);
}

export function setOpKind(root: OperationNode, opNodeId: string, op: OpKind): OperationNode {
  const path = findPathById(root, opNodeId);
  if (path === null) return root;
  return mapAt(root, path, (parent) => ({ ...parent, op }));
}

// ── Validation ─────────────────────────────────────────────────────────────

export function validate(root: OperationNode | null): ValidationError[] {
  const errors: ValidationError[] = [];
  if (root === null) return errors;
  const seen = new Set<string>();

  const walk = (node: OperationNode): void => {
    if (seen.has(node.id)) {
      errors.push({
        node_id: node.id,
        code: "DUPLICATE_NODE_ID",
        message: `Node id ${node.id} appears more than once`,
      });
    }
    seen.add(node.id);

    if (node.kind === "cohort") {
      if (!Number.isInteger(node.cohort_id) || node.cohort_id <= 0) {
        errors.push({
          node_id: node.id,
          code: "COHORT_NODE_MISSING_ID",
          message: `Cohort node missing or invalid cohort_id`,
        });
      }
      return;
    }
    if (node.children.length < 2) {
      errors.push({
        node_id: node.id,
        code: "OP_NEEDS_AT_LEAST_TWO_CHILDREN",
        message: `${node.op} requires at least 2 children, has ${node.children.length}`,
      });
    }
    if (node.op === "MINUS" && node.children.length !== 2) {
      errors.push({
        node_id: node.id,
        code: "MINUS_REQUIRES_EXACTLY_TWO_CHILDREN",
        message: `MINUS requires exactly 2 children, has ${node.children.length}`,
      });
    }
    for (const c of node.children) walk(c);
  };
  walk(root);
  return errors;
}

// ── Compilation (frontend preview only — backend re-compiles defensively) ──

/**
 * Render the tree as the upstream HadesExtras operation string, e.g.
 *   `(1 UNION 2) MINUS 3`
 *
 * Throws when the tree fails validation. Callers that want to display partial
 * trees should call validate() first and skip compilation when there are
 * errors.
 */
export function compile(root: OperationNode | null): string {
  if (root === null) return "";
  const errors = validate(root);
  if (errors.length > 0) {
    throw new Error(`Cannot compile invalid tree: ${errors.map((e) => e.code).join(", ")}`);
  }
  const render = (node: OperationNode): string => {
    if (node.kind === "cohort") return String(node.cohort_id);
    const parts = node.children.map(render);
    return `(${parts.join(` ${node.op} `)})`;
  };
  // Strip the outermost parens for readability when the root itself is an op.
  const out = render(root);
  if (root.kind === "op" && out.startsWith("(") && out.endsWith(")")) {
    return out.slice(1, -1);
  }
  return out;
}

// ── Misc helpers ───────────────────────────────────────────────────────────

export function nodeCount(root: OperationNode | null): number {
  if (root === null) return 0;
  if (root.kind === "cohort") return 1;
  return 1 + root.children.reduce((acc, c) => acc + nodeCount(c), 0);
}

export function listCohortIds(root: OperationNode | null): number[] {
  if (root === null) return [];
  if (root.kind === "cohort") return [root.cohort_id];
  return root.children.flatMap(listCohortIds);
}
