import { describe, expect, it } from "vitest";
import { makeIdempotencyKey } from "../utils/idempotencyKey";

describe("makeIdempotencyKey", () => {
  it("returns a string that looks like a v4 UUID", () => {
    const key = makeIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("returns distinct values on successive calls", () => {
    const a = makeIdempotencyKey();
    const b = makeIdempotencyKey();
    expect(a).not.toBe(b);
  });
});
