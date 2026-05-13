import type { KeyboardEvent } from "react";
import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import {
  NODE_META,
  clamp,
  provenanceColor,
  type NodeId,
  type ProvenanceEntry,
} from "./picoHelpers";

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
      className={cn(
        "pico-node",
        focused && !isFramed && "focused",
        placeholder && "placeholder",
        isFramed && "framed",
        id === "outcome" && focused && "outcome-focused",
      )}
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
          fill="#1E2026"
          stroke={focused && id === "outcome" ? "#2DD4BF" : "rgba(255,255,255,0.10)"}
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
          stroke="rgba(45,212,191,0.18)"
          strokeWidth="3"
          pointerEvents="none"
        />
      ) : null}

      <text
        x={eyebrowX}
        y={eyebrowY}
        fontFamily="var(--wb-font-mono)"
        fontSize="9.5"
        fill={focused && id === "outcome" ? "#2DD4BF" : "#A8A89F"}
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
            className="pico-edit-input wb-serif"
            aria-label={`Edit ${meta.label}`}
            autoFocus
            placeholder={meta.placeholder}
          />
        </foreignObject>
      ) : (
        <text
          x={valueX}
          y={valueY}
          fontFamily="var(--wb-font-display)"
          fontSize="14"
          fill={placeholder ? "#6E6E66" : "#E6E4DE"}
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
            className="pico-edit-save wb-mono"
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
      <circle cx={dotX} cy={dotY} r="3" fill={provenanceColor(provenance.tone)}>
        <title>{provenance.tooltip}</title>
      </circle>
      <text
        x={provenanceTextX}
        y={provenanceTextY}
        fontFamily="var(--wb-font-mono)"
        fontSize="9.5"
        fill="#A8A89F"
      >
        {clamp(provenance.label, 30)}
      </text>
    </g>
  );
}
