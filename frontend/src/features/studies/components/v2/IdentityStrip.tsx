import { Upload } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import type { Study } from "../../types/study";

// Sticky 56 px top strip — three regions:
//   left:   wordmark · breadcrumb · session-chip
//   center: serif italic study title + mono subtitle
//   right:  upload icon · version pill · PI · state pill · Lock CTA
// Phase 1 ships the strip as presentational. None of the buttons have
// handlers — Phase 2+ wires them.

interface IdentityStripProps {
  study: Study;
}

function shortName(study: Study): string {
  return study.short_title?.trim() || study.title;
}

function sessionTitle(study: Study): string {
  // The runtime payload may carry a `design_sessions` array even though the
  // statically typed `Study` interface doesn't expose it yet (Phase 2 will
  // formalize the shape). Defensively probe `metadata` and then the loose
  // shape — fall back to a neutral default.
  const candidate =
    (study.metadata?.["active_session_title"] as string | undefined) ??
    (study.metadata?.["latest_design_session_title"] as string | undefined);

  if (candidate && candidate.trim().length > 0) return candidate;
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

export function IdentityStrip({ study }: IdentityStripProps) {
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
        {/* Decorative until Phase 3 wires the session switcher menu. Plain
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
        {/* Inert until Phase 3 wires the protocol upload. Using `disabled`
            (not aria-disabled) keeps the button out of the tab order and
            screen-reader actionables. */}
        <button
          type="button"
          className="icon-btn"
          aria-label={tAuto("studies.v2.uploadProtocolComingSoon")}
          title={tAuto("studies.v2.uploadProtocolComingSoon")}
          disabled
        >
          <Upload size={13} aria-hidden="true" />
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
