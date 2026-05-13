import { useMemo, useState } from "react";
import { Archive, Check, Copy, Download, ExternalLink } from "lucide-react";
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
    "assets" | "lockReadinessQuery" | "selectedVersion"
  >;
  onNavigateStation: (stationId: "07") => void;
}

type ToastState = "idle" | "copied-hash" | "copied-manifest";

export function PackageReceipt({
  workbench,
  onNavigateStation,
}: PackageReceiptProps): JSX.Element {
  const { assets, lockReadinessQuery, selectedVersion } = workbench;
  const readiness = lockReadinessQuery.data ?? null;
  const manifestPreview = readiness?.manifest_preview ?? null;

  const isLocked = String(selectedVersion?.status ?? "").toLowerCase() === "locked"
    || selectedVersion?.locked_at != null;

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
      window.setTimeout(() => setToast("idle"), 1600);
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
