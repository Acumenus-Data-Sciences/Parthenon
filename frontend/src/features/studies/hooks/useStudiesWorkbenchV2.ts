// Local dev/preview toggle for the Studies → Design v2 Compiler Workbench.
//
// NOT a deployment-level flag — intentionally NOT registered in
// FlagNameRegistry (`@/types/featureFlags`). That registry is reserved for
// flags served by `/api/v1/system/feature-flags`. This hook reads URL +
// localStorage so a developer can flip between v1 and v2 without a backend
// round-trip.
//
// Behaviour:
//   ?wb=v2 in URL  → enables v2, persists to localStorage, returns true
//   ?wb=v1 in URL  → disables v2, clears localStorage, returns false
//   no param       → reads localStorage `studies.workbench.v2` ('1' | 'true')

import { useLocation } from "react-router-dom";

const STORAGE_KEY = "studies.workbench.v2";

function readStoredFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function useStudiesWorkbenchV2(): boolean {
  // Re-evaluate on every location change so toggling ?wb=v2 / ?wb=v1 in the
  // URL takes effect without a full reload.
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const override = params.get("wb");

  if (override === "v2") {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable (private mode, quota) — fall back to URL value.
    }
    return true;
  }

  if (override === "v1") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return false;
  }

  return readStoredFlag();
}
