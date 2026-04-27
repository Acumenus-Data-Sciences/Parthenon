import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  StudyDesignVersion,
} from "../../types/study";
import { ActionGateHint } from "./shared/ActionGateHint";
import { Field } from "./shared/Field";
import {
  type IntentFormState,
} from "./studyDesignWorkbenchHelpers";
import {
  buildIntentReviewAssistance,
  type IntentReviewAssistance,
  type IntentReviewEvidenceSpan,
  type IntentReviewSuggestion,
} from "../studyDesignIntentAssistance";

export function IntentReviewPanel({
  version,
  initialFormState,
  onSave,
  onAccept,
  isSaving,
  isAccepting,
  onDirtyChange,
}: {
  version: StudyDesignVersion;
  initialFormState: IntentFormState;
  onSave: (state: IntentFormState) => void;
  onAccept: () => void;
  isSaving: boolean;
  isAccepting: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation("app");
  const [formState, setFormState] = useState(initialFormState);
  // Baseline re-anchors when version.updated_at increments (after parent's
  // update mutation invalidates+refetches). React docs: "Storing information
  // from previous renders" — track prev prop in state, update during render.
  const [baselineFormState, setBaselineFormState] = useState(initialFormState);
  const [trackedUpdatedAt, setTrackedUpdatedAt] = useState(version.updated_at);
  if (trackedUpdatedAt !== version.updated_at) {
    setTrackedUpdatedAt(version.updated_at);
    if (JSON.stringify(baselineFormState) !== JSON.stringify(formState)) {
      setBaselineFormState(formState);
    }
  }
  const isDirty = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(baselineFormState),
    [formState, baselineFormState],
  );
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  const lint = version.lint_results_json ?? null;
  const isImmutable = ["accepted", "compiled", "locked"].includes(version.status);
  const lintIssues = lint?.issues ?? [];
  const isReady = lint?.status === "ready" || version.status === "review_ready";
  const saveGate = isImmutable
    ? "Accepted or locked intents cannot be edited in this version."
    : null;
  const acceptGate = isImmutable
    ? "This intent has already been accepted or locked."
    : !isReady
      ? "Resolve Abby Review blockers before accepting intent."
      : null;
  const intentAssistance = useMemo(
    () => buildIntentReviewAssistance(version, formState),
    [formState, version],
  );

  const applySuggestion = (suggestion: IntentReviewSuggestion) => {
    if (isImmutable || !suggestion.draftValue) return;
    setFormState((current) => ({
      ...current,
      [suggestion.fieldKey]: suggestion.draftValue,
    }));
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.intentReview")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.labels.versionStatus", {
              version: version.version_number,
              status: version.status,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(formState)}
            disabled={isSaving || isImmutable}
            title={saveGate ?? undefined}
            className="btn btn-ghost btn-sm"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t("studies.workbench.actions.saveReview")}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting || isImmutable || !isReady}
            title={acceptGate ?? undefined}
            className="btn btn-primary btn-sm"
          >
            {isAccepting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {t("studies.workbench.actions.acceptIntent")}
          </button>
        </div>
      </div>

      <ActionGateHint message={acceptGate} />

      <IntentReviewAssistancePanel
        assistance={intentAssistance}
        disabled={isImmutable}
        onApplySuggestion={applySuggestion}
      />

      {lintIssues.length > 0 && (
        <div className="space-y-2">
          {lintIssues.map((issue, index) => (
            <div
              key={`${issue.field ?? "issue"}-${index}`}
              className={cn(
                "flex gap-2 rounded-md border px-3 py-2 text-sm",
                issue.severity === "blocking"
                  ? "border-critical/40 bg-critical/10 text-critical"
                  : "border-warning/40 bg-warning/10 text-warning",
              )}
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label={t("studies.workbench.researchQuestion")} value={formState.researchQuestion} onChange={(value) => setFormState({ ...formState, researchQuestion: value })} />
        </div>
        <Field label={t("studies.workbench.labels.primaryObjective")} value={formState.primaryObjective} onChange={(value) => setFormState({ ...formState, primaryObjective: value })} />
        <Field label={t("studies.workbench.labels.population")} value={formState.population} onChange={(value) => setFormState({ ...formState, population: value })} />
        <Field label={t("studies.workbench.labels.exposure")} value={formState.exposure} onChange={(value) => setFormState({ ...formState, exposure: value })} />
        <Field label={t("studies.workbench.labels.comparator")} value={formState.comparator} onChange={(value) => setFormState({ ...formState, comparator: value })} />
        <Field label={t("studies.workbench.labels.primaryOutcome")} value={formState.outcome} onChange={(value) => setFormState({ ...formState, outcome: value })} />
        <Field label={t("studies.workbench.labels.timeAtRisk")} value={formState.time} onChange={(value) => setFormState({ ...formState, time: value })} />
      </div>
    </div>
  );
}

function IntentReviewAssistancePanel({
  assistance,
  disabled,
  onApplySuggestion,
}: {
  assistance: IntentReviewAssistance;
  disabled: boolean;
  onApplySuggestion: (suggestion: IntentReviewSuggestion) => void;
}) {
  const concerns = [...assistance.missingFields, ...assistance.weakFields];
  const sourceParts = protocolSourceParts(assistance);
  const suggestions = assistance.suggestions.slice(0, 7);
  const evidenceSpans = assistance.evidenceSpans.slice(0, 4);
  const noteGroups = [
    { label: "Open questions", notes: assistance.openQuestions },
    { label: "Risk notes", notes: assistance.riskNotes },
    { label: "Uncertainty", notes: assistance.uncertaintyNotes },
    { label: "Design assumptions", notes: assistance.designAssumptions },
  ].filter((group) => group.notes.length > 0);

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        assistance.status === "ready"
          ? "border-success/30 bg-success/5"
          : "border-warning/40 bg-warning/10",
      )}
    >
      <div className="flex items-start gap-2">
        {assistance.status === "ready"
          ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
          : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-secondary">Abby Review</p>
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
              assistance.status === "ready"
                ? "border-success/40 text-success"
                : "border-warning/50 text-warning",
            )}>
              {assistance.status === "ready" ? "Ready" : "Needs review"}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">{assistance.summary}</p>
        </div>
      </div>

      {sourceParts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
          {sourceParts.map((part) => (
            <span key={part} className="rounded-full border border-border-default bg-surface-base px-2 py-1">
              {part}
            </span>
          ))}
        </div>
      )}

      {concerns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {concerns.map((concern) => (
            <span
              key={`${concern.fieldKey}-${concern.message}`}
              className="rounded-full border border-warning/50 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning"
              title={concern.message}
            >
              {concern.fieldLabel}
            </span>
          ))}
        </div>
      )}

      {assistance.protocolSource?.truncated && (
        <p className="mt-3 flex gap-2 text-xs text-warning">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Protocol text was shortened for evaluation. Verify late-document eligibility, outcomes, and safety sections before accepting.</span>
        </p>
      )}

      {(evidenceSpans.length > 0 || hasConfidence(assistance)) && (
        <IntentReviewEvidenceSummary
          confidence={assistance.confidence}
          evidenceSpans={evidenceSpans}
        />
      )}

      {noteGroups.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {noteGroups.map((group) => (
            <ReviewNoteGroup key={group.label} label={group.label} notes={group.notes} />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map((suggestion) => (
            <div
              key={`${suggestion.fieldKey}-${suggestion.action}`}
              className="rounded-md border border-border-default bg-surface-base px-3 py-2"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-secondary">{suggestion.fieldLabel}</p>
                  <p className="mt-1 text-xs text-text-muted">{suggestion.action}</p>
                  {suggestion.draftValue && (
                    <p className="mt-1 text-[11px] text-text-ghost">{suggestion.draftValue}</p>
                  )}
                </div>
                {suggestion.draftValue && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onApplySuggestion(suggestion)}
                    className="btn btn-ghost btn-sm shrink-0"
                  >
                    <Sparkles size={12} />
                    Use wording
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntentReviewEvidenceSummary({
  confidence,
  evidenceSpans,
}: {
  confidence: IntentReviewAssistance["confidence"];
  evidenceSpans: IntentReviewEvidenceSpan[];
}) {
  const fieldConfidence = confidence.fields.slice(0, 6);

  return (
    <div className="mt-3 rounded-md border border-border-default bg-surface-base px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-text-secondary">Evidence and confidence</p>
        {confidence.overall !== undefined && (
          <span className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            confidence.overall >= 0.75
              ? "border-success/40 text-success"
              : confidence.overall >= 0.5
                ? "border-warning/50 text-warning"
                : "border-critical/40 text-critical",
          )}>
            Overall {formatConfidence(confidence.overall)}
          </span>
        )}
      </div>

      {fieldConfidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fieldConfidence.map((field) => (
            <span
              key={field.fieldKey}
              className="rounded-full border border-border-default bg-surface-overlay/30 px-2 py-0.5 text-[11px] text-text-muted"
            >
              {field.fieldLabel} {formatConfidence(field.confidence)}
            </span>
          ))}
        </div>
      )}

      {evidenceSpans.length > 0 && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {evidenceSpans.map((span, index) => (
            <div
              key={`${span.fieldLabel}-${index}`}
              className="rounded-md border border-border-subtle bg-surface-overlay/30 px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-text-secondary">{span.fieldLabel}</span>
                {span.confidence !== undefined && (
                  <span className="rounded-full border border-border-default px-1.5 py-0.5 text-[10px] text-text-muted">
                    {formatConfidence(span.confidence)}
                  </span>
                )}
                {span.section && (
                  <span className="text-[10px] text-text-ghost">{span.section}</span>
                )}
                {span.page && (
                  <span className="text-[10px] text-text-ghost">p. {span.page}</span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">{span.quote}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewNoteGroup({ label, notes }: { label: string; notes: string[] }) {
  return (
    <div className="rounded-md border border-border-default bg-surface-base px-3 py-2">
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <ul className="mt-1 space-y-1 text-xs text-text-muted">
        {notes.slice(0, 3).map((note, index) => (
          <li key={`${label}-${index}`}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function hasConfidence(assistance: IntentReviewAssistance): boolean {
  return assistance.confidence.overall !== undefined || assistance.confidence.fields.length > 0;
}

function formatConfidence(value: number): string {
  const percent = value <= 1 ? value * 100 : value;

  return `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
}

function protocolSourceParts(assistance: IntentReviewAssistance): string[] {
  const source = assistance.protocolSource;
  if (!source) return [];

  return [
    source.filename ? `Protocol: ${source.filename}` : "",
    source.textLength ? `${source.textLength.toLocaleString()} chars reviewed` : "",
  ].filter(Boolean);
}
