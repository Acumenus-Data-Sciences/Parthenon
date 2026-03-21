import type { EvidencePin } from "../../types";
import { NarrativeEditor } from "./NarrativeEditor";
import { PinCard } from "../PinCard";

interface SectionEditorProps {
  sectionKey: string;
  sectionLabel: string;
  pins: EvidencePin[];
  narrative: string | null;
  onNarrativeChange: (sectionKey: string, text: string) => void;
  onToggleKeyFinding: (pinId: number, current: boolean) => void;
  onDeletePin: (pinId: number) => void;
  onUpdatePinNarrative: (
    pinId: number,
    field: "narrative_before" | "narrative_after",
    text: string,
  ) => void;
}

export function SectionEditor({
  sectionKey,
  sectionLabel,
  pins,
  narrative,
  onNarrativeChange,
  onToggleKeyFinding,
  onDeletePin,
  onUpdatePinNarrative,
}: SectionEditorProps) {
  const pinCount = pins.length;

  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-200">{sectionLabel}</span>
        <span
          className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-medium ${
            pinCount > 0 ? "bg-teal-900 text-teal-300" : "bg-zinc-700 text-zinc-400"
          }`}
        >
          {pinCount}
        </span>
      </div>

      {/* Section-level narrative */}
      <div className="mb-3">
        <NarrativeEditor
          value={narrative}
          onChange={(text) => onNarrativeChange(sectionKey, text)}
          placeholder="Add section narrative..."
        />
      </div>

      {/* Pin list */}
      {pins.length > 0 ? (
        <div className="flex flex-col gap-3 mt-2">
          {pins.map((pin) => (
            <div key={pin.id} className="flex flex-col gap-1">
              <NarrativeEditor
                value={pin.narrative_before}
                onChange={(text) => onUpdatePinNarrative(pin.id, "narrative_before", text)}
                placeholder="Add note before..."
              />
              <PinCard
                pin={pin}
                onDelete={onDeletePin}
                onToggleKeyFinding={onToggleKeyFinding}
              />
              <NarrativeEditor
                value={pin.narrative_after}
                onChange={(text) => onUpdatePinNarrative(pin.id, "narrative_after", text)}
                placeholder="Add note after..."
              />
            </div>
          ))}
        </div>
      ) : (
        !narrative && (
          <p className="text-xs text-zinc-600 mt-1">No findings pinned to this section yet</p>
        )
      )}
    </div>
  );
}
