import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import { ActionGateHint } from "../../workbench/shared/ActionGateHint";
import type { IntentFormState } from "../../workbench/studyDesignWorkbenchHelpers";
import type { IntentReviewAssistance } from "../../studyDesignIntentAssistance";
import type { StudyDesignVersion } from "../../../types/study";
import {
  NODE_META,
  buildProvenanceMap,
  clamp,
  type NodeId,
} from "./picoHelpers";
import { PicoSvg } from "./PicoSvg";

interface PicoPopulatedStateProps {
  version: StudyDesignVersion;
  assistance: IntentReviewAssistance | null;
  initialFormState: IntentFormState;
  onSave: (state: IntentFormState) => void;
  onAccept: () => void;
  /** Reports unsaved-edit state up to the workbench so version/session
   *  switches can prompt for confirm. Mirrors IntentReviewPanel's contract. */
  onDirtyChange?: (dirty: boolean) => void;
  isSaving: boolean;
  isAccepting: boolean;
}

export function PicoPopulatedState({
  version,
  assistance,
  initialFormState,
  onSave,
  onAccept,
  onDirtyChange,
  isSaving,
  isAccepting,
}: PicoPopulatedStateProps) {
  const { t } = useTranslation("app");

  const [formState, setFormState] = useState<IntentFormState>(initialFormState);
  // Re-anchor baseline when the version's updated_at changes (after parent's
  // save mutation invalidates+refetches). Mirrors IntentReviewPanel's narrower
  // pattern: only reset formState if it MATCHES the previous baseline (i.e.
  // the user wasn't editing). Otherwise keep their in-flight edits and just
  // bump the baseline so subsequent dirty checks measure against the
  // server-confirmed value. Prevents the type-fast-then-save race where the
  // user's keystrokes after Save fire would otherwise be discarded.
  const [baselineFormState, setBaselineFormState] =
    useState<IntentFormState>(initialFormState);
  const [trackedUpdatedAt, setTrackedUpdatedAt] = useState(version.updated_at);
  if (trackedUpdatedAt !== version.updated_at) {
    setTrackedUpdatedAt(version.updated_at);
    const formMatchesBaseline = JSON.stringify(formState) === JSON.stringify(baselineFormState);
    setBaselineFormState(initialFormState);
    if (formMatchesBaseline) {
      setFormState(initialFormState);
    }
  }

  const isDirty = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(baselineFormState),
    [formState, baselineFormState],
  );
  // Report dirty state back to the workbench so version/session switches can
  // prompt for confirm via window.confirm("Discard edits?"). Matches v1.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  const isImmutable = ["accepted", "compiled", "locked"].includes(version.status);
  const lintIssues = version.lint_results_json?.issues ?? [];
  const blockingLint = lintIssues.filter((issue) => issue.severity === "blocking");
  const isLintReady = blockingLint.length === 0;

  const acceptGate = isImmutable
    ? tAuto("studies.v2.pico.gate.alreadyAccepted")
    : !isLintReady
      ? tAuto("studies.v2.pico.gate.resolveBlockers")
      : isDirty
        ? tAuto("studies.v2.pico.gate.saveFirst")
        : null;

  // Default focus: Outcome if present, else Exposure, else Population.
  const initialFocus: NodeId = formState.outcome
    ? "outcome"
    : formState.exposure
      ? "exposure"
      : "population";
  const [focusedNode, setFocusedNode] = useState<NodeId>(initialFocus);

  // Per-node inline edit state. When a node is in edit mode, we render a
  // foreignObject input inside its SVG group and the unsaved value lives here
  // until Enter / blur commits it back to formState.
  const [editingNode, setEditingNode] = useState<NodeId | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const beginEdit = (node: NodeId) => {
    if (isImmutable) return;
    setFocusedNode(node);
    const currentValue = formState[NODE_META[node].formKey];
    setEditValue(currentValue);
    setEditingNode(node);
  };

  const commitEdit = () => {
    if (editingNode === null) return;
    const key = NODE_META[editingNode].formKey;
    setFormState((current) => ({ ...current, [key]: editValue }));
    setEditingNode(null);
  };

  const cancelEdit = () => {
    setEditingNode(null);
  };

  const handleEditKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  const handleDiscard = () => {
    setFormState(baselineFormState);
    setEditingNode(null);
  };

  const handleSave = () => {
    if (isSaving || isImmutable) return;
    onSave(formState);
  };

  const handleAccept = () => {
    if (isAccepting || isImmutable || !isLintReady || isDirty) return;
    onAccept();
  };

  // Provenance tone per node — derived from assistance.
  const provenance = useMemo(
    () => buildProvenanceMap(assistance, formState),
    [assistance, formState],
  );

  const versionStatus = (version.status || "review").toString();
  const versionLabel = `v${version.version_number} · ${versionStatus}`;
  const nextVersionNumber = version.version_number + 1;
  const openQuestionsCount = assistance?.openQuestions?.length ?? 0;
  const blockerCount = blockingLint.length + openQuestionsCount;
  const populationSummary = formState.population.trim();

  return (
    <div className="pico-canvas-card">
      <div className="pico-canvas-head">
        <div>
          <div className="pico-canvas-title wb-serif">
            {tAuto("studies.v2.pico.title")}
            <em>{tAuto("studies.v2.pico.titleSubtitle")}</em>
          </div>
        </div>
        <div className="pico-canvas-meta wb-mono">stage 01 · intent</div>
      </div>

      <PicoSvg
        formState={formState}
        focusedNode={focusedNode}
        editingNode={editingNode}
        editValue={editValue}
        provenance={provenance}
        immutable={isImmutable}
        onFocusNode={setFocusedNode}
        onBeginEdit={beginEdit}
        onChangeEdit={setEditValue}
        onCommitEdit={commitEdit}
        onEditKey={handleEditKey}
      />

      <div className="pico-substrip">
        <span
          className="pico-substrip-pop wb-serif"
          title={populationSummary || undefined}
        >
          <span className="pico-substrip-label wb-mono">
            {NODE_META.population.eyebrow}
          </span>
          {populationSummary
            ? clamp(populationSummary, 96)
            : tAuto("studies.v2.pico.populationUnset")}
        </span>
        {blockerCount > 0 ? (
          <span className="pico-substrip-blockers wb-mono">
            {blockingLint.length}&nbsp;lint · {openQuestionsCount}&nbsp;open questions
          </span>
        ) : (
          <span className="pico-substrip-blockers wb-mono">no blockers</span>
        )}
      </div>

      <div className="pico-action-bar" aria-label={tAuto("studies.v2.pico.actionBar")}>
        <div className="pab-left">
          <span className="pab-status wb-mono">{versionLabel}</span>
          <span className="pab-meta">
            {isDirty
              ? tAuto("studies.v2.pico.unsaved")
              : tAuto("studies.v2.pico.allSynced")}
            {blockerCount > 0
              ? ` · ${blockerCount} ${tAuto("studies.v2.pico.blockersOutstanding")}`
              : null}
          </span>
        </div>
        <div className="pab-right">
          <button
            type="button"
            className="btn-ghost"
            onClick={handleDiscard}
            disabled={!isDirty || isImmutable}
          >
            {t("studies.workbench.actions.discardEdits")}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleSave}
            disabled={isSaving || isImmutable || !isDirty}
          >
            {isSaving ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={13} aria-hidden="true" />
            )}
            {t("studies.workbench.actions.saveReview")}
          </button>
          <button
            type="button"
            className={cn("btn-accept", acceptGate && "gated")}
            onClick={handleAccept}
            disabled={isAccepting || acceptGate !== null}
            aria-disabled={acceptGate !== null}
            title={acceptGate ?? undefined}
          >
            {isAccepting ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={13} aria-hidden="true" />
            )}
            {tAuto("studies.v2.pico.acceptVersion", { v: nextVersionNumber })}
          </button>
        </div>
      </div>
      <ActionGateHint message={acceptGate} />
    </div>
  );
}
