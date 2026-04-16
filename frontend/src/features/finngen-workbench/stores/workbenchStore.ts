// frontend/src/features/finngen-workbench/stores/workbenchStore.ts
import { create } from "zustand";
import type { OperationNode } from "../lib/operationTree";
import type { WorkbenchSessionStateV1 } from "../types";

/**
 * SP4 Phase A scaffold + Phase B.5 operation-tree mutators.
 *
 * The store is a thin wrapper around session_state. The autosave hook
 * (useAutosaveWorkbenchSession) reads sessionState here and PATCHes the
 * backend after a debounced quiet window — any change to sessionState
 * (including operation_tree) triggers it.
 */

interface WorkbenchStore {
  activeSessionId: string | null;
  sessionState: WorkbenchSessionStateV1;
  loadSession: (id: string, state: WorkbenchSessionStateV1) => void;
  patchState: (patch: Partial<WorkbenchSessionStateV1>) => void;
  setStep: (step: number) => void;
  setOperationTree: (tree: OperationNode | null) => void;
  getOperationTree: () => OperationNode | null;
  clear: () => void;
}

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  activeSessionId: null,
  sessionState: {},
  loadSession: (id, state) => set({ activeSessionId: id, sessionState: state }),
  patchState: (patch) =>
    set((s) => ({ sessionState: { ...s.sessionState, ...patch } })),
  setStep: (step) =>
    set((s) => ({ sessionState: { ...s.sessionState, step } })),
  setOperationTree: (tree) =>
    set((s) => ({ sessionState: { ...s.sessionState, operation_tree: tree } })),
  getOperationTree: () => {
    const t = get().sessionState.operation_tree;
    return (t as OperationNode | null | undefined) ?? null;
  },
  clear: () => set({ activeSessionId: null, sessionState: {} }),
}));
