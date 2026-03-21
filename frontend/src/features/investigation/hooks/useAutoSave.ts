import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveDomainState } from "./useInvestigation";
import type { EvidenceDomain } from "../types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave(
  investigationId: number | undefined,
  domain: EvidenceDomain,
  state: Record<string, unknown> | null,
  debounceMs = 2000,
) {
  const mutation = useSaveDomainState();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedRef = useRef<string>("");

  const save = useCallback(() => {
    if (!investigationId || !state) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedRef.current) return;

    setStatus("saving");
    mutation.mutate(
      { id: investigationId, domain, state },
      {
        onSuccess: () => {
          lastSavedRef.current = serialized;
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2000);
        },
        onError: () => setStatus("error"),
      },
    );
  }, [investigationId, domain, state, mutation]);

  useEffect(() => {
    if (!state || !investigationId) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedRef.current) return;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, debounceMs);

    return () => clearTimeout(timeoutRef.current);
  }, [state, investigationId, save, debounceMs]);

  return { status, saveNow: save };
}
