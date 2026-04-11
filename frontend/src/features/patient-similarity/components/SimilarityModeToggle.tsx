import { cn } from '@/lib/utils';

type SimilarityMode = 'auto' | 'interpretable' | 'embedding';

interface SimilarityModeToggleProps {
  mode: SimilarityMode;
  onChange: (mode: SimilarityMode) => void;
  recommendedMode?: string;
}

const modes: { value: SimilarityMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'interpretable', label: 'Interpretable' },
  { value: 'embedding', label: 'Embedding' },
];

export function SimilarityModeToggle({ mode, onChange, recommendedMode }: SimilarityModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-full border border-[#2A2A30] bg-[#151518] p-0.5">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              mode === m.value
                ? 'bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30'
                : 'text-[#5A5650] hover:text-[#C5C0B8] border border-transparent',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'auto' && recommendedMode && (
        <span className="text-[11px] text-[#5A5650]">
          will use {recommendedMode}
        </span>
      )}
    </div>
  );
}
