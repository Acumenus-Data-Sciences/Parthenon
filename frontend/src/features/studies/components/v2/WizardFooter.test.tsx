import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { WizardFooter } from "./WizardFooter";
import type { StudyDesignVersion } from "../../types/study";

function ver(id: number, n: number): StudyDesignVersion {
  return {
    id,
    version_number: n,
    status: "draft",
    updated_at: new Date("2026-01-01T00:00:00Z").toISOString(),
  } as unknown as StudyDesignVersion;
}

function baseProps(overrides: Partial<Parameters<typeof WizardFooter>[0]> = {}) {
  return {
    currentStep: 0,
    totalSteps: 8,
    canProceed: true,
    onBack: vi.fn(),
    onNext: vi.fn(),
    protocolInputRef: createRef<HTMLInputElement>(),
    onProtocolUpload: vi.fn(),
    protocolBusy: false,
    versionLabel: "v1 · draft",
    versions: [],
    activeVersionId: null,
    onSelectVersion: vi.fn(() => true),
    ...overrides,
  };
}

describe("WizardFooter", () => {
  it("disables Back on the first step", () => {
    render(<WizardFooter {...baseProps({ currentStep: 0 })} />);
    const backBtn = screen.getByRole("button", { name: /back/i });
    expect(backBtn).toBeDisabled();
  });

  it("enables Back when not on the first step", () => {
    render(<WizardFooter {...baseProps({ currentStep: 3 })} />);
    const backBtn = screen.getByRole("button", { name: /back/i });
    expect(backBtn).not.toBeDisabled();
  });

  it("hides Next on the last step", () => {
    render(<WizardFooter {...baseProps({ currentStep: 7, totalSteps: 8 })} />);
    expect(
      screen.queryByRole("button", { name: /next/i }),
    ).not.toBeInTheDocument();
  });

  it("disables Next when canProceed is false", () => {
    render(
      <WizardFooter {...baseProps({ currentStep: 2, canProceed: false })} />,
    );
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();
    expect(nextBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("enables Next when canProceed is true", () => {
    render(
      <WizardFooter {...baseProps({ currentStep: 2, canProceed: true })} />,
    );
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it("calls onNext when Next is clicked", () => {
    const onNext = vi.fn();
    render(
      <WizardFooter {...baseProps({ currentStep: 2, canProceed: true, onNext })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when Back is clicked", () => {
    const onBack = vi.fn();
    render(<WizardFooter {...baseProps({ currentStep: 3, onBack })} />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders the version chip when versionLabel is set", () => {
    render(<WizardFooter {...baseProps({ versionLabel: "v2 · draft" })} />);
    expect(screen.getByText(/v2 · draft/)).toBeInTheDocument();
  });

  it("hides the version chip when versionLabel is null", () => {
    render(<WizardFooter {...baseProps({ versionLabel: null })} />);
    expect(screen.queryByText(/v\d/)).not.toBeInTheDocument();
  });

  it("disables the upload button when protocolBusy is true", () => {
    render(<WizardFooter {...baseProps({ protocolBusy: true })} />);
    const uploadBtn = screen.getByRole("button", { name: /upload/i });
    expect(uploadBtn).toBeDisabled();
  });

  it("clicking the upload chip triggers a click on the hidden file input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<WizardFooter {...baseProps({ protocolInputRef: ref })} />);
    // jsdom doesn't actually open a file dialog, but it does propagate the
    // synthetic click. We assert via spying on .click() of the ref.
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // TG-4: a guarded version switch can be cancelled (unsaved-edits confirm
  // declined); the popover must stay open in that case and only dismiss on a
  // successful switch.
  it("keeps the version popover open when the switch is cancelled (onSelectVersion → false)", () => {
    const onSelectVersion = vi.fn(() => false);
    render(
      <WizardFooter
        {...baseProps({
          versions: [ver(1, 1), ver(2, 2)],
          activeVersionId: 1,
          onSelectVersion,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /active version/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /v2/i }));
    expect(onSelectVersion).toHaveBeenCalledWith(2);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the version popover when the switch succeeds (onSelectVersion → true)", () => {
    const onSelectVersion = vi.fn(() => true);
    render(
      <WizardFooter
        {...baseProps({
          versions: [ver(1, 1), ver(2, 2)],
          activeVersionId: 1,
          onSelectVersion,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /active version/i }));
    fireEvent.click(screen.getByRole("option", { name: /v2/i }));
    expect(onSelectVersion).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
