import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import { ActionGateHint } from "../../workbench/shared/ActionGateHint";
import type { IntentFormState } from "../../workbench/studyDesignWorkbenchHelpers";
import type { IntentReviewAssistance } from "../../studyDesignIntentAssistance";
import type {
  StudyDesignSession,
  StudyDesignVersion,
} from "../../../types/study";
import { PicoPopulatedState } from "./PicoPopulatedState";

/**
 * PicoCanvas — Intent station Active Editor (Phase 2).
 *
 * Renders one of two states:
 *   - Empty (no version): focused research-question textarea + generate button
 *   - Populated (version exists): editable SVG PICO causal graph + action bar
 *
 * Mirrors the data contract of `IntentReviewPanel` so the surrounding
 * `CompilerWorkbench` can swap them based on `activeStageId`. All wiring goes
 * through the same `onSave` / `onAccept` / `onGenerateIntent` callbacks
 * produced by `useStudyDesignWorkbench`.
 *
 * Visual contract: docs/commons/mockups/studies-design-workbench-v2.html
 * (PICO Canvas SVG block — geometry, provenance dots, focused-Outcome treatment).
 *
 * The body is split across siblings to keep each file under the project's
 * 500-LOC rule:
 *   - PicoCanvas.tsx            — this file: main + empty state
 *   - PicoPopulatedState.tsx    — populated wrapper, edit state, action bar
 *   - PicoSvg.tsx               — SVG geometry (frames, arrow, time-at-risk)
 *   - PicoNode.tsx              — individual editable node + provenance dot
 *   - picoHelpers.ts            — types, NODE_META, provenance computation
 */

interface PicoCanvasProps {
  session: StudyDesignSession | null;
  version: StudyDesignVersion | null;
  assistance: IntentReviewAssistance | null;
  initialFormState: IntentFormState | null;
  onSave: (state: IntentFormState) => void;
  onAccept: () => void;
  onGenerateIntent?: (researchQuestion: string) => void;
  /** Reports unsaved-edit state up to the workbench so version/session
   *  switches can prompt for confirm. Forwarded to PicoPopulatedState. */
  onDirtyChange?: (dirty: boolean) => void;
  isSaving?: boolean;
  isAccepting?: boolean;
  isGenerating?: boolean;
  generationGate?: string | null;
}

export function PicoCanvas({
  session,
  version,
  assistance,
  initialFormState,
  onSave,
  onAccept,
  onGenerateIntent,
  onDirtyChange,
  isSaving = false,
  isAccepting = false,
  isGenerating = false,
  generationGate = null,
}: PicoCanvasProps) {
  // Empty state — no version yet OR no session yet.
  if (!version || !initialFormState || !session) {
    return (
      <PicoEmptyState
        onGenerateIntent={onGenerateIntent}
        isGenerating={isGenerating}
        generationGate={generationGate}
      />
    );
  }

  return (
    <PicoPopulatedState
      version={version}
      assistance={assistance}
      initialFormState={initialFormState}
      onSave={onSave}
      onAccept={onAccept}
      onDirtyChange={onDirtyChange}
      isSaving={isSaving}
      isAccepting={isAccepting}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state — focused research-question entry
// ---------------------------------------------------------------------------

interface PicoEmptyStateProps {
  onGenerateIntent?: (researchQuestion: string) => void;
  isGenerating: boolean;
  generationGate: string | null;
}

function PicoEmptyState({
  onGenerateIntent,
  isGenerating,
  generationGate,
}: PicoEmptyStateProps) {
  const { t } = useTranslation("app");
  const [researchQuestion, setResearchQuestion] = useState("");
  const trimmed = researchQuestion.trim();
  const disabled = trimmed.length === 0 || isGenerating || generationGate !== null;

  const handleGenerate = () => {
    if (disabled || !onGenerateIntent) return;
    onGenerateIntent(trimmed);
  };

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-raised p-5">
      <div>
        <div className="text-sm font-semibold text-text-primary">
          {tAuto("studies.v2.pico.startTitle")}{" "}
          <span className="font-normal text-text-secondary">
            {tAuto("studies.v2.pico.startSubtitle")}
          </span>
        </div>
      </div>

      <div className="text-xs text-text-muted">
        {tAuto("studies.v2.pico.uploadHint")}
      </div>

      <div className="text-xs text-text-muted">
        {t("studies.workbench.researchQuestion")}
      </div>

      <textarea
        className="w-full resize-none rounded-lg border border-border-default bg-surface-base px-4 py-2.5 text-[13px] text-text-secondary placeholder:text-text-ghost outline-none transition-colors focus:border-accent"
        rows={5}
        value={researchQuestion}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          setResearchQuestion(event.target.value)
        }
        placeholder={t("studies.workbench.researchQuestionPlaceholder")}
        aria-label={t("studies.workbench.researchQuestion")}
      />

      <div className="flex flex-col items-start gap-2.5">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-base transition-colors hover:bg-accent-light disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-ghost"
          onClick={handleGenerate}
          disabled={disabled}
          aria-disabled={disabled}
          title={generationGate ?? undefined}
        >
          {isGenerating ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={13} aria-hidden="true" />
          )}
          {t("studies.workbench.actions.generateIntent")}
        </button>
        <ActionGateHint message={generationGate} />
      </div>
    </div>
  );
}
