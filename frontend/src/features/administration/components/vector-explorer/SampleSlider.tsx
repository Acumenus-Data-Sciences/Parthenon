import { SAMPLE_STEPS } from "./constants";

interface SampleSliderProps {
  value: number;
  onChange: (size: number) => void;
  accentColor?: string;
  accentBg?: string;
}

export default function SampleSlider({
  value,
  onChange,
  accentColor = "#2DD4BF",
  accentBg = "rgba(45, 212, 191, 0.20)",
}: SampleSliderProps) {
  const currentIndex = SAMPLE_STEPS.findIndex((s) => s.value === value);
  const idx = currentIndex >= 0 ? currentIndex : 1;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#5A5650]">Sample</span>
      <div className="flex gap-1 rounded border border-[#232328] bg-[#0E0E11] p-0.5">
        {SAMPLE_STEPS.map((step, i) => (
          <button
            key={step.label}
            onClick={() => onChange(step.value)}
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
