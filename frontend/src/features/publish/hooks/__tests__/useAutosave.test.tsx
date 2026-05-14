// Unit tests for useAutosave — regression coverage for the audit fixes:
//   #1 — second autosave must use the row's NEW updated_at (412-loop bug)
//   #8 — concurrent saves must not fire simultaneously (race-to-412 guard)
//
// We mock updatePublicationDraftWithEtag and drive the hook via a small
// host component, using vitest's fake timers to control the 2s debounce.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DocumentJson, PublicationDraft } from "../../types/publish";

// Module-level mock so the function is replaced with a fresh vi.fn() that
// vitest can fully reset between tests. spyOn-based history was bleeding
// across tests because spyOn re-uses the same MockInstance per property.
vi.mock("../../api/publishApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/publishApi")>();
  return {
    ...actual,
    updatePublicationDraftWithEtag: vi.fn(),
  };
});

import * as publishApi from "../../api/publishApi";
import { useAutosave } from "../useAutosave";

const DOC: DocumentJson = {
  version: 1,
  title: "X",
  authors: [],
  template: "generic-ohdsi",
  step: 1,
  selectedExecutions: [],
  sections: [],
};

function makeDraft(overrides: Partial<PublicationDraft> = {}): PublicationDraft {
  return {
    id: 7,
    user_id: 1,
    study_id: null,
    title: "X",
    template: "generic-ohdsi",
    document_json: DOC,
    status: "draft",
    visibility: "private",
    updated_by_user_id: null,
    last_opened_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface HostProps {
  doc: DocumentJson;
  title: string;
  ifUnmodifiedSince?: string | null;
  onStaleConflict?: () => void;
}

function Host({ doc, title, ifUnmodifiedSince = "2026-01-01T00:00:00.000Z", onStaleConflict = () => {} }: HostProps) {
  useAutosave({
    draftId: 7,
    title,
    document: doc,
    ifUnmodifiedSince,
    onStaleConflict,
  });
  return null;
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}

describe("useAutosave", () => {
  const updateSpy = vi.mocked(publishApi.updatePublicationDraftWithEtag);

  beforeEach(() => {
    vi.useFakeTimers();
    updateSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not fire a PATCH while content hash matches the last saved value", async () => {
    updateSpy.mockResolvedValue(makeDraft({ updated_at: "2026-01-01T00:00:01.000Z" }));

    const { rerender } = renderWithClient(<Host doc={DOC} title="X" />);
    // Same state on initial mount → no debounce should fire.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(updateSpy).not.toHaveBeenCalled();

    // Re-render with identical content → still no save.
    rerender(<Host doc={DOC} title="X" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("debounces an edit then fires one PATCH after 2s", async () => {
    updateSpy.mockResolvedValue(makeDraft({ updated_at: "2026-01-01T00:00:05.000Z" }));

    const { rerender } = renderWithClient(<Host doc={DOC} title="X" />);
    rerender(<Host doc={DOC} title="Y" />);

    // Before debounce window: no call yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(updateSpy).not.toHaveBeenCalled();

    // After debounce window: one call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][2]).toBe("2026-01-01T00:00:00.000Z");
  });

  it("regression #1: second save uses the updated_at returned from the first save", async () => {
    // First save returns updated_at = T1
    updateSpy.mockResolvedValueOnce(makeDraft({ updated_at: "2026-01-01T00:01:00.000Z" }));
    // Second save returns updated_at = T2
    updateSpy.mockResolvedValueOnce(makeDraft({ updated_at: "2026-01-01T00:02:00.000Z" }));

    const { rerender } = renderWithClient(<Host doc={DOC} title="X" />);

    // First edit
    rerender(<Host doc={DOC} title="Y" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][2]).toBe("2026-01-01T00:00:00.000Z"); // T0 baseline

    // Second edit — must use T1 (returned from first save), NOT T0.
    rerender(<Host doc={DOC} title="Z" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy.mock.calls[1][2]).toBe("2026-01-01T00:01:00.000Z");

    // Third edit — must use T2 (returned from second save).
    rerender(<Host doc={DOC} title="W" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(updateSpy).toHaveBeenCalledTimes(2 + 1);
    expect(updateSpy.mock.calls[2][2]).toBe("2026-01-01T00:02:00.000Z");
  });

  it("regression #8: rapid edits do not produce concurrent PATCHes", async () => {
    // First save takes 1 second to resolve — gives us a window where a
    // second debounce fires while the first is still in flight.
    let resolveFirst: (d: PublicationDraft) => void = () => {};
    const firstPromise = new Promise<PublicationDraft>((res) => {
      resolveFirst = res;
    });
    updateSpy.mockReturnValueOnce(firstPromise);
    updateSpy.mockResolvedValueOnce(makeDraft({ updated_at: "2026-01-01T00:01:00.000Z" }));

    const { rerender } = renderWithClient(<Host doc={DOC} title="X" />);

    // First edit — fires after 2s debounce, hits the slow mock.
    rerender(<Host doc={DOC} title="Y" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);

    // Second edit while first is still in flight — debounce timer expires
    // but performSave's inFlight guard must defer this save.
    rerender(<Host doc={DOC} title="Z" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    // Still only 1 call — no concurrent PATCH.
    expect(updateSpy).toHaveBeenCalledTimes(1);

    // Resolve the first save. The deferred second save should now fire.
    await act(async () => {
      resolveFirst(makeDraft({ updated_at: "2026-01-01T00:00:30.000Z" }));
      // Allow the queued setTimeout(0) to fire.
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(updateSpy).toHaveBeenCalledTimes(2);
    // Second call's baseline must be T+30 (from first save), not T0.
    expect(updateSpy.mock.calls[1][2]).toBe("2026-01-01T00:00:30.000Z");
  });

  it("calls onStaleConflict on 412 and does not retry", async () => {
    const stale = vi.fn();
    const err = { response: { status: 412 } };
    updateSpy.mockRejectedValue(err);

    const { rerender } = renderWithClient(
      <Host doc={DOC} title="X" onStaleConflict={stale} />,
    );
    rerender(<Host doc={DOC} title="Y" onStaleConflict={stale} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(stale).toHaveBeenCalledTimes(1);

    // Drain any potential retry timers — none should fire because 412 short-circuits.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
