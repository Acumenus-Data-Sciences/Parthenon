import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import type { StudyDesignVersion } from "../../../types/study";
import type { PreflightItem, PreflightStatus } from "./lockHelpers";
import type { buildManifestNodes, buildProvenanceFields } from "./lockProvenance";

// Sub-components and helpers extracted from LockLaunchpad.tsx so the main
// file stays under the 500-LOC project rule. These are presentational — no
// hook usage, no state of their own beyond what's passed in.

function statusGlyph(status: PreflightStatus): string {
  if (status === "satisfied") return "✓";
  if (status === "warning") return "⚠";
  return "—";
}

export function PreflightRow({
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

export function ProvenanceList({
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

interface LockedReadOnlyViewProps {
  preflightItems: ReadonlyArray<PreflightItem>;
  manifestNodes: ReturnType<typeof buildManifestNodes>;
  provenance: ReturnType<typeof buildProvenanceFields>;
  studyTitle: string;
  version: StudyDesignVersion | null;
  onNavigateStation: (stationId: "01" | "02" | "03" | "04" | "05" | "06" | "08") => void;
}

export function LockedReadOnlyView({
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
        {/* H5 — DESIGN DECISION (2026-05-14):
            Post-lock, every preflight row is rendered with status="satisfied"
            regardless of the current live readiness state.
            RATIONALE:
              - The lock action is irreversible. Once locked, the design is
                immutable, so the "live" checklist (which can drift as new
                feasibility runs / lint warnings appear AFTER lock) does not
                represent what was actually frozen.
              - The locked view is a historical receipt: "you locked v3 with
                the design as it stood at that moment." Showing post-lock
                drift would imply the user can still act on it, which they
                cannot.
              - The authoritative audit trail of WHAT was locked lives in
                the manifest preview + provenance card below; the preflight
                strip here is a confirmation pattern, not a status display.
            AUDIT-TRAIL LIMITATION:
              - If a backend gate ever returns checklist=[{status:"warning"}]
                on a locked version (e.g., post-lock feasibility re-run finds
                a new issue), the warning is hidden HERE but is still
                visible on the live Pipeline Rail stage state. A future
                "lock history" panel could surface point-in-time preflight
                snapshots if researchers ask for them.
        */}
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
