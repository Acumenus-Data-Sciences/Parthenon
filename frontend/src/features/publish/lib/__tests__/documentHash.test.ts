import { describe, it, expect } from "vitest";
import { documentHash } from "../documentHash";

describe("documentHash", () => {
  it("returns the same hash for the same object", () => {
    expect(documentHash({ a: 1, b: [1, 2] })).toBe(documentHash({ a: 1, b: [1, 2] }));
  });
  it("returns different hashes for different objects", () => {
    expect(documentHash({ a: 1 })).not.toBe(documentHash({ a: 2 }));
  });
  it("is stable across key order", () => {
    expect(documentHash({ a: 1, b: 2 })).toBe(documentHash({ b: 2, a: 1 }));
  });
});
