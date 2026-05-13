import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import { cn } from "@/lib/utils";
import type {
  StudyDesignAsset,
  StudyDesignLockReadiness,
  StudyDesignManifestPreview,
  StudyDesignSession,
  StudyDesignVersion,
} from "../../../types/study";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import {
  buildPreflightItems,
  hasOpenQuestions,
  isReadyToLock,
  type PreflightItem,
  type PreflightStatus,
} from "./lockHelpers";
import {
  buildManifestNodes,
  buildProvenanceFields,
} from "./lockProvenance";

// Station 07 — Lock. The ceremonial moment.
//
// Renders a preflight checklist driven by `lockHelpers.buildPreflightItems`,
// a manifest preview + provenance card pair, and a two-button action footer.
// On successful lock-mutation the crimson CTA morphs into a 64×64 wax seal
// via the `lock-cta.stamping` modifier (CSS keyframe, 800 ms), after which
// the workbench advances to station 08.

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
  >;
  /** Study title for the headline. */
  studyTitle: string;
  /** Invoked when the user requests to navigate to a specific station. */
  onNavigateStation: (stationId: "01" | "02" | "03" | "04" | "05" | "06" | "08") => void;
}

type SealPhase = "idle" | "stamping" | "done";

function statusGlyph(status: PreflightStatus): string {
  if (status === "satisfied") return "✓";
  if (status === "warning") return "⚠";
  return "—";
}

function PreflightRow({
  item,
  onResolve,
}: {
  item: PreflightItem;
  onResolve: (target: NonNullable<PreflightItem["resolveStationId"]> | "notes") => void;
}): JSX.Element {
  const showResolve =
    item.status === "warning"
    && (item.resolveStationId != null || item.notesDeepLink === true);
  return (
    <li
      className={cn("lock-preflight-row", item.status)}
      aria-label={tAuto("studies.v2.lock.preflightRowAria", { label: item.label })}
    >
      <span
        className={cn("lock-preflight-status", item.status)}
        aria-hidden="true"
      >
        {statusGlyph(item.status)}
      </span>
      <div className="lock-preflight-text">
        <div className="lock-preflight-label wb-serif">{item.label}</div>
        <div className="lock-preflight-desc wb-mono">{item.description}</div>
      </div>
      {showResolve ? (
        <button
          type="button"
          className="btn-ghost lock-preflight-resolve"
          onClick={() => {
            if (item.notesDeepLink === true) {
              onResolve("notes");
              return;
            }
            if (item.resolveStationId) onResolve(item.resolveStationId);
          }}
        >
          {item.notesDeepLink === true
            ? tAuto("studies.v2.lock.viewNotes")
            : tAuto("studies.v2.lock.resolve")}
        </button>
      ) : null}
    </li>
  );
}

function selectManifestPreview(
  readiness: StudyDesignLockReadiness | null,
): StudyDesignManifestPreview | null {
  return readiness?.manifest_preview ?? null;
}

interface LockedReadOnlyViewProps {
  preflightItems: ReadonlyArray<PreflightItem>;
  manifestNodes: ReturnType<typeof buildManifestNodes>;
  provenance: ReturnType<typeof buildProvenanceFields>;
  studyTitle: string;
  version: StudyDesignVersion | null;
  onNavigateStation: LockLaunchpadProps["onNavigateStation"];
}

function LockedReadOnlyView({
  preflightItems,
  manifestNodes,
  provenance,
  studyTitle,
  version,
  onNavigateStation,
}: LockedReadOnlyViewProps): JSX.Element {
  return (
    <div className="lock-launchpad locked">
      <header className="lock-header">
        <div className="lock-header-eyebrow wb-mono">
          {tAuto("studies.v2.lock.eyebrowLocked")}
        </div>
        <h2 className="lock-header-title wb-serif">
          {tAuto("studies.v2.lock.titleLocked", { title: studyTitle })}
        </h2>
        <p className="lock-header-meta wb-mono">
          {tAuto("studies.v2.lock.lockedSubtitle", {
            version: version?.version_number ?? "—",
          })}
        </p>
      </header>

      <section className="lock-preflight-panel" aria-label={tAuto("studies.v2.lock.preflightAria")}>
        <div className="lock-preflight-head wb-mono">
          {tAuto("studies.v2.lock.preflightTitle")}
        </div>
        <ul className="lock-preflight-list">
          {preflightItems.map((item) => (
            <PreflightRow
              key={item.id}
              item={{ ...item, status: "satisfied" }}
              onResolve={() => undefined}
            />
          ))}
        </ul>
      </section>

      <section className="lock-preview-row" aria-label={tAuto("studies.v2.lock.previewAria")}>
        <div className="lock-package-preview">
          <div className="lock-preview-head wb-mono">
            {tAuto("studies.v2.lock.manifestTitle")}
          </div>
          <pre className="lock-manifest-tree wb-mono" aria-hidden="false">
            {manifestNodes.map((node) => (
              <span key={node.label} className="lock-manifest-line">
                <span className="lock-manifest-label">{node.label}</span>
                {node.meta ? <span className="lock-manifest-meta">{node.meta}</span> : null}
              </span>
            ))}
          </pre>
        </div>
        <div className="lock-provenance-card">
          <div className="lock-preview-head wb-mono">
            {tAuto("studies.v2.lock.provenanceTitle")}
          </div>
          <ProvenanceList provenance={provenance} />
        </div>
      </section>

      <footer className="lock-footer">
        <button
          type="button"
          className="btn-ghost teal lock-already-locked"
          onClick={() => onNavigateStation("08")}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          {tAuto("studies.v2.lock.alreadyLocked")}
        </button>
      </footer>
    </div>
  );
}

function ProvenanceList({
  provenance,
}: {
  provenance: ReturnType<typeof buildProvenanceFields>;
}): JSX.Element {
  const rows: ReadonlyArray<{ label: string; value: string }> = [
    {
      label: tAuto("studies.v2.lock.prov.protocol"),
      value: `${provenance.protocolFile} · ${provenance.protocolPages} · imported ${provenance.protocolImportedAt}`,
    },
    {
      label: tAuto("studies.v2.lock.prov.vocabulary"),
      value: provenance.vocabularyVersion,
    },
    {
      label: tAuto("studies.v2.lock.prov.hades"),
      value: provenance.hadesVersion,
    },
    {
      label: tAuto("studies.v2.lock.prov.sites"),
      value: provenance.sitesBound,
    },
    {
      label: tAuto("studies.v2.lock.prov.signingKey"),
      value: provenance.signingKeyHint,
    },
  ];
  return (
    <ul className="lock-provenance-list">
      {rows.map((row) => (
        <li key={row.label} className="lock-provenance-item">
          <span className="lock-provenance-label wb-mono">{row.label}</span>
          <span className="lock-provenance-value">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function LockLaunchpad({
  workbench,
  studyTitle,
  onNavigateStation,
}: LockLaunchpadProps): JSX.Element {
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
    () => buildManifestNodes(selectedVersion, selectMan(readiness), assets),
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

  // C-03/H-03 refactor: drive the seal animation directly off the mutation
  // status instead of coupling an 820 ms timer to `lockConfirmOpen`.
  //
  // Sequence:
  //   1. User clicks Lock → setSealPhase("stamping") + stampStartedAt timestamp + handleLockVersionRequest()
  //   2. The hook checks readiness; if OK, sets lockConfirmOpen=true
  //   3. Effect (A) sees lockConfirmOpen=true, fires the actual lock mutation (handleConfirmLock)
  //   4. The hook closes lockConfirmOpen on success/error in its own onSuccess/onError callbacks
  //   5. Effect (B) sees lockDesignVersion.isSuccess + sealPhase="stamping", waits out the
  //      remainder of the 800 ms wax-seal animation, then advances to station 08
  //   6. Effect (C) sees lockDesignVersion.isError + sealPhase="stamping", rewinds to idle
  //
  // The prev-gate-message render-time check above (lines 289-302) still
  // catches the case where the gate refuses BEFORE the mutation runs.
  const sealStartedAtRef = useRef<number | null>(null);

  // (A) gate passed → fire the mutation
  useEffect(() => {
    if (!lockConfirmOpen) return;
    handleConfirmLock();
  }, [lockConfirmOpen, handleConfirmLock]);

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

  const lockClicked = (): void => {
    if (!canSubmitLock || sealPhase !== "idle" || lockDesignVersion.isPending) return;
    sealStartedAtRef.current = Date.now();
    setSealPhase("stamping");
    void handleLockVersionRequest();
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
    <div className="lock-launchpad">
      <header className="lock-header">
        <div className="lock-header-eyebrow wb-mono">
          {tAuto("studies.v2.lock.eyebrow")}
        </div>
        <h2 className="lock-header-title wb-serif">
          {tAuto("studies.v2.lock.title", { title: studyTitle })}
        </h2>
        <p className="lock-header-body">
          {tAuto("studies.v2.lock.headerProse")}
        </p>
      </header>

      <section className="lock-preflight-panel" aria-label={tAuto("studies.v2.lock.preflightAria")}>
        <div className="lock-preflight-head wb-mono">
          {tAuto("studies.v2.lock.preflightTitle")}
        </div>
        <ul className="lock-preflight-list">
          {preflightItems.map((item) => (
            <PreflightRow
              key={item.id}
              item={item}
              onResolve={handlePreflightResolve}
            />
          ))}
        </ul>
        {lockGateMessage ? (
          <div className="lock-gate-message wb-mono" role="status">
            {lockGateMessage}
          </div>
        ) : null}
      </section>

      <section className="lock-preview-row" aria-label={tAuto("studies.v2.lock.previewAria")}>
        <div className="lock-package-preview">
          <div className="lock-preview-head wb-mono">
            {tAuto("studies.v2.lock.manifestTitle")}
          </div>
          <pre className="lock-manifest-tree wb-mono" aria-label={tAuto("studies.v2.lock.manifestAria")}>
            {manifestNodes.map((node) => (
              <span key={node.label} className="lock-manifest-line">
                <span className="lock-manifest-label">{node.label}</span>
                {node.meta ? <span className="lock-manifest-meta">{node.meta}</span> : null}
              </span>
            ))}
          </pre>
        </div>
        <div className="lock-provenance-card">
          <div className="lock-preview-head wb-mono">
            {tAuto("studies.v2.lock.provenanceTitle")}
          </div>
          <ProvenanceList provenance={provenance} />
        </div>
      </section>

      <footer className="lock-footer">
        <button
          type="button"
          className={cn("btn-ghost lock-acknowledge", acknowledged && "acknowledged")}
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
          className={cn("lock-cta", sealPhase !== "idle" && "stamping")}
          onClick={lockClicked}
          disabled={!canSubmitLock || lockDesignVersion.isPending || sealPhase !== "idle"}
          title={lockGate ?? undefined}
          aria-label={tAuto("studies.v2.lock.lockAndPackageAria")}
        >
          <Lock size={14} aria-hidden="true" />
          <span className="lock-cta-label">
            {tAuto("studies.v2.lock.lockAndPackage")}
          </span>
        </button>
      </footer>
    </div>
  );
}

function selectMan(
  readiness: StudyDesignLockReadiness | null,
): StudyDesignManifestPreview | null {
  return selectManifestPreview(readiness);
}

// Re-export StudyDesignAsset / StudyDesignSession for downstream typings.
export type { StudyDesignAsset, StudyDesignSession };
