import { afterEach, describe, expect, it } from "vitest";
import { useAbbyDockStore } from "./abbyDockStore";

afterEach(() => {
  useAbbyDockStore.setState({ isOpen: false, queuedPrompt: null });
});

describe("abbyDockStore", () => {
  it("starts closed with no queued prompt", () => {
    const s = useAbbyDockStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.queuedPrompt).toBeNull();
  });

  it("openWith opens the dock and queues a prompt", () => {
    useAbbyDockStore.getState().openWith("why is this blocked?");
    const s = useAbbyDockStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.queuedPrompt).toBe("why is this blocked?");
  });

  it("openWith() with no prompt opens without overwriting an existing queued prompt", () => {
    useAbbyDockStore.getState().openWith("keep me");
    useAbbyDockStore.getState().close();
    useAbbyDockStore.getState().openWith();
    const s = useAbbyDockStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.queuedPrompt).toBe("keep me");
  });

  it("consumeQueued returns and clears the queued prompt exactly once", () => {
    useAbbyDockStore.getState().openWith("ask once");
    expect(useAbbyDockStore.getState().consumeQueued()).toBe("ask once");
    expect(useAbbyDockStore.getState().queuedPrompt).toBeNull();
    expect(useAbbyDockStore.getState().consumeQueued()).toBeNull();
  });

  it("toggle flips open state and close shuts the dock", () => {
    const { toggle, close } = useAbbyDockStore.getState();
    toggle();
    expect(useAbbyDockStore.getState().isOpen).toBe(true);
    close();
    expect(useAbbyDockStore.getState().isOpen).toBe(false);
  });
});
