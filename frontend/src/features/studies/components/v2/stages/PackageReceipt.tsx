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
      <div
        className="flex flex-col items-start gap-3 pb-6"
        role="status"
        aria-live="polite"
      >
        <div className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {tAuto("studies.v2.package.eyebrow")}
        </div>
        {/* L4: spinner moved to the eyebrow (sibling of the title) so the
            <h2> heading carries text only — semantically cleaner for screen
            readers that flatten heading content and for the polite live
            region announcement. */}
        <h2 className="text-sm font-semibold text-text-primary">
          {tAuto("studies.v2.package.finalizingTitle")}
        </h2>
        <p className="text-xs text-text-muted">
          {tAuto("studies.v2.package.finalizingBody")}
        </p>
      </div>
    );
  }

  if (!isLocked) {
    return (
      <div className="flex flex-col items-start gap-3 pb-6">
        <p className="text-xs text-text-muted">
          {tAuto("studies.v2.package.gatedBody")}
        </p>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2",
            "text-sm font-medium text-text-muted hover:text-text-secondary transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
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
    <div className="flex flex-col gap-5 pb-6">
      {/* Header — signed-at / size meta; eyebrow + serif title removed per spec */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-text-muted tabular-nums">
          {tAuto("studies.v2.package.signedAt", {
            timestamp: summary.signedAtLabel,
            size: summary.sizeLabel,
          })}
        </p>
      </div>

      {/* Hero card — hash + manifest + actions */}
      <section
        className="rounded-lg border border-border-default bg-surface-raised p-4 flex flex-col gap-4"
        aria-label={tAuto("studies.v2.package.heroAria")}
      >
        {/* Signature hash block */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-text-muted uppercase tracking-wide">
            {tAuto("studies.v2.package.signatureLabel")}
          </span>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2.5 w-full rounded-lg border border-border-default",
              "bg-surface-base px-3 py-2.5 text-left text-sm transition-colors",
              "hover:border-accent/60 cursor-pointer",
            )}
            onClick={copyHash}
            title={tAuto("studies.v2.package.copyHashTitle")}
            aria-label={tAuto("studies.v2.package.copyHashAria")}
          >
            <span className="flex-1 min-w-0 break-all font-mono text-xs text-text-secondary tabular-nums">
              {summary.fullHashHex}
            </span>
            {toast === "copied-hash" ? (
              <span
                className="inline-flex items-center gap-1 shrink-0 text-[11px] font-medium text-success"
                role="status"
              >
                <Check size={11} aria-hidden="true" />
                {tAuto("studies.v2.package.copied")}
              </span>
            ) : (
              <Copy size={11} aria-hidden="true" className="text-text-ghost shrink-0" />
            )}
          </button>
        </div>

        {/* Manifest preview */}
        <pre
          className={cn(
            "m-0 rounded-lg border border-border-default bg-surface-base px-3 py-2.5",
            "text-xs text-text-secondary leading-relaxed overflow-x-auto",
          )}
          aria-label={tAuto("studies.v2.package.manifestAria")}
        >
          {manifestNodes.map((node) => (
            <span key={node.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-baseline">
              <span className="text-text-secondary">{node.label}</span>
              {node.meta ? (
                <span className="text-[10px] text-text-muted uppercase tracking-wide">{node.meta}</span>
              ) : null}
            </span>
          ))}
        </pre>

        {/* Download + copy-manifest actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              summary.downloadUrl
                ? "bg-accent text-surface-base hover:bg-accent-light"
                : "cursor-not-allowed bg-surface-elevated text-text-ghost",
            )}
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
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2",
              "text-sm font-medium text-text-muted hover:text-text-secondary transition-colors",
            )}
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

      {/* Next steps */}
      <section
        className="rounded-lg border border-border-default bg-surface-raised p-4 flex flex-col gap-3"
        aria-label={tAuto("studies.v2.package.nextStepsAria")}
      >
        <span className="text-xs text-text-muted uppercase tracking-wide">
          {tAuto("studies.v2.package.nextStepsTitle")}
        </span>
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          <li>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2",
                "text-sm font-medium text-text-muted transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
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
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2",
                "text-sm font-medium text-text-muted transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
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
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2",
                "text-sm font-medium text-text-muted transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
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
