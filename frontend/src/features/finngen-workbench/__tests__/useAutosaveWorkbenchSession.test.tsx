// SP4 Phase A — verify the autosave hook coalesces rapid edits into a single
// PATCH per quiet window and emits no PATCH when state hasn't changed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("../api", () => {
  const update = vi.fn(async (_id: string, payload: Record<string, unknown>) => ({
    id: "01TEST",
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
import { finngenWorkbenchApi } from "../api";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  vi.useFakeTimers();
  // @ts-expect-error test helper exposed via mock
  finngenWorkbenchApi.__update.mockClear();
});

describe("useAutosaveWorkbenchSession", () => {
  it("coalesces rapid edits into a single PATCH per quiet window", async () => {
    const { rerender } = renderHook(
      ({ state }) => useAutosaveWorkbenchSession("01TEST", state, 200),
      { wrapper, initialProps: { state: { step: 1 } } },
    );

    rerender({ state: { step: 2 } });
    rerender({ state: { step: 3 } });
    rerender({ state: { step: 4 } });

    await act(async () => {
      vi.advanceTimersByTime(199);
    });
    // @ts-expect-error test helper exposed via mock
    expect(finngenWorkbenchApi.__update).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    // @ts-expect-error test helper exposed via mock
    expect(finngenWorkbenchApi.__update).toHaveBeenCalledTimes(1);
    // @ts-expect-error test helper exposed via mock
    expect(finngenWorkbenchApi.__update.mock.calls[0][1]).toEqual({
      session_state: { step: 4 },
    });
  });

  it("does not PATCH when state hasn't changed", async () => {
    const { rerender } = renderHook(
      ({ state }) => useAutosaveWorkbenchSession("01TEST", state, 100),
      { wrapper, initialProps: { state: { step: 1 } } },
    );
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    // @ts-expect-error test helper exposed via mock
    finngenWorkbenchApi.__update.mockClear();

    // Same state — autosave should noop.
    rerender({ state: { step: 1 } });
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    // @ts-expect-error test helper exposed via mock
    expect(finngenWorkbenchApi.__update).not.toHaveBeenCalled();
  });

  it("does nothing when id is null", async () => {
    renderHook(
      () => useAutosaveWorkbenchSession(null, { step: 1 }, 100),
      { wrapper },
    );
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    // @ts-expect-error test helper exposed via mock
    expect(finngenWorkbenchApi.__update).not.toHaveBeenCalled();
  });
});
