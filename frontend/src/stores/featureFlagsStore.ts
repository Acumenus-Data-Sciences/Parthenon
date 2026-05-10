import { create } from "zustand";

import type { FeatureFlag, FeatureFlagMap, FlagName } from "@/types/featureFlags";

interface FeatureFlagsState {
  flags: FeatureFlagMap;
  loaded: boolean;
  error: string | null;
  setFlags: (flags: readonly FeatureFlag[]) => void;
  setError: (msg: string) => void;
  isEnabled: (name: FlagName) => boolean;
  flag: (name: FlagName) => FeatureFlag | undefined;
  reset: () => void;
}

/**
 * Zustand store for deployment-level feature flags. Hydrated once on app
 * mount via {@link useFeatureFlagsQuery}. EE bundles can also call
 * `setFlags(...)` directly to merge additional flag sources without
 * modifying CE code.
 */
export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  flags: {},
  loaded: false,
  error: null,

  setFlags: (flags) =>
    set({
      flags: Object.fromEntries(flags.map((f) => [f.name, f])) as FeatureFlagMap,
      loaded: true,
      error: null,
    }),

  setError: (msg) => set({ error: msg, loaded: false }),

  isEnabled: (name) => Boolean(get().flags[name]?.enabled),
  flag: (name) => get().flags[name],

  reset: () => set({ flags: {}, loaded: false, error: null }),
}));

/**
 * Subscribed boolean for a single flag. Recommended call site for components
 * that gate sub-trees on flag state.
 */
export function useFlag(name: FlagName): boolean {
  return useFeatureFlagsStore((s) => Boolean(s.flags[name]?.enabled));
}

/**
 * Subscribed accessor returning the raw flag descriptor, or undefined when
 * the flag is absent from the deployment. Use when callers need
 * `description` or `source` (e.g. admin UIs).
 */
export function useFeatureFlag(name: FlagName): FeatureFlag | undefined {
  return useFeatureFlagsStore((s) => s.flags[name]);
}
