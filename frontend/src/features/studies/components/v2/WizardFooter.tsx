import { useState, type ChangeEvent, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import type { StudyDesignVersion } from "../../types/study";
import { VersionPopover } from "./VersionPopover";

// Wizard footer — Back/Next + protocol-upload + version chip.
// Mirrors the CohortWizardModal footer (border-t, px-8 py-4, ArrowLeft/Right
// icons) plus the v2 affordances that previously lived on the IdentityStrip
// (upload protocol) and in the VersionTimeline strip (version label + diff).
// The version chip toggles an inline popover (VersionPopover) for switching
// versions and viewing the side-by-side PICO diff.

interface WizardFooterProps {
  currentStep: number;
  totalSteps: number;
  canProceed: boolean;

  onBack: () => void;
  onNext: () => void;

  protocolInputRef: RefObject<HTMLInputElement | null>;
  onProtocolUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  protocolBusy: boolean;

  versionLabel: string | null;
  versions: ReadonlyArray<StudyDesignVersion>;
  activeVersionId: number | null;
  /** Returns true when the version switch succeeded, false when the user
   *  cancelled the unsaved-edits confirm. The popover closes only on true. */
  onSelectVersion: (id: number) => boolean;
}

export function WizardFooter({
  currentStep,
  totalSteps,
  canProceed,
  onBack,
  onNext,
  protocolInputRef,
  onProtocolUpload,
  protocolBusy,
  versionLabel,
  versions,
  activeVersionId,
  onSelectVersion,
}: WizardFooterProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const versionChipEnabled = versionLabel !== null && versions.length > 0;

  return (
    <footer className="flex items-center justify-between gap-4 border-t border-border-default px-8 py-4">
      <div className="flex items-center gap-3">
        <input
          ref={protocolInputRef}
          type="file"
          aria-label={tAuto("studies.v2.uploadProtocolFile")}
          accept=".doc,.docx,.pdf,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
          className="sr-only"
          onChange={onProtocolUpload}
        />
        <button
          type="button"
          onClick={() => protocolInputRef.current?.click()}
          disabled={protocolBusy}
          aria-label={tAuto("studies.v2.uploadProtocol")}
          title={tAuto("studies.v2.uploadProtocol")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium transition-colors",
            "text-text-muted hover:text-text-secondary",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {protocolBusy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload size={14} aria-hidden="true" />
          )}
          {tAuto("studies.v2.wizard.uploadProtocolShort")}
        </button>

        {versionLabel ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!versionChipEnabled) return;
                setPopoverOpen((prev) => !prev);
              }}
              disabled={!versionChipEnabled}
              aria-expanded={popoverOpen}
              aria-haspopup="dialog"
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 font-mono text-xs",
                "text-text-muted hover:text-text-secondary transition-colors",
                "disabled:cursor-default disabled:opacity-70",
                popoverOpen && "bg-surface-elevated text-text-secondary",
              )}
              title={tAuto("studies.v2.wizard.versionChipTitle")}
              aria-label={tAuto("studies.v2.wizard.versionChipAria", {
                label: versionLabel,
              })}
            >
              {versionLabel}
              {versionChipEnabled ? <span aria-hidden="true">▾</span> : null}
            </button>
            <VersionPopover
              open={popoverOpen}
              onClose={() => setPopoverOpen(false)}
              versions={versions}
              activeVersionId={activeVersionId}
              onSelectVersion={onSelectVersion}
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirstStep}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            isFirstStep
              ? "cursor-not-allowed text-surface-highlight"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {tAuto("studies.v2.wizard.back")}
        </button>

        {!isLastStep ? (
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            aria-disabled={!canProceed}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              canProceed
                ? "bg-accent text-surface-base hover:bg-accent-light"
                : "cursor-not-allowed bg-surface-elevated text-text-ghost",
            )}
          >
            {tAuto("studies.v2.wizard.next")}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </footer>
  );
}
