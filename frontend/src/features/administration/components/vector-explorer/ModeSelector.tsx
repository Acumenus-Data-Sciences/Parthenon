import { MODE_LABELS, type ExplorerMode } from "./constants";

interface ModeSelectorProps {
  activeMode: ExplorerMode;
  onChange: (mode: ExplorerMode) => void;
  accentColor?: string;
  accentBg?: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

const modes: ExplorerMode[] = ["clusters", "query", "qa"];

export default function ModeSelector({
  activeMode,
  onChange,
  accentColor = "#C9A227",
  accentBg = "rgba(201, 162, 39, 0.20)",
  disabled,
  disabledTooltip,
}: ModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg border border-[#232328] bg-[#0E0E11] p-1">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => !disabled && onChange(mode)}
          disabled={disabled}
          title={disabled ? disabledTooltip : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMode !== mode && disabled
              ? "cursor-not-allowed text-[#5A5650]/50"
              : activeMode !== mode
                ? "text-[#8A857D] hover:bg-[#151518] hover:text-[#C5C0B8]"
                : ""
          }`}
          style={activeMode === mode ? { background: accentBg, color: accentColor } : undefined}
        >
          {MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
