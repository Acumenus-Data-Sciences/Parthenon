// frontend/src/features/finngen-workbench/stores/workbenchStore.ts
import { create } from "zustand";
import type { WorkbenchSessionStateV1 } from "../types";

/**
 * SP4 Phase A — Zustand store for the active cohort-workbench session.
 *
 * The store is intentionally a thin wrapper around session_state. The
 * autosave hook (useAutosaveWorkbenchSession) reads sessionState here and
 * PATCHes the backend after a debounced quiet window. Phase B will extend
 * the store with operation-tree mutators; Phase A only needs load/patch/clear.
 */

interface WorkbenchStore {
  activeSessionId: string | null;
  sessionState: WorkbenchSessionStateV1;
  loadSession: (id: string, state: WorkbenchSessionStateV1) => void;
  patchState: (patch: Partial<WorkbenchSessionStateV1>) => void;
  setStep: (step: number) => void;
  clear: () => void;
}

export const useWorkbenchStore = create<WorkbenchStore>((set) => ({
  activeSessionId: null,
  sessionState: {},
  loadSession: (id, state) => set({ activeSessionId: id, sessionState: state }),
  patchState: (patch) =>
    set((s) => ({ sessionState: { ...s.sessionState, ...patch } })),
  setStep: (step) =>
    set((s) => ({ sessionState: { ...s.sessionState, step } })),
  clear: () => set({ activeSessionId: null, sessionState: {} }),
}));
