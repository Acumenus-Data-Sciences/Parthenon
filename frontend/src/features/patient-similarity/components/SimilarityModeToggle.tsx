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
      <div className="flex items-center rounded-full border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-0.5">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              mode === m.value
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-transparent',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'auto' && recommendedMode && (
        <span className="text-[11px] text-[var(--color-text-muted)]">
          will use {recommendedMode}
        </span>
      )}
    </div>
  );
}
