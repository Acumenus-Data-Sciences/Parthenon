import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updatePublicationDraftWithEtag } from "../api/publishApi";
import { documentHash } from "../lib/documentHash";
import type {
  DocumentJson,
  PublicationDraft,
  PublicationDraftInput,
} from "../types/publish";

export type SaveStatus = "idle" | "saving" | "saved" | "unsaved" | "error";

interface UseAutosaveOptions {
  draftId: number | null;
  title: string;
  document: DocumentJson;
  ifUnmodifiedSince: string | null;
  debounceMs?: number;
  onStaleConflict: () => void;
}

export function useAutosave({
  draftId,
  title,
  document,
  ifUnmodifiedSince,
  debounceMs = 2000,
  onStaleConflict,
}: UseAutosaveOptions) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const lastSavedHash = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightAttempts = useRef(0);
  // In-flight guard: prevents a debounced timer from starting a second
  // concurrent PATCH while the first is still pending. When a save fires
  // mid-flight, we record it as `pendingAfterInFlight` and run it once
  // the in-flight save settles, using the freshest state available.
  const inFlight = useRef(false);
  const pendingAfterInFlight = useRef(false);
  const performSaveRef = useRef<() => Promise<void>>(async () => {});
  // Track the latest `updated_at` we've observed from the server so each
  // autosave PATCH carries an If-Unmodified-Since that matches the row's
  // current state. Without this the second autosave would always 412
  // because the prop-level `ifUnmodifiedSince` never refreshes.
  const currentIfUnmodifiedSince = useRef<string | null>(ifUnmodifiedSince);
  const initialBaselineSeeded = useRef(false);
  useEffect(() => {
    // Only honor the prop value when we haven't observed a newer one ourselves.
    if (currentIfUnmodifiedSince.current === null) {
      currentIfUnmodifiedSince.current = ifUnmodifiedSince;
    }
  }, [ifUnmodifiedSince]);

  const currentHash = documentHash({ title, document });

  // Seed the saved-hash baseline once when the draft is first loaded from
  // the server. Without this, every mount with an unchanged document would
  // schedule a redundant PATCH (lastSavedHash=null !== currentHash).
  useEffect(() => {
    if (initialBaselineSeeded.current) return;
    if (draftId !== null && ifUnmodifiedSince !== null) {
      lastSavedHash.current = currentHash;
      initialBaselineSeeded.current = true;
    }
  }, [draftId, ifUnmodifiedSince, currentHash]);

  const performSave = useCallback(async () => {
    if (draftId === null) return;
    if (lastSavedHash.current === currentHash) return;
    if (inFlight.current) {
      // Another save is in flight — mark that we want one more after it
      // settles, but don't fire concurrently (would race to 412).
      pendingAfterInFlight.current = true;
      return;
    }
    const baseline = currentIfUnmodifiedSince.current ?? ifUnmodifiedSince;
    if (baseline === null) return;

    inFlight.current = true;
    setStatus("saving");
    const payload: Partial<PublicationDraftInput> = { title, document_json: document };
    try {
      const updated = await updatePublicationDraftWithEtag(draftId, payload, baseline);
      lastSavedHash.current = currentHash;
      // Advance the optimistic-lock baseline to the row's new updated_at so
      // the next autosave doesn't 412 against our own previous write.
      currentIfUnmodifiedSince.current = updated.updated_at ?? baseline;
      // Refresh the TanStack cache so any consumer of useDraft (e.g. library
      // page card, snapshots panel) sees the new updated_at and avoids
      // re-rendering with a stale draft on navigation.
      qc.setQueryData<PublicationDraft>(["publish", "drafts", draftId], updated);
      qc.invalidateQueries({ queryKey: ["publish", "drafts"], exact: true });
      setLastSavedAt(new Date().toISOString());
      setStatus("saved");
      inFlightAttempts.current = 0;
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 412) {
        onStaleConflict();
        setStatus("error");
        return;
      }
      inFlightAttempts.current += 1;
      if (inFlightAttempts.current < 3) {
        const delay = [500, 2000, 8000][inFlightAttempts.current - 1] ?? 8000;
        setStatus("unsaved");
        setTimeout(() => { void performSaveRef.current(); }, delay);
        return;
      }
      setStatus("error");
    } finally {
      inFlight.current = false;
      // If a save was requested while one was in flight, fire one more
      // pass now so the user's latest changes are captured.
      if (pendingAfterInFlight.current) {
        pendingAfterInFlight.current = false;
        // Defer to next tick so React state from this save settles first.
        setTimeout(() => { void performSaveRef.current(); }, 0);
      }
    }
  }, [draftId, currentHash, ifUnmodifiedSince, title, document, onStaleConflict, qc]);

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  useEffect(() => {
    if (draftId === null) return;
    if (lastSavedHash.current === currentHash) {
      setStatus(lastSavedAt ? "saved" : "idle");
      return;
    }
    setStatus("unsaved");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { void performSave(); }, debounceMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [draftId, currentHash, performSave, debounceMs, lastSavedAt]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === "unsaved" || status === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return { status, lastSavedAt, retry: performSave };
}
