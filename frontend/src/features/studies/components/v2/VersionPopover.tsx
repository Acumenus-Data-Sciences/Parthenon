import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import type { StudyDesignVersion } from "../../types/study";
import {
  buildDiffRows,
  relativeTimeFromNow,
  toneFromStatus,
} from "./stages/packageHelpers";

// Version popover — replaces the deleted peripheral/VersionTimeline strip.
// Click the WizardFooter version chip → this opens. Functionality preserved
// from VersionTimeline:
//   • single click on a version node selects it as the active version (closes popover)
//   • shift+click on two version nodes selects a pair for diff
//   • "Compare vM ↔ vN" toggles an inline PICO diff table
// Closes on Escape, click outside, or after selecting a version.

interface VersionPopoverProps {
  open: boolean;
  onClose: () => void;
  versions: ReadonlyArray<StudyDesignVersion>;
  activeVersionId: number | null;
  onSelectVersion: (id: number) => void;
}

interface DiffEndpoints {
  left: StudyDesignVersion | null;
  right: StudyDesignVersion | null;
}

function defaultPair(
  versions: ReadonlyArray<StudyDesignVersion>,
): ReadonlyArray<number> {
  if (versions.length < 2) return [];
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
  const right = sorted[0];
  const left = sorted[1];
  if (!right || !left) return [];
  return [left.id, right.id];
}

function resolvePair(
  versions: ReadonlyArray<StudyDesignVersion>,
  pair: ReadonlyArray<number>,
): DiffEndpoints {
  if (pair.length !== 2) return { left: null, right: null };
  const a = versions.find((v) => v.id === pair[0]) ?? null;
  const b = versions.find((v) => v.id === pair[1]) ?? null;
  if (!a || !b) return { left: null, right: null };
  if (a.version_number <= b.version_number) return { left: a, right: b };
  return { left: b, right: a };
}

function extendSelection(
  current: ReadonlyArray<number>,
  versionId: number,
): ReadonlyArray<number> {
  if (current.includes(versionId)) {
    return current.filter((id) => id !== versionId);
  }
  if (current.length < 2) {
    return [...current, versionId];
  }
  const second = current[1];
  if (second === undefined) return [versionId];
  return [second, versionId];
}

export function VersionPopover({
  open,
  onClose,
  versions,
  activeVersionId,
  onSelectVersion,
}: VersionPopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version_number - a.version_number),
    [versions],
  );
  const [pair, setPair] = useState<ReadonlyArray<number>>([]);
  const [diffOpen, setDiffOpen] = useState(false);

  // Note: transient state (pair, diffOpen) intentionally persists across
  // close/reopen so the user can resume a diff session — closing the
  // popover is not the same as "discard". Resetting would also fight the
  // react-hooks/set-state-in-effect rule.

  // Escape closes; outside-click closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    function onClick(e: globalThis.MouseEvent) {
      if (!panelRef.current) return;
      if (e.target instanceof Node && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    // Defer the click listener by a tick — otherwise the same click that
    // opened the popover (on the footer chip) would immediately close it.
    const t = window.setTimeout(() => {
      window.addEventListener("mousedown", onClick);
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (sorted.length === 0) return null;

  const canCompare = sorted.length >= 2;
  const effectivePair = pair.length === 2 ? pair : defaultPair(sorted);
  const endpoints = resolvePair(sorted, effectivePair);
  const compareLabel = canCompare && endpoints.left && endpoints.right
    ? tAuto("studies.v2.versions.compareLabel", {
        left: endpoints.left.version_number,
        right: endpoints.right.version_number,
      })
    : tAuto("studies.v2.versions.compare");

  function handleNodeClick(event: MouseEvent<HTMLButtonElement>, versionId: number) {
    if (event.shiftKey) {
      event.preventDefault();
      setPair((prev) => extendSelection(prev, versionId));
      return;
    }
    onSelectVersion(versionId);
    onClose();
  }

  function handleNodeKeyDown(event: KeyboardEvent<HTMLButtonElement>, versionId: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (event.shiftKey) {
        setPair((prev) => extendSelection(prev, versionId));
      } else {
        onSelectVersion(versionId);
        onClose();
      }
    }
  }

  function toggleCompare() {
    if (!canCompare) return;
    setDiffOpen((prev) => {
      if (prev) return false;
      if (pair.length !== 2) {
        setPair(defaultPair(sorted));
      }
      return true;
    });
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={tAuto("studies.v2.wizard.versionPopoverAria")}
      className={cn(
        "absolute bottom-full left-0 mb-2 z-50 w-[min(92vw,640px)]",
        "rounded-lg border border-border-default bg-surface-raised shadow-2xl",
        "p-3",
      )}
    >
      <div className="flex items-center justify-between mb-2 pl-1">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {tAuto("studies.v2.versions.eyebrow")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-text-ghost hover:text-text-muted transition-colors"
          aria-label={tAuto("studies.v2.wizard.closeVersions")}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <ol
        className="flex flex-col gap-1 max-h-64 overflow-y-auto"
        role="listbox"
        aria-label={tAuto("studies.v2.versions.timelineAria")}
      >
        {sorted.map((version) => {
          const tone = toneFromStatus(version.status);
          const isActive = version.id === activeVersionId;
          const isSelected = pair.includes(version.id);
          return (
            <li key={version.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-current={isActive ? "true" : undefined}
                aria-selected={isSelected}
                onClick={(event) => handleNodeClick(event, version.id)}
                onKeyDown={(event) => handleNodeKeyDown(event, version.id)}
                title={tAuto("studies.v2.versions.nodeTitle", {
                  version: version.version_number,
                  status: version.status,
                })}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-md text-left transition-colors",
                  "hover:bg-surface-elevated",
                  isActive && "bg-accent/10 border border-accent/40",
                  isSelected && !isActive && "bg-surface-elevated border border-border-default",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    tone === "success" && "bg-success",
                    tone === "warning" && "bg-warning",
                    tone === "danger" && "bg-error",
                    tone === "neutral" && "bg-text-ghost",
                  )}
                />
                <span className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold text-text-primary">
                    v{version.version_number}
                  </span>
                  <span className="text-xs font-mono text-text-muted truncate">
                    {version.status} · {relativeTimeFromNow(version.updated_at)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-default">
        <span className="text-xs text-text-ghost pl-1">
          {tAuto("studies.v2.wizard.versionPopoverHint")}
        </span>
        <button
          type="button"
          onClick={toggleCompare}
          disabled={!canCompare}
          aria-pressed={diffOpen}
          aria-label={compareLabel}
          title={compareLabel}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs font-medium",
            "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            diffOpen
              ? "bg-accent/10 text-accent border-accent/40"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          <ArrowLeftRight size={11} aria-hidden="true" />
          {compareLabel}
        </button>
      </div>

      {diffOpen && endpoints.left && endpoints.right ? (
        <div
          className="mt-3 pt-3 border-t border-border-default"
          role="region"
          aria-label={tAuto("studies.v2.versions.diffAria")}
        >
          <div
            className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs"
            role="table"
            aria-label={tAuto("studies.v2.versions.diffTableAria")}
          >
            <div role="columnheader" className="font-mono uppercase text-text-ghost text-[10px] tracking-wide">
              {tAuto("studies.v2.versions.fieldHeader")}
            </div>
            <div role="columnheader" className="font-mono uppercase text-text-ghost text-[10px] tracking-wide">
              v{endpoints.left.version_number}
            </div>
            <div role="columnheader" className="font-mono uppercase text-text-ghost text-[10px] tracking-wide">
              v{endpoints.right.version_number}
            </div>
            {buildDiffRows(endpoints.left, endpoints.right).map((row) => (
              <div role="row" key={row.field} className="contents">
                <div
                  role="rowheader"
                  className="font-mono text-text-muted text-[11px] py-1 pr-1"
                >
                  {row.label}
                </div>
                <div
                  role="cell"
                  className={cn(
                    "text-[12px] py-1 px-2 rounded",
                    row.changed ? "bg-warning/10 text-text-primary" : "text-text-muted",
                  )}
                >
                  {row.leftValue.trim() === "" ? "—" : row.leftValue}
                </div>
                <div
                  role="cell"
                  className={cn(
                    "text-[12px] py-1 px-2 rounded",
                    row.changed ? "bg-warning/10 text-text-primary" : "text-text-muted",
                  )}
                >
                  {row.rightValue.trim() === "" ? "—" : row.rightValue}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
