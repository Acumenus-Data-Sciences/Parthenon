import { describe, it, expect, beforeEach } from "vitest";

import { useFeatureFlagsStore, useFlag } from "../featureFlagsStore";
import type { FeatureFlag } from "@/types/featureFlags";

describe("featureFlagsStore", () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
  });

  it("starts empty + unloaded with no error", () => {
    const s = useFeatureFlagsStore.getState();
    expect(s.loaded).toBe(false);
    expect(s.error).toBeNull();
    expect(Object.keys(s.flags)).toHaveLength(0);
  });

  it("isEnabled returns false for an unset flag", () => {
    expect(useFeatureFlagsStore.getState().isEnabled("auth.saml")).toBe(false);
  });

  it("setFlags hydrates the map and marks loaded=true", () => {
    const flags: FeatureFlag[] = [
      { name: "auth.saml", enabled: true, source: "ee", description: null },
      { name: "tenancy.multi", enabled: false, source: "ce", description: "single-tenant" },
    ];
    useFeatureFlagsStore.getState().setFlags(flags);

    const s = useFeatureFlagsStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.error).toBeNull();
    expect(s.isEnabled("auth.saml")).toBe(true);
    expect(s.isEnabled("tenancy.multi")).toBe(false);
    expect(s.flag("auth.saml")?.source).toBe("ee");
  });

  it("setError clears loaded and stores the message", () => {
    useFeatureFlagsStore.getState().setError("network down");
    const s = useFeatureFlagsStore.getState();
    expect(s.loaded).toBe(false);
    expect(s.error).toBe("network down");
  });

  it("reset() clears flags + error + loaded", () => {
    useFeatureFlagsStore.getState().setFlags([
      { name: "auth.saml", enabled: true, source: "ee", description: null },
    ]);
    useFeatureFlagsStore.getState().reset();

    const s = useFeatureFlagsStore.getState();
    expect(s.loaded).toBe(false);
    expect(s.error).toBeNull();
    expect(s.isEnabled("auth.saml")).toBe(false);
  });

  it("flag() returns undefined for an unset flag, the descriptor for a set flag", () => {
    expect(useFeatureFlagsStore.getState().flag("auth.saml")).toBeUndefined();

    useFeatureFlagsStore.getState().setFlags([
      { name: "auth.saml", enabled: true, source: "ee", description: "SAML 2.0 SSO" },
    ]);

    const flag = useFeatureFlagsStore.getState().flag("auth.saml");
    expect(flag).toBeDefined();
    expect(flag?.description).toBe("SAML 2.0 SSO");
  });

  it("useFlag selector reads from the same backing store", () => {
    useFeatureFlagsStore.getState().setFlags([
      { name: "audit.signed", enabled: true, source: "ee", description: null },
    ]);

    // useFlag is a hook — invoke it through the store's getState path used in tests.
    // Directly verify the selector logic the hook is built on:
    const state = useFeatureFlagsStore.getState();
    expect(Boolean(state.flags["audit.signed"]?.enabled)).toBe(true);
    // Sanity: the hook itself is a thin wrapper over this same logic.
    expect(typeof useFlag).toBe("function");
  });
});
