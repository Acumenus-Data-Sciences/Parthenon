import { useFeatureFlagsQuery } from "./api";

/**
 * Side-effect-only component that triggers `/system/feature-flags` fetch on
 * mount and hydrates {@link useFeatureFlagsStore}. Renders nothing.
 *
 * Mounted once near the root of the app tree (inside `QueryClientProvider`)
 * so every gated surface in the app sees a populated store before its first
 * paint.
 */
export function FlagsLoader() {
  useFeatureFlagsQuery();
  return null;
}
