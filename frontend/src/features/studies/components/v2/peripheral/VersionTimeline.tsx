import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import { cn } from "@/lib/utils";
import type { StudyDesignVersion } from "../../../types/study";
import {
  buildDiffRows,
  relativeTimeFromNow,
  toneFromStatus,
  type VersionTone,
} from "../stages/packageHelpers";

// Horizontal Version Timeline strip — rendered between the IdentityStrip
// and the Active Editor when the session has at least one version.
//
// Behavior (per Phase 5 brief Decision Q2):
//   * Single click on a version node selects it as the active version.
//   * Shift+click selects up to 2 nodes for a side-by-side diff.
//   * `Compare v{M} ↔ v{N}` toolbar button is the canonical entry — toggles
//     the inline diff panel between the two most recent versions.
//
// The diff panel renders BELOW this strip (in-place, not a modal), with
// PICO fields side-by-side; changed cells are gold-highlighted.

interface VersionTimelineProps {
  versions: ReadonlyArray<StudyDesignVersion>;
  activeVersionId: number | null;
  onSelectVersion: (id: number) => void;
}

interface SelectionState {
  pair: ReadonlyArray<number>; // up to two ids
}

interface DiffEndpoints {
  left: StudyDesignVersion | null;
  right: StudyDesignVersion | null;
}

function defaultPair(
  versions: ReadonlyArray<StudyDesignVersion>,
): ReadonlyArray<number> {
  if (versions.length < 2) return [];
  // The two most recent versions, sorted descending by version_number.
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
  // Left = older, right = newer.
  if (a.version_number <= b.version_number) return { left: a, right: b };
  return { left: b, right: a };
}

function toneSelector(tone: VersionTone): string {
  return tone;
}

export function VersionTimeline({
  versions,
  activeVersionId,
  onSelectVersion,
}: VersionTimelineProps): JSX.Element | null {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => a.version_number - b.version_number),
    [versions],
  );

  const [selection, setSelection] = useState<SelectionState>({ pair: [] });
  const [diffOpen, setDiffOpen] = useState(false);

  if (sorted.length === 0) return null;

  const canCompare = sorted.length >= 2;
  const compareLabel = canCompare
    ? compareButtonLabel(sorted, selection.pair)
    : tAuto("studies.v2.versions.compareUnavailable");

  const handleNodeClick = (
    event: MouseEvent<HTMLButtonElement>,
    versionId: number,
  ): void => {
    if (event.shiftKey) {
      event.preventDefault();
      setSelection((prev) => extendSelection(prev.pair, versionId));
      return;
    }
    onSelectVersion(versionId);
  };

  const handleNodeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    versionId: number,
  ): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (event.shiftKey) {
        setSelection((prev) => extendSelection(prev.pair, versionId));
      } else {
        onSelectVersion(versionId);
      }
    }
  };

  const toggleCompare = (): void => {
    if (!canCompare) return;
    setDiffOpen((prev) => {
      if (prev) return false;
      // Initialize the pair to the two most recent if the user hasn't
      // shift-selected an explicit pair.
      if (selection.pair.length !== 2) {
        setSelection({ pair: defaultPair(sorted) });
      }
      return true;
    });
  };

  const closeDiff = (): void => {
    setDiffOpen(false);
  };

  const effectivePair = selection.pair.length === 2 ? selection.pair : defaultPair(sorted);
  const endpoints = resolvePair(sorted, effectivePair);

  return (
    <div className="version-timeline-wrap">
      <div className="version-timeline-strip" role="group" aria-label={tAuto("studies.v2.versions.timelineAria")}>
        <div className="version-timeline-eyebrow wb-mono">
          {tAuto("studies.v2.versions.eyebrow")}
        </div>
        <ol className="version-timeline-nodes">
          {sorted.map((version) => {
            const tone = toneFromStatus(version.status);
            const isActive = version.id === activeVersionId;
            const isSelected = selection.pair.includes(version.id);
            return (
              <li
                key={version.id}
                className={cn(
                  "vt-node",
                  toneSelector(tone),
                  isActive && "active",
                  isSelected && "selected",
                )}
              >
                <button
                  type="button"
                  className="vt-node-btn"
                  onClick={(event) => handleNodeClick(event, version.id)}
                  onKeyDown={(event) => handleNodeKeyDown(event, version.id)}
                  aria-current={isActive ? "true" : undefined}
                  aria-pressed={isSelected}
                  title={tAuto("studies.v2.versions.nodeTitle", {
                    version: version.version_number,
                    status: version.status,
                  })}
                >
                  <span className={cn("vt-dot", tone)} aria-hidden="true" />
                  <span className="vt-node-text">
                    <span className="vt-label wb-serif">v{version.version_number}</span>
                    <span className="vt-meta wb-mono">
                      {version.status} · {relativeTimeFromNow(version.updated_at)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className={cn("btn-ghost vt-compare-btn", diffOpen && "active")}
          onClick={toggleCompare}
          disabled={!canCompare}
          aria-pressed={diffOpen}
          aria-label={compareLabel}
          title={compareLabel}
        >
          <ArrowLeftRight size={11} aria-hidden="true" />
          {compareLabel}
        </button>
      </div>

      {diffOpen && endpoints.left && endpoints.right ? (
        <div className="vt-diff-panel" role="region" aria-label={tAuto("studies.v2.versions.diffAria")}>
          <div className="vt-diff-head">
            <div className="vt-diff-headline wb-mono">
              {tAuto("studies.v2.versions.diffTitle", {
                left: endpoints.left.version_number,
                right: endpoints.right.version_number,
              })}
            </div>
            <button
              type="button"
              className="btn-ghost vt-diff-close"
              onClick={closeDiff}
              aria-label={tAuto("studies.v2.versions.closeDiff")}
              title={tAuto("studies.v2.versions.closeDiff")}
            >
              <X size={11} aria-hidden="true" />
              {tAuto("studies.v2.versions.close")}
            </button>
          </div>
          <div
            className="vt-diff-grid"
            role="table"
            aria-label={tAuto("studies.v2.versions.diffTableAria")}
          >
            <div className="vt-diff-header-row" role="row">
              <div className="vt-diff-cell vt-diff-cell-header wb-mono" role="columnheader">
                {tAuto("studies.v2.versions.fieldHeader")}
              </div>
              <div className="vt-diff-cell vt-diff-cell-header wb-mono" role="columnheader">
                v{endpoints.left.version_number}
              </div>
              <div className="vt-diff-cell vt-diff-cell-header wb-mono" role="columnheader">
                v{endpoints.right.version_number}
              </div>
            </div>
            {buildDiffRows(endpoints.left, endpoints.right).map((row) => (
              <div className={cn("vt-diff-row", row.changed && "changed")} key={row.field} role="row">
                <div className="vt-diff-cell vt-diff-cell-field wb-mono" role="rowheader">
                  {row.label}
                </div>
                <div
                  className={cn("vt-diff-cell vt-diff-cell-value", row.changed && "changed")}
                  role="cell"
                >
                  {row.leftValue.trim() === "" ? "—" : row.leftValue}
                </div>
                <div
                  className={cn("vt-diff-cell vt-diff-cell-value", row.changed && "changed")}
                  role="cell"
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

function compareButtonLabel(
  versions: ReadonlyArray<StudyDesignVersion>,
  pair: ReadonlyArray<number>,
): string {
  const endpoints = pair.length === 2 ? resolvePair(versions, pair) : { left: null, right: null };
  if (endpoints.left && endpoints.right) {
    return tAuto("studies.v2.versions.compareLabel", {
      left: endpoints.left.version_number,
      right: endpoints.right.version_number,
    });
  }
  const fallback = defaultPair(versions);
  const fallbackEndpoints = resolvePair(versions, fallback);
  if (fallbackEndpoints.left && fallbackEndpoints.right) {
    return tAuto("studies.v2.versions.compareLabel", {
      left: fallbackEndpoints.left.version_number,
      right: fallbackEndpoints.right.version_number,
    });
  }
  return tAuto("studies.v2.versions.compare");
}

function extendSelection(
  current: ReadonlyArray<number>,
  versionId: number,
): SelectionState {
  if (current.includes(versionId)) {
    return { pair: current.filter((id) => id !== versionId) };
  }
  if (current.length < 2) {
    return { pair: [...current, versionId] };
  }
  // Replace the oldest pick with the new one.
  return { pair: [current[1]!, versionId] };
}
