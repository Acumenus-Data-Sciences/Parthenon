import type { ChangeEvent, RefObject } from "react";
import { Loader2, Upload } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import type { Study } from "../../types/study";

// Sticky 56 px top strip — three regions:
//   left:   wordmark · breadcrumb · session-chip
//   center: serif italic study title + mono subtitle
//   right:  upload icon · version pill · PI · state pill · Lock CTA
//
// The upload icon is now wired to handleProtocolUpload (the same handler the
// v1 workbench used), restoring v1's "start a session from a protocol PDF"
// flow. The Lock CTA is presentational only — the real lock action lives on
// Station 07.

interface IdentityStripProps {
  study: Study;
  /** Hidden file input ref + onChange handler, from useStudyDesignWorkbench. */
  protocolInputRef: RefObject<HTMLInputElement | null>;
  onProtocolUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  /** True while an import is in flight — disables the upload button. */
  protocolBusy: boolean;
}

function shortName(study: Study): string {
  return study.short_title?.trim() || study.title;
}

function sessionTitle(study: Study): string {
  // The runtime payload may carry a `design_sessions` array even though the
  // statically typed `Study` interface doesn't expose it yet. Defensively
  // probe `metadata` and then the loose shape — fall back to a neutral
  // default. Narrow to `string` so non-string values don't crash
  // `clampSessionTitle`.
  const raw =
    study.metadata?.["active_session_title"] ??
    study.metadata?.["latest_design_session_title"];

  if (typeof raw === "string" && raw.trim().length > 0) return raw;
  return "New session";
}

function clampSessionTitle(raw: string, maxLength = 32): string {
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength - 1).trimEnd()}…`;
}

function humanizeDesign(value: string | null | undefined): string {
  if (!value) return "observational";
  return value.replace(/_/g, " ");
}

export function IdentityStrip({
  study,
  protocolInputRef,
  onProtocolUpload,
  protocolBusy,
}: IdentityStripProps) {
  const session = clampSessionTitle(sessionTitle(study));
  const versionLabel = study.protocol_version
    ? `${study.protocol_version} · ${study.status}`
    : `v1 · ${study.status || "draft"}`;
  const piName = study.principal_investigator?.name ?? "—";
  const stateLabel = `${study.status} · unlocked`;

  return (
    <header className="studies-v2-identity-strip" aria-label={tAuto("studies.v2.identityStrip")}>
      <div className="id-left">
        <span className="wordmark">
          <span className="dot" aria-hidden="true" />
          Parthenon
        </span>
        <span className="breadcrumb" aria-label={tAuto("studies.v2.breadcrumb")}>
          Studies&nbsp;/&nbsp;<b>{shortName(study)}</b>&nbsp;/&nbsp;Design
        </span>
        {/* Decorative until Phase 3+ wires the session switcher menu. Plain
            span (no role="button", no tabIndex) so screen readers and the
            keyboard don't treat it as an actionable control. */}
        <span
          className="session-chip"
          title={tAuto("studies.v2.switchSessionComingSoon")}
        >
          <span className="session-name">{session}</span>
          <span className="caret" aria-hidden="true">▾</span>
        </span>
      </div>
      <div className="id-center">
        <div className="id-title" title={study.title}>{study.title}</div>
        <div className="id-subtitle">
          {study.study_type} · {humanizeDesign(study.study_design)}
        </div>
      </div>
      <div className="id-right">
        {/* Hidden file input drives the upload-icon button — same wiring v1
            uses (handleProtocolUpload + protocolInputRef). */}
        <input
          ref={protocolInputRef}
          type="file"
          aria-label={tAuto("studies.v2.uploadProtocolFile")}
          accept=".doc,.docx,.pdf,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
          className="sr-only"
          onChange={onProtocolUpload}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={tAuto("studies.v2.uploadProtocol")}
          title={tAuto("studies.v2.uploadProtocol")}
          onClick={() => protocolInputRef.current?.click()}
          disabled={protocolBusy}
        >
          {protocolBusy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload size={13} aria-hidden="true" />
          )}
        </button>
        <span className="pill gold">{versionLabel}</span>
        <span className="pi-tag">PI:&nbsp;{piName}</span>
        <span className="pill slate">{stateLabel}</span>
        {/* Identity-strip Lock CTA is a status hint only — the real Lock
            action lives on Station 07. Disabled so it doesn't compete for
            keyboard focus with the actionable button on the launchpad. */}
        <button
          type="button"
          className="btn-lock"
          disabled
          title={tAuto("studies.v2.lockHintGoToStation07")}
        >
          Lock {study.protocol_version ?? "v1"}
        </button>
      </div>
    </header>
  );
}
