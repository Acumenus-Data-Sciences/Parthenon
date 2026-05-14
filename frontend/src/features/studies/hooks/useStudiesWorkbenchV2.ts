// Toggle for the Studies → Design v2 Compiler Workbench.
//
// NOT a deployment-level flag — intentionally NOT registered in
// FlagNameRegistry (`@/types/featureFlags`). That registry is reserved for
// flags served by `/api/v1/system/feature-flags`. This hook reads URL +
// localStorage so a developer can flip between v1 and v2 without a backend
// round-trip.
//
// Default flipped to v2-on (2026-05-13) after a full audit pass restored
// v1 fidelity (lock-confirm Modal, protocol-upload, import/critique). v1 is
// preserved as an opt-out for one release in case a researcher needs to
// fall back during a study.
//
// Behaviour:
//   ?wb=v1 in URL  → disables v2, persists opt-out to localStorage, returns false
//   ?wb=v2 in URL  → enables v2, clears any opt-out, returns true
//   no param       → reads localStorage `studies.workbench.v1` opt-out
//                    (absent ⇒ v2 enabled by default)
//
// The storage-key semantics inverted from "did the user opt INTO v2?" to
// "did the user opt OUT of v2?" so existing localStorage `studies.workbench.v2`
// entries from the preview phase don't accidentally keep v2 on after the
// default flips — those entries are now harmless (the key isn't consulted).

import { useLocation } from "react-router-dom";

const OPT_OUT_KEY = "studies.workbench.v1";

function readOptOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(OPT_OUT_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function useStudiesWorkbenchV2(): boolean {
  // Re-evaluate on every location change so toggling ?wb=v1 / ?wb=v2 in the
  // URL takes effect without a full reload.
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const override = params.get("wb");

  if (override === "v1") {
    try {
      window.localStorage.setItem(OPT_OUT_KEY, "1");
    } catch {
      // localStorage unavailable (private mode, quota) — fall back to URL value.
    }
    return false;
  }

  if (override === "v2") {
    try {
      window.localStorage.removeItem(OPT_OUT_KEY);
    } catch {
      // ignore
    }
    return true;
  }

  // Default: v2 on, unless the user has explicitly opted out.
  return !readOptOut();
}
