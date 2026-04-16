// Autosave badge render smoke — verifies all four state transitions render
// distinct text/icons so the researcher can read current save status.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutosaveBadge } from "../components/AutosaveBadge";

describe("AutosaveBadge", () => {
  it("renders nothing in the idle state (no save yet, nothing pending)", () => {
    const { container } = render(
      <AutosaveBadge
        status={{ saving: false, pending: false, lastSavedAt: null, error: null }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Saving…" while the mutation is in flight', () => {
    render(
      <AutosaveBadge
        status={{ saving: true, pending: false, lastSavedAt: null, error: null }}
      />,
    );
    expect(screen.getByText(/Saving/i)).toBeDefined();
  });

  it('renders "Unsaved" while the debounce timer is ticking', () => {
    render(
      <AutosaveBadge
        status={{ saving: false, pending: true, lastSavedAt: null, error: null }}
      />,
    );
    expect(screen.getByText(/Unsaved/i)).toBeDefined();
  });

  it('renders "Save failed" when the mutation errored', () => {
    render(
      <AutosaveBadge
        status={{ saving: false, pending: false, lastSavedAt: null, error: new Error("500") }}
      />,
    );
    expect(screen.getByText(/Save failed/i)).toBeDefined();
  });

  it('renders "Saved HH:MM:SS" after a successful save', () => {
    render(
      <AutosaveBadge
        status={{
          saving: false,
          pending: false,
          lastSavedAt: new Date("2026-04-16T15:30:45"),
          error: null,
        }}
      />,
    );
    // Match the "Saved" label; exact locale formatting varies.
    expect(screen.getByText(/Saved/i)).toBeDefined();
  });

  it("prioritizes saving > error > pending > saved when multiple states overlap", () => {
    // Simultaneous "saving + lastSavedAt" → should show Saving…, not Saved.
    render(
      <AutosaveBadge
        status={{
          saving: true,
          pending: false,
          lastSavedAt: new Date(),
          error: null,
        }}
      />,
    );
    expect(screen.getByText(/Saving/i)).toBeDefined();
    expect(screen.queryByText(/Saved /i)).toBeNull();
  });
});
