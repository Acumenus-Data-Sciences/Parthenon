import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Undo2 } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";
import {
  NODE_META,
  clamp,
  type NodeId,
  type ProvenanceEntry,
  type ProvenanceTone,
} from "./picoHelpers";

// Provenance dot color, mapped to theme tokens. Mirrors the tone→color mapping
// formerly provided by picoHelpers.provenanceColor (which emitted now-removed
// `--wb-*` vars): teal=success, gold=warning, slate=ghost text.
function provenanceDotColor(tone: ProvenanceTone): string {
  if (tone === "teal") return "var(--success)";
  if (tone === "gold") return "var(--warning)";
  return "var(--text-ghost)";
}

interface PicoNodeProps {
  id: NodeId;
  frame: { x: number; y: number; width: number; height: number; framed?: boolean };
  value: string;
  focused: boolean;
  editing: boolean;
  editValue: string;
  provenance: ProvenanceEntry;
  immutable: boolean;
  outcomeTall?: boolean;
  onFocus: (id: NodeId) => void;
  onBeginEdit: (id: NodeId) => void;
  onChangeEdit: (value: string) => void;
  onCommitEdit: () => void;
  onEditKey: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function PicoNode({
  id,
  frame,
  value,
  focused,
  editing,
  editValue,
  provenance,
  immutable,
  outcomeTall = false,
  onFocus,
  onBeginEdit,
  onChangeEdit,
  onCommitEdit,
  onEditKey,
}: PicoNodeProps) {
  const meta = NODE_META[id];
  const isFramed = frame.framed === true;
  const placeholder = value.trim().length === 0;
  const displayValue = placeholder ? meta.placeholder : value;

  // Phase 5 motion polish: when a node's provenance tone transitions from
  // `gold` (lint warning) to `teal` (cleared), play the breathing keyframe
  // once. Strictly visual — does not affect interactivity.
  const previousTone = useRef<ProvenanceEntry["tone"] | null>(null);
  const [breathing, setBreathing] = useState(false);
  useEffect(() => {
    const prev = previousTone.current;
    if (prev === "gold" && provenance.tone === "teal") {
      setBreathing(true);
      const timer = window.setTimeout(() => setBreathing(false), 220);
      previousTone.current = provenance.tone;
      return () => window.clearTimeout(timer);
    }
    previousTone.current = provenance.tone;
    return undefined;
  }, [provenance.tone]);

  // For the dashed Population frame we don't draw an inner rect — the dashed
  // border is the only chrome. For the other nodes, draw the filled card.
  const interactionX = isFramed ? frame.x + 16 : frame.x;
  const interactionY = isFramed ? frame.y + 12 : frame.y;
  const interactionW = isFramed ? frame.width - 32 : frame.width;
  const interactionH = isFramed ? 92 : frame.height;

  const eyebrowX = isFramed ? frame.x + 16 : frame.x + 14;
  const eyebrowY = isFramed ? frame.y + 22 : frame.y + 20;
  const valueX = eyebrowX;
  const valueY = eyebrowY + 22;
  const dotX = eyebrowX + 2;
  const dotY = valueY + (outcomeTall ? 60 : 36);
  const provenanceTextX = dotX + 10;
  const provenanceTextY = dotY + 3;
  const editInputY = valueY - 16;

  return (
    <g
      className={breathing ? "cursor-pointer animate-pulse" : "cursor-pointer"}
      onClick={() => onFocus(id)}
    >
      {!isFramed ? (
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          rx="6"
          ry="6"
          fill="var(--surface-elevated)"
          stroke={
            focused && id === "outcome"
              ? "var(--success)"
              : "var(--border-default)"
          }
          strokeWidth="1"
        />
      ) : null}
      {focused && id === "outcome" ? (
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          rx="6"
          ry="6"
          fill="none"
          stroke="var(--success)"
          strokeOpacity="0.18"
          strokeWidth="3"
          pointerEvents="none"
        />
      ) : null}

      <text
        x={eyebrowX}
        y={eyebrowY}
        fontSize="9.5"
        fill={focused && id === "outcome" ? "var(--success)" : "var(--text-muted)"}
        letterSpacing="1.5"
      >
        {meta.eyebrow}
        {focused && !isFramed ? " · FOCUSED" : null}
      </text>

      {editing ? (
        <foreignObject
          x={valueX - 4}
          y={editInputY}
          width={interactionW - 16}
          height={32}
        >
          <input
            type="text"
            value={editValue}
            onChange={(event) => onChangeEdit(event.target.value)}
            onKeyDown={onEditKey}
            onBlur={onCommitEdit}
            className="h-7 w-full rounded-md border border-success bg-surface-elevated px-2 text-[13.5px] text-text-primary outline-none placeholder:text-text-ghost placeholder:italic"
            aria-label={`Edit ${meta.label}`}
            autoFocus
            placeholder={meta.placeholder}
          />
        </foreignObject>
      ) : (
        <text
          x={valueX}
          y={valueY}
          fontSize="14"
          fontStyle={placeholder ? "italic" : undefined}
          fill={placeholder ? "var(--text-ghost)" : "var(--text-primary)"}
        >
          {clamp(displayValue, 38)}
        </text>
      )}

      {/* Click target — covers the node area for focus+edit. */}
      <rect
        x={interactionX}
        y={interactionY}
        width={interactionW}
        height={interactionH}
        fill="transparent"
        style={{ cursor: immutable ? "default" : "text" }}
        onDoubleClick={() => onBeginEdit(id)}
        onClick={(event) => {
          if (focused && !editing) {
            event.stopPropagation();
            onBeginEdit(id);
          } else {
            onFocus(id);
          }
        }}
      >
        <title>
          {meta.label}: {placeholder ? meta.placeholder : value}
        </title>
      </rect>

      {/* Save affordance during edit. */}
      {editing ? (
        <foreignObject
          x={valueX + interactionW - 56}
          y={editInputY + 6}
          width={48}
          height={22}
        >
          <button
            type="button"
            className="inline-flex h-[22px] w-[46px] items-center justify-center gap-1 rounded-md border border-success/45 bg-success/10 text-[9.5px] uppercase tracking-wide text-text-primary"
            onMouseDown={(event) => {
              // mouseDown beats input blur so the save fires before the input
              // loses focus and triggers commitEdit again.
              event.preventDefault();
              onCommitEdit();
            }}
            aria-label={tAuto("studies.v2.pico.saveEdit")}
          >
            <Undo2 size={10} aria-hidden="true" />
          </button>
        </foreignObject>
      ) : null}

      {/* Provenance dot + label */}
      <circle cx={dotX} cy={dotY} r="3" fill={provenanceDotColor(provenance.tone)}>
        <title>{provenance.tooltip}</title>
      </circle>
      <text
        x={provenanceTextX}
        y={provenanceTextY}
        fontSize="9.5"
        fill="var(--text-muted)"
      >
        {clamp(provenance.label, 30)}
      </text>
    </g>
  );
}
