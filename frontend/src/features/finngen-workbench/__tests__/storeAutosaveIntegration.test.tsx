// SP4 Phase B.5 — store ↔ autosave integration. Verifies that mutating the
// operation_tree through workbenchStore drives a debounced PATCH carrying
// the updated session_state.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("../api", () => {
  const update = vi.fn(async (_id: string, payload: Record<string, unknown>) => ({
    id: "01STORE",
    user_id: 1,
    source_key: "PANCREAS",
    name: "x",
    description: null,
    schema_version: 1,
    session_state: payload.session_state ?? {},
    last_active_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  return {
    finngenWorkbenchApi: {
      update: (id: string, payload: Record<string, unknown>) =>
        update(id, payload).then((data) => ({ data })),
      __update: update,
    },
  };
});

import { useAutosaveWorkbenchSession } from "../hooks/useWorkbenchSession";
import { useWorkbenchStore } from "../stores/workbenchStore";
import { makeCohort, makeOp } from "../lib/operationTree";
import { finngenWorkbenchApi } from "../api";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  vi.useFakeTimers();
  // @ts-expect-error test helper exposed via mock
  finngenWorkbenchApi.__update.mockClear();
  // Reset zustand store between tests.
  useWorkbenchStore.setState({ activeSessionId: null, sessionState: {} });
});

describe("workbenchStore + autosave integration", () => {
  it("setOperationTree mutation triggers a PATCH carrying the new tree", async () => {
    // Seed an active session.
    useWorkbenchStore.getState().loadSession("01STORE", {});

    const { rerender } = renderHook(
      () => {
        const id = useWorkbenchStore((s) => s.activeSessionId);
        const state = useWorkbenchStore((s) => s.sessionState);
        return useAutosaveWorkbenchSession(id, state, 100);
      },
      { wrapper },
    );

    // Mutate the tree via the store.
    act(() => {
      useWorkbenchStore.getState().setOperationTree(
        makeOp("UNION", [makeCohort(221), makeCohort(222)]),
      );
    });
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    // @ts-expect-error test helper exposed via mock
    expect(finngenWorkbenchApi.__update).toHaveBeenCalledTimes(1);
    // @ts-expect-error test helper exposed via mock
    const patch = finngenWorkbenchApi.__update.mock.calls[0][1];
    expect(patch.session_state.operation_tree).toBeTruthy();
    expect(patch.session_state.operation_tree.kind).toBe("op");
    expect(patch.session_state.operation_tree.op).toBe("UNION");
    expect(patch.session_state.operation_tree.children).toHaveLength(2);
  });

  it("getOperationTree returns the current tree from store", () => {
    const tree = makeOp("MINUS", [makeCohort(1), makeCohort(2)]);
    useWorkbenchStore.getState().setOperationTree(tree);
    expect(useWorkbenchStore.getState().getOperationTree()).toEqual(tree);
  });

  it("getOperationTree returns null when no tree is set", () => {
    expect(useWorkbenchStore.getState().getOperationTree()).toBeNull();
  });
});
