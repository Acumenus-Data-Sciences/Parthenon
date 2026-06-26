import { describe, it, expect } from "vitest";
import { normalizeAbbyRouting, abbyRouteBadgeKind } from "../services/abbyService";

describe("normalizeAbbyRouting", () => {
  it("returns undefined for legacy responses with no routing", () => {
    expect(normalizeAbbyRouting(undefined)).toBeUndefined();
    expect(normalizeAbbyRouting(null)).toBeUndefined();
    expect(normalizeAbbyRouting({})).toBeUndefined();
  });

  it("normalizes a full routing payload", () => {
    const routing = normalizeAbbyRouting({
      model: "claude",
      provider: "anthropic",
      transport: "anthropic_messages",
      model_name: "claude-sonnet-4-6",
      reason: "cloud_first",
      stage: 0,
      fallback_used: false,
      cloud_safety_applied: true,
      cloud_safety_blocked: false,
      // extra/secret-ish fields must be ignored
      request_hash: "deadbeef",
    });
    expect(routing).toMatchObject({
      model: "claude",
      provider: "anthropic",
      transport: "anthropic_messages",
      model_name: "claude-sonnet-4-6",
      reason: "cloud_first",
      fallback_used: false,
      cloud_safety_applied: true,
    });
    // No secret leakage into the normalized shape.
    expect(JSON.stringify(routing)).not.toContain("deadbeef");
  });
});

describe("abbyRouteBadgeKind", () => {
  it("classifies local routing", () => {
    expect(abbyRouteBadgeKind({ model: "local", provider: "ollama", transport: "ollama_chat", reason: "local_ollama_required", fallback_used: false })).toBe("local");
  });
  it("classifies cloud routing", () => {
    expect(abbyRouteBadgeKind({ model: "claude", provider: "anthropic", transport: "anthropic_messages", reason: "cloud_first", fallback_used: false })).toBe("cloud");
  });
  it("classifies fallback routing", () => {
    expect(abbyRouteBadgeKind({ model: "local", provider: "ollama", transport: "ollama_chat", reason: "budget_exhausted", fallback_used: true })).toBe("fallback");
  });
  it("classifies cloud-safety-blocked routing ahead of fallback", () => {
    expect(abbyRouteBadgeKind({ model: "local", provider: "ollama", transport: "ollama_chat", reason: "cloud_safety_blocked", fallback_used: true, cloud_safety_blocked: true })).toBe("cloud_blocked");
  });
  it("returns undefined for missing routing", () => {
    expect(abbyRouteBadgeKind(undefined)).toBeUndefined();
  });
});
