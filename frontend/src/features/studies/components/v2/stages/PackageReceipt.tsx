import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Check, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import { cn } from "@/lib/utils";
import type { useStudyDesignWorkbench } from "../../../hooks/useStudyDesignWorkbench";
import {
  buildManifestNodes,
  buildProvenanceFields,
} from "./lockProvenance";
import {
  buildPackageSummary,
  manifestToJsonString,
} from "./packageHelpers";

// Station 08 — Package. The post-lock receipt.
//
// Reads `selectedVersion.locked_at`, lock-readiness manifest + provenance,
// and renders a hero card with the signed signature hash plus a stubbed
// download CTA. Pre-lock state shows a "Lock the design first" gate.

type Workbench = ReturnType<typeof useStudyDesignWorkbench>;

interface PackageReceiptProps {
  workbench: Pick<
    Workbench,
    "assets" | "lockReadinessQuery" | "lockDesignVersion" | "selectedVersion"
  >;
  onNavigateStation: (stationId: "07") => void;
}

type ToastState = "idle" | "copied-hash" | "copied-manifest";

export function PackageReceipt({
  workbench,
  onNavigateStation,
}: PackageReceiptProps): JSX.Element {
  const { assets, lockReadinessQuery, lockDesignVersion, selectedVersion } = workbench;
  const readiness = lockReadinessQuery.data ?? null;
  const manifestPreview = readiness?.manifest_preview ?? null;

  const isLocked = String(selectedVersion?.status ?? "").toLowerCase() === "locked"
    || selectedVersion?.locked_at != null;

  // C-04: brief window between successful lock mutation and the versions
  // query refetch propagating `locked_at` back. If we land on PackageReceipt
  // during that window we'd otherwise show the gated "Lock the design first"
  // message — confusing right after the user just clicked Lock. Detect the
  // transition and show a finalizing-loading state instead.
  //
  // M9: bail out of the finalizing state after 10s in case the versions
  // refetch silently fails or stalls. Without this fallback, a stuck refetch
  // would freeze the user on "Finalizing…" until they reloaded the tab.
  // After bailout we reset the mutation status so subsequent renders fall
  // through to the gated branch and the user can re-attempt navigation.
  const [finalizingExpired, setFinalizingExpired] = useState(false);
  const inFinalizingWindow =
    !isLocked
    && (lockDesignVersion.isPending || lockDesignVersion.isSuccess || lockReadinessQuery.isFetching);
  const isFinalizing = inFinalizingWindow && !finalizingExpired;

  // Render-time prev-value comparison (consistent with the rest of v2)
  // to reset the bail-out latch when we exit the finalizing window —
  // matches the LockLaunchpad pattern, avoids setState-in-effect lint.
  const [prevInWindow, setPrevInWindow] = useState(inFinalizingWindow);
  if (prevInWindow !== inFinalizingWindow) {
    setPrevInWindow(inFinalizingWindow);
    if (!inFinalizingWindow && finalizingExpired) {
      setFinalizingExpired(false);
    }
  }

  useEffect(() => {
    // Effect body only schedules the timer; the setState happens inside
    // the timeout callback (an external event handler), which is allowed.
    if (!inFinalizingWindow) return undefined;
    const timer = window.setTimeout(() => {
      setFinalizingExpired(true);
      // Drop the mutation's residual isSuccess so isFinalizing settles to
      // false even if the readiness query is still spinning.
      try {
        lockDesignVersion.reset();
      } catch {
        // mutation already reset; safe to ignore
      }
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [inFinalizingWindow, lockDesignVersion]);

  const provenance = useMemo(
    () => buildProvenanceFields(selectedVersion, assets, readiness),
    [selectedVersion, assets, readiness],
  );
  const manifestNodes = useMemo(
    () => buildManifestNodes(selectedVersion, manifestPreview, assets),
    [selectedVersion, manifestPreview, assets],
  );
  const summary = useMemo(
    () => buildPackageSummary(selectedVersion, readiness),
    [selectedVersion, readiness],
  );

  const [toast, setToast] = useState<ToastState>("idle");
  // H-09: track toast-reset timer in a ref so we can clear it on unmount and
  // avoid setToast firing on a torn-down component.
  const toastTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  if (isFinalizing) {
    return (
      <div className="package-receipt finalizing" role="status" aria-live="polite">
        <div className="package-gated-eyebrow wb-mono">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {" "}
          {tAuto("studies.v2.package.eyebrow")}
        </div>
        {/* L4: spinner moved to the eyebrow (sibling of the title) so the
            <h2> heading carries text only — semantically cleaner for screen
            readers that flatten heading content and for the polite live
            region announcement. */}
        <h2 className="package-gated-title wb-serif">
          {tAuto("studies.v2.package.finalizingTitle")}
        </h2>
        <p className="package-gated-body wb-mono">
          {tAuto("studies.v2.package.finalizingBody")}
        </p>
      </div>
    );
  }

  if (!isLocked) {
    return (
      <div className="package-receipt gated">
        <div className="package-gated-eyebrow wb-mono">
          {tAuto("studies.v2.package.eyebrow")}
        </div>
        <h2 className="package-gated-title wb-serif">
          {tAuto("studies.v2.package.gatedTitle")}
        </h2>
        <p className="package-gated-body wb-mono">
          {tAuto("studies.v2.package.gatedBody")}
        </p>
        <button
          type="button"
          className="btn-ghost teal package-gated-action"
          onClick={() => onNavigateStation("07")}
        >
          {tAuto("studies.v2.package.gotoLock")}
        </button>
      </div>
    );
  }

  const copyToClipboard = async (text: string, state: ToastState): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(state);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToast("idle");
        toastTimerRef.current = null;
      }, 1600);
    } catch {
      // Clipboard may be unavailable in tests or insecure contexts. Failing
      // silently is acceptable for this presentational stub.
    }
  };

  const copyHash = (): void => {
    void copyToClipboard(summary.fullHashHex, "copied-hash");
  };

  const copyManifest = (): void => {
    void copyToClipboard(manifestToJsonString(manifestNodes, provenance), "copied-manifest");
  };

  return (
    <div className="package-receipt">
      <header className="package-header">
        <div className="package-header-eyebrow wb-mono">
          {tAuto("studies.v2.package.eyebrow")}
        </div>
        <h2 className="package-header-title wb-serif">
          {tAuto("studies.v2.package.title")}
        </h2>
        <p className="package-header-meta wb-mono">
          {tAuto("studies.v2.package.signedAt", {
            timestamp: summary.signedAtLabel,
            size: summary.sizeLabel,
          })}
        </p>
      </header>

      <section className="package-hero" aria-label={tAuto("studies.v2.package.heroAria")}>
        <div className="package-hash-block">
          <div className="package-hash-label wb-mono">
            {tAuto("studies.v2.package.signatureLabel")}
          </div>
          <button
            type="button"
            className="package-hash wb-mono"
            onClick={copyHash}
            title={tAuto("studies.v2.package.copyHashTitle")}
            aria-label={tAuto("studies.v2.package.copyHashAria")}
          >
            <span className="package-hash-value">{summary.fullHashHex}</span>
            {toast === "copied-hash" ? (
              <span className="package-toast" role="status">
                <Check size={11} aria-hidden="true" />
                {tAuto("studies.v2.package.copied")}
              </span>
            ) : (
              <Copy size={11} aria-hidden="true" className="package-hash-icon" />
            )}
          </button>
        </div>

        <pre className="package-manifest wb-mono" aria-label={tAuto("studies.v2.package.manifestAria")}>
          {manifestNodes.map((node) => (
            <span key={node.label} className="package-manifest-line">
              <span className="package-manifest-label">{node.label}</span>
              {node.meta ? <span className="package-manifest-meta">{node.meta}</span> : null}
            </span>
          ))}
        </pre>

        <div className="package-actions">
          <button
            type="button"
            className={cn("btn-accept package-download", !summary.downloadUrl && "disabled")}
            disabled={summary.downloadUrl == null}
            title={
              summary.downloadUrl
                ? tAuto("studies.v2.package.downloadTitle")
                : tAuto("studies.v2.package.downloadStub")
            }
            onClick={() => {
              if (summary.downloadUrl) {
                window.open(summary.downloadUrl, "_blank", "noopener");
              }
            }}
          >
            <Download size={13} aria-hidden="true" />
            {tAuto("studies.v2.package.downloadTarGz")}
          </button>
          <button
            type="button"
            className="btn-ghost package-copy-manifest"
            onClick={copyManifest}
            title={tAuto("studies.v2.package.copyManifestTitle")}
          >
            {toast === "copied-manifest" ? (
              <>
                <Check size={11} aria-hidden="true" />
                {tAuto("studies.v2.package.copied")}
              </>
            ) : (
              <>
                <Copy size={11} aria-hidden="true" />
                {tAuto("studies.v2.package.copyManifest")}
              </>
            )}
          </button>
        </div>
      </section>

      <section className="package-next-steps" aria-label={tAuto("studies.v2.package.nextStepsAria")}>
        <div className="package-next-steps-head wb-mono">
          {tAuto("studies.v2.package.nextStepsTitle")}
        </div>
        <ul className="package-next-steps-list">
          <li>
            <button
              type="button"
              className="btn-ghost teal package-next-step"
              disabled
              title={tAuto("studies.v2.package.federationStub")}
            >
              <ExternalLink size={11} aria-hidden="true" />
              {tAuto("studies.v2.package.submitFederation")}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="btn-ghost package-next-step"
              disabled
              title={tAuto("studies.v2.package.atlasStub")}
            >
              <ExternalLink size={11} aria-hidden="true" />
              {tAuto("studies.v2.package.openInAtlas")}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="btn-ghost package-next-step"
              disabled
              title={tAuto("studies.v2.package.archiveStub")}
            >
              <Archive size={11} aria-hidden="true" />
              {tAuto("studies.v2.package.archiveLocally")}
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
