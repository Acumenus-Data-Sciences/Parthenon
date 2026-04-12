interface DimensionToggleProps {
  value: 2 | 3;
  onChange: (value: 2 | 3) => void;
  accentColor?: string;
  accentBg?: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

const dimensions: Array<2 | 3> = [2, 3];

export default function DimensionToggle({
  value,
  onChange,
  accentColor = "#C9A227",
  accentBg = "rgba(201, 162, 39, 0.20)",
  disabled,
  disabledTooltip,
}: DimensionToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded border border-[#232328] bg-[#0E0E11] p-0.5">
      <span className="px-1 text-xs text-[#5A5650]">Projection</span>
      {dimensions.map((dimension) => (
        <button
          key={dimension}
          onClick={() => !disabled && onChange(dimension)}
          disabled={disabled}
          title={disabled ? disabledTooltip : undefined}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            value === dimension
              ? ""
              : disabled
                ? "cursor-not-allowed text-[#5A5650]/50"
                : "text-[#5A5650] hover:text-[#8A857D]"
          }`}
          style={value === dimension ? { background: accentBg, color: accentColor } : undefined}
        >
          {dimension}D
        </button>
      ))}
    </div>
  );
}
