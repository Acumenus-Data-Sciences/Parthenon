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
  accentColor = "var(--accent)",
  accentBg = "rgba(201, 162, 39, 0.20)",
  disabled,
  disabledTooltip,
}: ModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg border border-border-default bg-surface-base p-1">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => !disabled && onChange(mode)}
          disabled={disabled}
          title={disabled ? disabledTooltip : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeMode !== mode && disabled
              ? "cursor-not-allowed text-text-ghost/50"
              : activeMode !== mode
                ? "text-text-muted hover:bg-surface-raised hover:text-text-secondary"
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
