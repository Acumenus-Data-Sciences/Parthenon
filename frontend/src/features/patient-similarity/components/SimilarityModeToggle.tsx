import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getSimilarityModeLabel } from '../lib/i18n';

type SimilarityMode = 'auto' | 'interpretable' | 'embedding';

interface SimilarityModeToggleProps {
  mode: SimilarityMode;
  onChange: (mode: SimilarityMode) => void;
  recommendedMode?: string;
}

const modes: SimilarityMode[] = ["auto", "interpretable", "embedding"];

export function SimilarityModeToggle({ mode, onChange, recommendedMode }: SimilarityModeToggleProps) {
  const { t } = useTranslation("app");

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-full border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-0.5">
        {modes.map((modeValue) => (
          <button
            key={modeValue}
            type="button"
            onClick={() => onChange(modeValue)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              mode === modeValue
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-transparent',
            )}
          >
            {getSimilarityModeLabel(t, modeValue)}
          </button>
        ))}
      </div>
      {mode === 'auto' && recommendedMode && (
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {t("patientSimilarity.diagnostics.recommendedMode", {
            value: getSimilarityModeLabel(
              t,
              recommendedMode as SimilarityMode,
            ),
          })}
        </span>
      )}
    </div>
  );
}
