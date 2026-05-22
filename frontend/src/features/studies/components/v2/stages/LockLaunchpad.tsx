import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Lock } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import {
  buildPreflightItems,
  hasOpenQuestions,
  isReadyToLock,
  type PreflightItem,
} from "./lockHelpers";
import {
  buildManifestNodes,
  buildProvenanceFields,
  manifestPreviewFromReadiness,
} from "./lockProvenance";
import {
  LockedReadOnlyView,
  PreflightRow,
  ProvenanceList,
} from "./LockLaunchpadParts";

// Station 07 — Lock. The ceremonial moment.
//
// Renders a preflight checklist driven by `lockHelpers.buildPreflightItems`,
// a manifest preview + provenance card pair, and a two-button action footer.
// On successful lock-mutation the lock CTA enters a `stamping` phase
// (800 ms minimum), after which the workbench advances to station 08.

type Workbench = ReturnType<typeof useStudyDesignWorkbench>;

interface LockLaunchpadProps {
  workbench: Pick<
    Workbench,
    | "assets"
    | "lockReadinessQuery"
    | "selectedSession"
    | "selectedVersion"
    | "handleLockVersionRequest"
    | "handleConfirmLock"
    | "lockDesignVersion"
    | "lockGateMessage"
    | "lockConfirmOpen"
    | "setLockConfirmOpen"
  >;
  /** Study title for the headline. */
  studyTitle: string;
  /** Invoked when the user requests to navigate to a specific station. */
  onNavigateStation: (stationId: "01" | "02" | "03" | "04" | "05" | "06" | "08") => void;
}

type SealPhase = "idle" | "stamping" | "done";

export function LockLaunchpad({
  workbench,
  studyTitle,
  onNavigateStation,
}: LockLaunchpadProps): JSX.Element {
  const { t } = useTranslation("app");
  const {
    assets,
    lockReadinessQuery,
    selectedSession,
    selectedVersion,
    handleLockVersionRequest,
    handleConfirmLock,
    lockDesignVersion,
    lockGateMessage,
    lockConfirmOpen,
    setLockConfirmOpen,
  } = workbench;

  const readiness = lockReadinessQuery.data ?? null;
  const isLockedVersion = String(selectedVersion?.status ?? "").toLowerCase() === "locked"
    || selectedVersion?.locked_at != null;

  const preflightItems = useMemo(
    () => buildPreflightItems(selectedVersion, assets, readiness),
    [selectedVersion, assets, readiness],
  );
  const provenance = useMemo(
    () => buildProvenanceFields(selectedVersion, assets, readiness),
    [selectedVersion, assets, readiness],
  );
  const manifestNodes = useMemo(
    () => buildManifestNodes(selectedVersion, manifestPreviewFromReadiness(readiness), assets),
    [selectedVersion, readiness, assets],
  );

  // Use the "previous value" render-time comparison pattern (endorsed by
  // React docs) to reset local state when the relevant props change.
  // Storing prev values in useState avoids both the setState-in-effect and
  // refs-during-render lint rules.
  const [prevVersionId, setPrevVersionId] = useState<number | null>(
    selectedVersion?.id ?? null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [sealPhase, setSealPhase] = useState<SealPhase>("idle");

  if (prevVersionId !== (selectedVersion?.id ?? null)) {
    setPrevVersionId(selectedVersion?.id ?? null);
    if (acknowledged) setAcknowledged(false);
    if (sealPhase !== "idle") setSealPhase("idle");
  }

  const [prevGateMessage, setPrevGateMessage] = useState<string | null>(lockGateMessage);
  if (prevGateMessage !== lockGateMessage) {
    setPrevGateMessage(lockGateMessage);
    // If the gate refused the lock (gate message appeared while the CTA was
    // mid-stamp but the confirm dialog never opened), rewind so the CTA
    // returns to its idle visual state.
    if (
      lockGateMessage != null
      && sealPhase === "stamping"
      && !lockConfirmOpen
    ) {
      setSealPhase("idle");
    }
  }

  const openQuestions = hasOpenQuestions(preflightItems);
  const { ready, needsAcknowledge } = isReadyToLock(preflightItems, acknowledged);
  const canSubmitLock = ready && selectedSession != null && selectedVersion != null && !isLockedVersion;

  // Lock animation choreography:
  //
  //   1. User clicks Lock CTA → handleLockVersionRequest checks readiness;
  //      if OK, the hook flips lockConfirmOpen=true.
  //   2. We render an explicit "Confirm Lock" Modal (v1 fidelity — locking
  //      is irreversible, the user must confirm with full context).
  //   3. User clicks Confirm in the Modal → setSealPhase("stamping") +
  //      handleConfirmLock fires the mutation. The wax-seal animation
  //      begins as visual feedback for the in-flight mutation.
  //   4. Effect (B) sees lockDesignVersion.isSuccess + sealPhase="stamping",
  //      waits out the minimum 800 ms wax-seal duration, then advances to
  //      station 08.
  //   5. Effect (C) sees lockDesignVersion.isError + sealPhase="stamping"
  //      and rewinds via render-time prev-value pattern.
  //   6. User clicks Cancel in the Modal → setLockConfirmOpen(false) →
  //      seal stays idle (it was never started).
  //
  // The prev-gate-message render-time check above also catches the case
  // where the gate refuses BEFORE the Modal opens.
  const sealStartedAtRef = useRef<number | null>(null);

  // (B) mutation success → hold for minimum animation duration, then advance
  useEffect(() => {
    if (!lockDesignVersion.isSuccess || sealPhase !== "stamping") return;
    const startedAt = sealStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 800 - elapsed);
    const timer = window.setTimeout(() => {
      setSealPhase("done");
      sealStartedAtRef.current = null;
      onNavigateStation("08");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [lockDesignVersion.isSuccess, sealPhase, onNavigateStation]);

  // (C) mutation error → rewind the seal. Use the render-time prev-value
  // comparison pattern (consistent with prevGateMessage above) to avoid
  // the react-hooks/set-state-in-effect lint rule. The stale ref value is
  // overwritten by the next `lockClicked` so we don't need to clear it here.
  const [prevIsError, setPrevIsError] = useState(lockDesignVersion.isError);
  if (prevIsError !== lockDesignVersion.isError) {
    setPrevIsError(lockDesignVersion.isError);
    if (lockDesignVersion.isError && sealPhase === "stamping") {
      setSealPhase("idle");
    }
  }

  if (isLockedVersion) {
    return (
      <LockedReadOnlyView
        preflightItems={preflightItems}
        manifestNodes={manifestNodes}
        provenance={provenance}
        studyTitle={studyTitle}
        version={selectedVersion}
        onNavigateStation={onNavigateStation}
      />
    );
  }

  const handlePreflightResolve = (
    target: NonNullable<PreflightItem["resolveStationId"]> | "notes",
  ): void => {
    if (target === "notes") {
      // Notes lives on the peripheral rail (Phase 6 wires it). For now route
      // back to the Intent station which exposes the most context.
      onNavigateStation("01");
      return;
    }
    onNavigateStation(target);
  };

  // First click on the Lock CTA — does NOT start the seal animation yet.
  // The wax-seal only fires after the user clicks Confirm in the Modal.
  const lockClicked = (): void => {
    if (!canSubmitLock || sealPhase !== "idle" || lockDesignVersion.isPending) return;
    void handleLockVersionRequest();
  };

  // User clicked Confirm in the Modal — now fire the mutation and start
  // the seal animation. The Modal stays open during the mutation; it closes
  // automatically when the hook's onSuccess/onError callbacks resolve.
  const handleUserConfirmLock = (): void => {
    if (lockDesignVersion.isPending || sealPhase !== "idle") return;
    sealStartedAtRef.current = Date.now();
    setSealPhase("stamping");
    handleConfirmLock();
  };

  // User clicked Cancel in the Modal — close it; seal never started.
  const handleUserCancelLock = (): void => {
    if (lockDesignVersion.isPending) return;
    setLockConfirmOpen(false);
  };

  const acknowledgeClicked = (): void => {
    if (!openQuestions) return;
    setAcknowledged(true);
  };

  const lockGate = !selectedSession || !selectedVersion
    ? tAuto("studies.v2.lock.gate.noVersion")
    : !ready
      ? needsAcknowledge
        ? tAuto("studies.v2.lock.gate.acknowledgeFirst")
        : tAuto("studies.v2.lock.gate.unresolved")
      : null;

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header — no eyebrow, no serif */}
      <header className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-text-primary m-0">
          {tAuto("studies.v2.lock.title", { title: studyTitle })}
        </h2>
        <p className="text-xs text-text-muted m-0">
          {tAuto("studies.v2.lock.headerProse")}
        </p>
      </header>

      {/* Preflight checklist */}
      <section
        className="rounded-lg border border-border-default bg-surface-raised p-4 flex flex-col gap-2"
        aria-label={tAuto("studies.v2.lock.preflightAria")}
      >
        <div className="text-xs font-semibold text-text-muted uppercase tracking-[0.12em] pb-1.5 border-b border-border-default">
          {tAuto("studies.v2.lock.preflightTitle")}
        </div>
        <ul className="list-none m-0 p-0 flex flex-col">
          {preflightItems.map((item) => (
            <PreflightRow
              key={item.id}
              item={item}
              onResolve={handlePreflightResolve}
            />
          ))}
        </ul>
        {lockGateMessage ? (
          <div
            className="mt-1.5 rounded px-3 py-2 text-xs text-warning bg-warning/5 border border-warning/30 tracking-[0.02em]"
            role="status"
          >
            {lockGateMessage}
          </div>
        ) : null}
      </section>

      {/* Manifest + Provenance */}
      <section
        className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3"
        aria-label={tAuto("studies.v2.lock.previewAria")}
      >
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 flex flex-col gap-3 min-w-0">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-[0.12em]">
            {tAuto("studies.v2.lock.manifestTitle")}
          </div>
          <pre
            className="m-0 p-2.5 rounded bg-surface-base border border-border-default text-xs text-text-primary leading-relaxed tracking-[0.02em] flex flex-col overflow-x-auto whitespace-pre"
            aria-label={tAuto("studies.v2.lock.manifestAria")}
          >
            {manifestNodes.map((node) => (
              <span
                key={node.label}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-baseline"
              >
                <span className="text-text-primary">{node.label}</span>
                {node.meta ? (
                  <span className="text-[10px] uppercase tracking-[0.06em] text-text-ghost whitespace-nowrap">
                    {node.meta}
                  </span>
                ) : null}
              </span>
            ))}
          </pre>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 flex flex-col gap-3 min-w-0">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-[0.12em]">
            {tAuto("studies.v2.lock.provenanceTitle")}
          </div>
          <ProvenanceList provenance={provenance} />
        </div>
      </section>

      {/* Action footer */}
      <footer className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
            acknowledged
              ? "border-success/40 text-success hover:text-success"
              : "text-text-muted hover:text-text-secondary",
          )}
          onClick={acknowledgeClicked}
          disabled={!openQuestions || acknowledged}
          title={
            !openQuestions
              ? tAuto("studies.v2.lock.acknowledgeDisabled")
              : acknowledged
                ? tAuto("studies.v2.lock.acknowledgedTitle")
                : tAuto("studies.v2.lock.acknowledgeTitle")
          }
        >
          {acknowledged
            ? tAuto("studies.v2.lock.acknowledged")
            : tAuto("studies.v2.lock.acknowledgeOpenQuestions")}
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
            canSubmitLock && sealPhase === "idle" && !lockDesignVersion.isPending
              ? "bg-accent text-surface-base hover:bg-accent-light"
              : "cursor-not-allowed bg-surface-elevated text-text-ghost",
            sealPhase === "stamping" && "opacity-75",
          )}
          onClick={lockClicked}
          disabled={!canSubmitLock || lockDesignVersion.isPending || sealPhase !== "idle"}
          title={lockGate ?? undefined}
          aria-label={tAuto("studies.v2.lock.lockAndPackageAria")}
        >
          <Lock size={14} aria-hidden="true" />
          <span>
            {tAuto("studies.v2.lock.lockAndPackage")}
          </span>
        </button>
      </footer>

      {/* Explicit confirm Modal — preserves v1 fidelity. Locking is
          irreversible; the user must explicitly confirm before the mutation
          fires. The wax-seal animation begins only after Confirm is clicked. */}
      <Modal
        open={lockConfirmOpen}
        onClose={handleUserCancelLock}
        title={t("studies.workbench.lockConfirm.title")}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={lockDesignVersion.isPending}
              onClick={handleUserCancelLock}
            >
              {t("studies.workbench.actions.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={lockDesignVersion.isPending}
              onClick={handleUserConfirmLock}
            >
              {lockDesignVersion.isPending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Lock size={14} aria-hidden="true" />
              )}
              {t("studies.workbench.lockConfirm.confirm")}
            </button>
          </div>
        }
      >
        {/* M1 — defensive null guard. canSubmitLock requires selectedVersion
            != null, but lockConfirmOpen could in principle race against a
            versions refetch that drops selectedVersion to null. In that
            case render a "no version" placeholder rather than interpolating
            empty strings into the confirm body. */}
        {selectedVersion ? (
          <p className="text-sm text-text-primary">
            {t("studies.workbench.lockConfirm.body", {
              version: selectedVersion.version_number,
              updatedAt: selectedVersion.updated_at ?? "",
            })}
          </p>
        ) : (
          <p className="text-sm text-text-muted">
            {tAuto("studies.v2.lock.noVersionSelected")}
          </p>
        )}
        <p className="mt-2 text-xs text-warning">
          {t("studies.workbench.lockConfirm.irreversibleWarning")}
        </p>
      </Modal>
    </div>
  );
}
