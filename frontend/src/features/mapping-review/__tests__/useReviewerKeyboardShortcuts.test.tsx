import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useReviewerKeyboardShortcuts } from "../hooks/useReviewerKeyboardShortcuts";

function Probe(props: Parameters<typeof useReviewerKeyboardShortcuts>[0]) {
  useReviewerKeyboardShortcuts(props);
  return (
    <div>
      <input data-testid="search-input" type="text" />
      <textarea data-testid="reason-textarea" />
      <select data-testid="vocab-select">
        <option>SNOMED</option>
      </select>
      <button type="button" data-testid="ok-target">
        OK
      </button>
    </div>
  );
}

describe("useReviewerKeyboardShortcuts", () => {
  it("fires onNext when J is pressed outside an input", () => {
    const onNext = vi.fn();
    render(<Probe onNext={onNext} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire J shortcut when typing in an input", () => {
    const onNext = vi.fn();
    const { getByTestId } = render(<Probe onNext={onNext} />);
    const input = getByTestId("search-input");
    input.focus();
    fireEvent.keyDown(input, { key: "j" });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("does NOT fire shortcut from inside a textarea", () => {
    const onApprove = vi.fn();
    const { getByTestId } = render(<Probe onApprove={onApprove} />);
    const ta = getByTestId("reason-textarea");
    ta.focus();
    fireEvent.keyDown(ta, { key: "a" });
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("does NOT fire shortcut from inside a select", () => {
    const onReject = vi.fn();
    const { getByTestId } = render(<Probe onReject={onReject} />);
    const sel = getByTestId("vocab-select");
    sel.focus();
    fireEvent.keyDown(sel, { key: "r" });
    expect(onReject).not.toHaveBeenCalled();
  });

  it("Esc fires onEscape EVEN when typing in an input (modal-close path)", () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Probe onEscape={onEscape} />);
    const input = getByTestId("search-input");
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts when modifier keys are held", () => {
    const onApprove = vi.fn();
    render(<Probe onApprove={onApprove} />);
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    fireEvent.keyDown(window, { key: "a", metaKey: true });
    fireEvent.keyDown(window, { key: "a", altKey: true });
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("? toggles help via onHelpToggle", () => {
    const onHelpToggle = vi.fn();
    render(<Probe onHelpToggle={onHelpToggle} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(onHelpToggle).toHaveBeenCalledTimes(1);
  });
});
