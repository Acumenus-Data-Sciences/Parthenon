import {
  LARGE_COLLECTION_ALL_THRESHOLD,
  type SampleStep,
} from "./constants";
import { useTranslation } from "react-i18next";

interface SampleSliderProps {
  value: number;
  steps: SampleStep[];
  onChange: (size: number) => void;
  accentColor?: string;
  accentBg?: string;
}

export default function SampleSlider({
  value,
  steps,
  onChange,
  accentColor = "var(--success)",
  accentBg = "rgba(45, 212, 191, 0.20)",
}: SampleSliderProps) {
  const { t } = useTranslation("app");
  const currentIndex = steps.findIndex((step) => step.value === value);
  const idx = currentIndex >= 0 ? currentIndex : 0;

  function labelForStep(step: SampleStep): string {
    return step.labelKey
      ? t(`administration.vectorExplorer.sample.steps.${step.labelKey}`)
      : step.label;
  }

  function handleClick(step: SampleStep) {
    if (step.value === value) {
      return;
    }

    if (step.value === 0 && step.effectiveValue >= LARGE_COLLECTION_ALL_THRESHOLD) {
      const confirmed = window.confirm(
        t("administration.vectorExplorer.sample.confirmLoadAll", {
          count: step.effectiveValue.toLocaleString(),
        }),
      );
      if (!confirmed) {
        return;
      }
    }

    onChange(step.value);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-ghost">
        {t("administration.vectorExplorer.sample.label")}
      </span>
      <div className="flex gap-1 rounded border border-border-default bg-surface-base p-0.5">
        {steps.map((step, i) => (
          <button
            key={`${step.value}:${step.labelKey ?? step.label}`}
            onClick={() => handleClick(step)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              i === idx ? "" : "text-text-ghost hover:text-text-muted"
            }`}
            style={i === idx ? { background: accentBg, color: accentColor } : undefined}
          >
            {labelForStep(step)}
          </button>
        ))}
      </div>
    </div>
  );
}
