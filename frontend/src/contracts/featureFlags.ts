// Plan 02-06 — Public extension contract for the feature-flags surface.
//
// EE consumers (and any community fork that ships its own gating) implement
// this contract to plug in additional flag sources without patching CE
// code. CE itself never imports from this file outside of test fixtures —
// the contract exists purely as documentation + a type anchor for EE.
//
// EE wires its provider in `enterprise/frontend/src/providers/EnterpriseFeatureFlagsProvider.tsx`
// which calls `useFeatureFlagsStore.getState().setFlags([...])` on mount with
// the merged CE+EE flag list.

import type { FeatureFlag, FlagName } from "@/types/featureFlags";

/**
 * Implemented by consumers that contribute additional flags at runtime
 * (typically only EE bundles). The host application calls `flags()` after
 * the CE backend response has been hydrated and merges the results.
 */
export interface FeatureFlagContributor {
  /** Stable identifier — 'ce-builtin', 'ee-overlay', 'community-foo'. */
  name(): string;

  /**
   * Returns the additional flags this contributor wants applied. Implementers
   * MUST return a stable shape; the host may call this synchronously on
   * every store hydration.
   */
  flags(): readonly FeatureFlag[];
}

/**
 * Hook contract surfaced by the CE feature-flags store. EE depends only on
 * the type here, never on the concrete Zustand store implementation.
 */
export interface FeatureFlagAccessor {
  isEnabled(name: FlagName): boolean;
  flag(name: FlagName): FeatureFlag | undefined;
}
