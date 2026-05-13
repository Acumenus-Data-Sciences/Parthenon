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
    <div className="pico-canvas-card pico-empty">
      <div className="pico-canvas-head">
        <div>
          <div className="pico-canvas-title wb-serif">
            {tAuto("studies.v2.pico.startTitle")}
            <em>{tAuto("studies.v2.pico.startSubtitle")}</em>
          </div>
        </div>
        <div className="pico-canvas-meta wb-mono">stage 01 · intent</div>
      </div>

      <div className="pico-empty-hint wb-mono">
        {tAuto("studies.v2.pico.uploadHint")}
      </div>

      <div className="pico-empty-eyebrow wb-mono">
        {t("studies.workbench.researchQuestion")}
      </div>

      <textarea
        className="pico-empty-textarea"
        rows={5}
        value={researchQuestion}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          setResearchQuestion(event.target.value)
        }
        placeholder={t("studies.workbench.researchQuestionPlaceholder")}
        aria-label={t("studies.workbench.researchQuestion")}
      />

      <div className="pico-empty-actions">
        <button
          type="button"
          className="btn-accept"
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
