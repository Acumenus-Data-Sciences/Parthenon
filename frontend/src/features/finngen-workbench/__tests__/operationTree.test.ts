import { describe, it, expect } from "vitest";
import {
  appendChild,
  compile,
  findPathById,
  insertChild,
  listCohortIds,
  makeCohort,
  makeOp,
  moveNode,
  newNodeId,
  nodeCount,
  removeNode,
  setOpKind,
  validate,
} from "../lib/operationTree";

describe("operationTree", () => {
  describe("newNodeId", () => {
    it("returns a UUID v4 string", () => {
      const id = newNodeId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(newNodeId()).not.toBe(id);
    });
  });

  describe("compile", () => {
    it("renders a single cohort as its id", () => {
      expect(compile(makeCohort(42))).toBe("42");
    });

    it("renders a binary UNION", () => {
      const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
      expect(compile(tree)).toBe("1 UNION 2");
    });

    it("renders an n-ary UNION", () => {
      const tree = makeOp("UNION", [makeCohort(1), makeCohort(2), makeCohort(3)]);
      expect(compile(tree)).toBe("1 UNION 2 UNION 3");
    });

    it("renders nested ops with parens", () => {
      const tree = makeOp("MINUS", [
        makeOp("UNION", [makeCohort(1), makeCohort(2)]),
        makeCohort(3),
      ]);
      expect(compile(tree)).toBe("(1 UNION 2) MINUS 3");
    });

    it("returns empty string for null tree", () => {
      expect(compile(null)).toBe("");
    });

    it("throws on invalid tree", () => {
      const bad = makeOp("UNION", [makeCohort(1)]); // only 1 child
      expect(() => compile(bad)).toThrow(/invalid/i);
    });
  });

  describe("validate", () => {
    it("accepts a well-formed tree", () => {
      const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
      expect(validate(tree)).toEqual([]);
    });

    it("flags op with <2 children", () => {
      const tree = makeOp("UNION", [makeCohort(1)]);
      const errs = validate(tree);
      expect(errs).toHaveLength(1);
      expect(errs[0].code).toBe("OP_NEEDS_AT_LEAST_TWO_CHILDREN");
    });

    it("flags MINUS with > 2 children", () => {
      const tree = makeOp("MINUS", [makeCohort(1), makeCohort(2), makeCohort(3)]);
      const errs = validate(tree);
      expect(errs.some((e) => e.code === "MINUS_REQUIRES_EXACTLY_TWO_CHILDREN")).toBe(true);
    });

    it("flags cohort with invalid id", () => {
      const tree: ReturnType<typeof makeCohort> = { ...makeCohort(1), cohort_id: 0 };
      const errs = validate(tree);
      expect(errs[0].code).toBe("COHORT_NODE_MISSING_ID");
    });

    it("flags duplicate node ids", () => {
      const c = makeCohort(1);
      const tree = makeOp("UNION", [c, c]);
      const errs = validate(tree);
      expect(errs.some((e) => e.code === "DUPLICATE_NODE_ID")).toBe(true);
    });
  });

  describe("mutators", () => {
    it("appendChild adds to root", () => {
      let tree = makeOp("UNION", [makeCohort(1)]);
      tree = appendChild(tree, [], makeCohort(2)) as typeof tree;
      expect(nodeCount(tree)).toBe(3);
      expect(compile(tree)).toBe("1 UNION 2");
    });

    it("insertChild respects index", () => {
      let tree = makeOp("UNION", [makeCohort(1), makeCohort(3)]);
      tree = insertChild(tree, [], 1, makeCohort(2)) as typeof tree;
      expect(compile(tree)).toBe("1 UNION 2 UNION 3");
    });

    it("removeNode strips by id and is recursive", () => {
      const c2 = makeCohort(2);
      const inner = makeOp("UNION", [makeCohort(1), c2]);
      const tree = makeOp("MINUS", [inner, makeCohort(3)]);
      const stripped = removeNode(tree, c2.id) as typeof tree;
      expect(listCohortIds(stripped)).toEqual([1, 3]);
    });

    it("moveNode reparents", () => {
      const c1 = makeCohort(1);
      const innerLeft = makeOp("UNION", [c1, makeCohort(2)]);
      const innerRight = makeOp("UNION", [makeCohort(3), makeCohort(4)]);
      const tree = makeOp("MINUS", [innerLeft, innerRight]);
      const moved = moveNode(tree, c1.id, innerRight.id, 0);
      const path = findPathById(moved, c1.id);
      // Now under innerRight (root.children[1])
      expect(path?.[0]).toBe(1);
    });

    it("moveNode refuses cycles (parent into descendant)", () => {
      const inner = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
      const tree = makeOp("MINUS", [inner, makeCohort(3)]);
      // Try to move root into inner — should be a no-op.
      const moved = moveNode(tree, tree.id, inner.id, 0);
      expect(moved).toBe(tree); // unchanged reference (no-op early return)
    });

    it("setOpKind switches op type", () => {
      const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
      const flipped = setOpKind(tree, tree.id, "INTERSECT") as typeof tree;
      expect(compile(flipped)).toBe("1 INTERSECT 2");
    });
  });

  describe("listCohortIds", () => {
    it("returns flat list across nested ops", () => {
      const tree = makeOp("MINUS", [
        makeOp("UNION", [makeCohort(1), makeCohort(2)]),
        makeOp("INTERSECT", [makeCohort(3), makeCohort(4)]),
      ]);
      expect(listCohortIds(tree).sort()).toEqual([1, 2, 3, 4]);
    });
  });
});
