import { useEffect, useRef, useState, useCallback } from "react";
import { updatePublicationDraftWithEtag } from "../api/publishApi";
import { documentHash } from "../lib/documentHash";
import type { DocumentJson, PublicationDraftInput } from "../types/publish";

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
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const lastSavedHash = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightAttempts = useRef(0);
  const performSaveRef = useRef<() => Promise<void>>(async () => {});

  const currentHash = documentHash({ title, document });

  const performSave = useCallback(async () => {
    if (draftId === null) return;
    if (lastSavedHash.current === currentHash) return;
    if (ifUnmodifiedSince === null) return;

    setStatus("saving");
    const payload: Partial<PublicationDraftInput> = { title, document_json: document };
    try {
      await updatePublicationDraftWithEtag(draftId, payload, ifUnmodifiedSince);
      lastSavedHash.current = currentHash;
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
    }
  }, [draftId, currentHash, ifUnmodifiedSince, title, document, onStaleConflict]);

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
