import { useTranslation } from "react-i18next";

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
  accentColor = "var(--accent)",
  accentBg = "rgba(201, 162, 39, 0.20)",
  disabled,
  disabledTooltip,
}: DimensionToggleProps) {
  const { t } = useTranslation("app");

  return (
    <div className="flex items-center gap-1 rounded border border-border-default bg-surface-base p-0.5">
      <span className="px-1 text-xs text-text-ghost">
        {t("administration.vectorExplorer.stats.projection")}
      </span>
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
                ? "cursor-not-allowed text-text-ghost/50"
                : "text-text-ghost hover:text-text-muted"
          }`}
          style={value === dimension ? { background: accentBg, color: accentColor } : undefined}
        >
          {t("administration.vectorExplorer.values.dimensions", { dimensions: dimension })}
        </button>
      ))}
    </div>
  );
}
