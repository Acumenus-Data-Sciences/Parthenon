import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AskAbbyButton } from "./AskAbbyButton";
import { useAbbyDockStore } from "../stores/abbyDockStore";

afterEach(() => {
  useAbbyDockStore.setState({ isOpen: false, queuedPrompt: null });
});

describe("AskAbbyButton", () => {
  it("opens the dock and queues its prompt when clicked", () => {
    render(<AskAbbyButton prompt="Explain the study-diagnostics gate." />);

    fireEvent.click(screen.getByRole("button", { name: /ask abby/i }));

    const s = useAbbyDockStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.queuedPrompt).toBe("Explain the study-diagnostics gate.");
  });

  it("renders a custom label", () => {
    render(<AskAbbyButton prompt="x" label="Why blocked?" />);
    expect(screen.getByRole("button", { name: /why blocked/i })).toBeInTheDocument();
  });
});
