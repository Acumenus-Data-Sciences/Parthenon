// frontend/src/features/morpheus/components/SearchDropdown.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMorpheusPatientSearch } from '../api';
import { getMorpheusGenderLabel } from '../lib/i18n';

interface SearchDropdownProps {
  dataset?: string;
  onSelect: (subjectId: string) => void;
}

export default function SearchDropdown({ dataset, onSelect }: SearchDropdownProps) {
  const { t } = useTranslation('app');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: results, isLoading } = useMorpheusPatientSearch(debouncedQuery, dataset);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!results) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) {
      onSelect(results[selectedIdx].subject_id);
      setIsOpen(false);
      setQuery('');
      setDebouncedQuery('');
      setSelectedIdx(-1);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIdx(-1);
    }
  }, [results, selectedIdx, onSelect]);

  const showResults = isOpen && debouncedQuery.length >= 1;

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIdx(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (debouncedQuery.length >= 1) setIsOpen(true); }}
          placeholder={t('morpheus.common.search.patientPlaceholder')}
          className="w-full rounded-lg border border-border-default bg-surface-base pl-9 pr-3 py-2 text-sm text-text-secondary placeholder:text-text-ghost focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-surface-highlight bg-surface-overlay shadow-xl z-30 max-h-64 overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-4 text-center text-xs text-text-muted">{t('morpheus.common.search.searching')}</div>
          )}
          {!isLoading && results && results.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-text-muted">{t('morpheus.common.data.noPatientsFound')}</div>
          )}
          {results?.map((p, i) => (
            <button
              key={p.subject_id}
              type="button"
              onClick={() => {
                onSelect(p.subject_id);
                setIsOpen(false);
                setQuery('');
                setDebouncedQuery('');
                setSelectedIdx(-1);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                ${i === selectedIdx ? 'bg-success/10' : 'hover:bg-surface-overlay'}
                focus:outline-none`}
            >
              <span className="font-mono text-sm text-success">{p.subject_id}</span>
              <span className="text-xs text-text-muted">{getMorpheusGenderLabel(t, p.gender)}</span>
              <span className="text-xs text-text-muted">
                {t('morpheus.common.search.age')} {p.anchor_age ?? '\u2014'}
              </span>
              <span className="text-xs text-text-ghost ml-auto">
                {p.admission_count} {t('morpheus.common.values.admissionsShort')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
