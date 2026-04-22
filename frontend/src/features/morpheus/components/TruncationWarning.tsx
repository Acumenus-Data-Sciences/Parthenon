// frontend/src/features/morpheus/components/TruncationWarning.tsx
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TruncationWarningProps {
  loaded: number;
  total: number;
  domain: string;
}

export default function TruncationWarning({ loaded, total, domain }: TruncationWarningProps) {
  const { t } = useTranslation('app');
  if (loaded >= total) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-400">
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        {t('morpheus.truncation.message', {
          loaded: loaded.toLocaleString(),
          total: total.toLocaleString(),
          domain,
        })}
      </span>
    </div>
  );
}
