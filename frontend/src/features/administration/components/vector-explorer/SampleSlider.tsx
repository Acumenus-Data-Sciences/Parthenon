import {
  LARGE_COLLECTION_ALL_THRESHOLD,
  type SampleStep,
} from "./constants";

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
  accentColor = "#2DD4BF",
  accentBg = "rgba(45, 212, 191, 0.20)",
}: SampleSliderProps) {
  const currentIndex = steps.findIndex((step) => step.value === value);
  const idx = currentIndex >= 0 ? currentIndex : 0;

  function handleClick(step: SampleStep) {
    if (step.value === value) {
      return;
    }

    if (step.value === 0 && step.effectiveValue >= LARGE_COLLECTION_ALL_THRESHOLD) {
      const confirmed = window.confirm(
        `Load all ${step.effectiveValue.toLocaleString()} vectors? This may take noticeably longer.`,
      );
      if (!confirmed) {
        return;
      }
    }

    onChange(step.value);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#5A5650]">Sample</span>
      <div className="flex gap-1 rounded border border-[#232328] bg-[#0E0E11] p-0.5">
        {steps.map((step, i) => (
          <button
            key={step.label}
            onClick={() => handleClick(step)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              i === idx ? "" : "text-[#5A5650] hover:text-[#8A857D]"
            }`}
            style={i === idx ? { background: accentBg, color: accentColor } : undefined}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
