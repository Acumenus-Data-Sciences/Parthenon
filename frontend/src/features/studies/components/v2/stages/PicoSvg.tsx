import type { KeyboardEvent } from "react";
import { tAuto } from "@/i18n/autoUserFacing";
import type { IntentFormState } from "../../workbench/studyDesignWorkbenchHelpers";
import { clamp, type NodeId, type ProvenanceEntry } from "./picoHelpers";
import { PicoNode } from "./PicoNode";

interface PicoSvgProps {
  formState: IntentFormState;
  focusedNode: NodeId;
  editingNode: NodeId | null;
  editValue: string;
  provenance: Record<NodeId, ProvenanceEntry>;
  immutable: boolean;
  onFocusNode: (node: NodeId) => void;
  onBeginEdit: (node: NodeId) => void;
  onChangeEdit: (value: string) => void;
  onCommitEdit: () => void;
  onEditKey: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function PicoSvg({
  formState,
  focusedNode,
  editingNode,
  editValue,
  provenance,
  immutable,
  onFocusNode,
  onBeginEdit,
  onChangeEdit,
  onCommitEdit,
  onEditKey,
}: PicoSvgProps) {
  return (
    <svg
      className="block h-auto w-full rounded-lg border border-border-default bg-surface-base"
      viewBox="0 0 720 420"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={tAuto("studies.v2.pico.svgLabel")}
    >
      <defs>
        <marker
          id="pico-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
        </marker>
      </defs>

      {/* Population frame (dashed) + interactive Population node */}
      <g>
        <rect
          x="14"
          y="20"
          width="450"
          height="380"
          rx="6"
          ry="6"
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <PicoNode
          id="population"
          frame={{ x: 14, y: 20, width: 450, height: 380, framed: true }}
          value={formState.population}
          focused={focusedNode === "population"}
          editing={editingNode === "population"}
          editValue={editValue}
          provenance={provenance.population}
          immutable={immutable}
          onFocus={onFocusNode}
          onBeginEdit={onBeginEdit}
          onChangeEdit={onChangeEdit}
          onCommitEdit={onCommitEdit}
          onEditKey={onEditKey}
        />
      </g>

      {/* Exposure node */}
      <PicoNode
        id="exposure"
        frame={{ x: 40, y: 140, width: 220, height: 86 }}
        value={formState.exposure}
        focused={focusedNode === "exposure"}
        editing={editingNode === "exposure"}
        editValue={editValue}
        provenance={provenance.exposure}
        immutable={immutable}
        onFocus={onFocusNode}
        onBeginEdit={onBeginEdit}
        onChangeEdit={onChangeEdit}
        onCommitEdit={onCommitEdit}
        onEditKey={onEditKey}
      />

      {/* Comparator branch (dashed) */}
      <g aria-hidden="true">
        <path
          d="M150 226 C 150 252, 150 264, 150 278"
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text
          x="158"
          y="260"
          fontSize="9.5"
          fill="var(--text-ghost)"
          letterSpacing="1.2"
        >
          COMPARE TO
        </text>
      </g>

      {/* Comparator node */}
      <PicoNode
        id="comparator"
        frame={{ x: 40, y: 284, width: 220, height: 86 }}
        value={formState.comparator}
        focused={focusedNode === "comparator"}
        editing={editingNode === "comparator"}
        editValue={editValue}
        provenance={provenance.comparator}
        immutable={immutable}
        onFocus={onFocusNode}
        onBeginEdit={onBeginEdit}
        onChangeEdit={onChangeEdit}
        onCommitEdit={onCommitEdit}
        onEditKey={onEditKey}
      />

      {/* Arrow Exposure → Outcome with time-at-risk pill */}
      <g aria-hidden="true">
        <path
          d="M260 183 C 360 183, 380 183, 488 183"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.25"
          markerEnd="url(#pico-arrow)"
        />
        <g transform="translate(290 168)">
          <rect
            x="0"
            y="0"
            width="180"
            height="30"
            rx="4"
            ry="4"
            fill="var(--surface-elevated)"
            stroke="var(--border-default)"
            strokeWidth="0.75"
          />
          <text
            x="10"
            y="13"
            fontSize="8.5"
            fill="var(--text-muted)"
            letterSpacing="1.2"
          >
            TIME AT RISK
          </text>
          <text
            x="10"
            y="25"
            fontSize="10"
            fill="var(--text-primary)"
          >
            {clamp(formState.time || tAuto("studies.v2.pico.timeUnset"), 38)}
          </text>
        </g>
      </g>

      {/* Outcome node (typically focused by default) */}
      <PicoNode
        id="outcome"
        frame={{ x: 490, y: 140, width: 216, height: 116 }}
        value={formState.outcome}
        focused={focusedNode === "outcome"}
        editing={editingNode === "outcome"}
        editValue={editValue}
        provenance={provenance.outcome}
        immutable={immutable}
        onFocus={onFocusNode}
        onBeginEdit={onBeginEdit}
        onChangeEdit={onChangeEdit}
        onCommitEdit={onCommitEdit}
        onEditKey={onEditKey}
        outcomeTall
      />

      {/* Outcome → downstream measures whisper line */}
      <g opacity="0.55" aria-hidden="true">
        <path
          d="M598 256 L 598 300 L 552 300"
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <text
          x="486"
          y="312"
          fontSize="9"
          fill="var(--text-ghost)"
          letterSpacing="1.2"
        >
          → HR · KM · COMPETING RISK
        </text>
      </g>
    </svg>
  );
}
