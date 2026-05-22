import { Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import type { StudyDesignVersion } from "../../../types/study";
import type { PreflightItem, PreflightStatus } from "./lockHelpers";
import type { buildManifestNodes, buildProvenanceFields } from "./lockProvenance";

// Sub-components and helpers extracted from LockLaunchpad.tsx so the main
// file stays under the 500-LOC project rule. These are presentational — no
// hook usage, no state of their own beyond what's passed in.

function StatusIcon({ status }: { status: PreflightStatus }): JSX.Element {
  if (status === "satisfied") {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-success/40 bg-success/10"
        aria-hidden="true"
      >
        <Check size={11} className="text-success" strokeWidth={3} />
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-error/40 bg-error/10"
        aria-hidden="true"
      >
        <AlertTriangle size={10} className="text-error" />
      </span>
    );
  }
  // not-started
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border-default bg-surface-elevated"
      aria-hidden="true"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-text-ghost" />
    </span>
  );
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
      className={cn(
        "grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 px-1",
        "border-b border-border-default last:border-b-0",
      )}
      aria-label={tAuto("studies.v2.lock.preflightRowAria", { label: item.label })}
    >
      <StatusIcon status={item.status} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{item.label}</div>
        <div className="text-xs text-text-muted">{item.description}</div>
      </div>
      {showResolve ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
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
    <ul className="flex flex-col gap-0 list-none m-0 p-0">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex flex-col gap-0.5 py-2 border-b border-border-default last:border-b-0 last:pb-0"
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-ghost">
            {row.label}
          </span>
          <span className="text-xs text-text-primary">{row.value}</span>
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
    <div className="flex flex-col gap-5 pb-6">
      {/* Header — no eyebrow, no serif */}
      <header className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-text-primary m-0">
          {tAuto("studies.v2.lock.titleLocked", { title: studyTitle })}
        </h2>
        <p className="text-xs text-text-muted m-0">
          {tAuto("studies.v2.lock.lockedSubtitle", {
            version: version?.version_number ?? "—",
          })}
        </p>
      </header>

      {/* Preflight checklist — read-only, all satisfied */}
      <section
        className="rounded-lg border border-border-default bg-surface-raised p-4 flex flex-col gap-2"
        aria-label={tAuto("studies.v2.lock.preflightAria")}
      >
        <div className="text-xs font-semibold text-text-muted uppercase tracking-[0.12em] pb-1.5 border-b border-border-default">
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
        <ul className="list-none m-0 p-0 flex flex-col">
          {preflightItems.map((item) => (
            <PreflightRow
              key={item.id}
              item={{ ...item, status: "satisfied" }}
              onResolve={() => undefined}
            />
          ))}
        </ul>
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
            aria-hidden="false"
          >
            {manifestNodes.map((node) => (
              <span key={node.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-baseline">
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

      {/* Footer */}
      <footer className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onNavigateStation("08")}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          {tAuto("studies.v2.lock.alreadyLocked")}
        </button>
      </footer>
    </div>
  );
}
