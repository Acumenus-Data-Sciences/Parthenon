// frontend/src/features/morpheus/components/ConceptDetailDrawer.tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Hash, Tag, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DOMAIN_COLORS } from '../constants/domainColors';
import { useMorpheusConceptStats } from '../api';

export interface DrawerEvent {
  domain: string;
  concept_id: number | null;
  concept_name: string;
  source_code: string | null;
  source_vocabulary: string | null;
  standard_concept_name: string | null;
  start_date: string | null;
  end_date: string | null;
  // Measurement fields
  value: number | string | null;
  unit: string | null;
  ref_range_lower: number | null;
  ref_range_upper: number | null;
  // Drug fields
  route: string | null;
  dose: string | null;
  days_supply: number | null;
  // Diagnosis fields
  seq_num: number | null;
  // Context
  hadm_id: string | null;
  // History (pre-computed by parent)
  occurrenceCount: number;
  sparklineValues: number[];
}

interface ConceptDetailDrawerProps {
  event: DrawerEvent | null;
  onClose: () => void;
  dataset?: string;
}

function Row({ icon: Icon, label, value, mono }: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      {Icon && <Icon size={12} className="mt-0.5 text-text-ghost shrink-0" />}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-text-ghost">{label}</div>
        <div className={`text-sm text-text-secondary ${mono ? 'font-mono text-success' : ''}`}>{value ?? '\u2014'}</div>
      </div>
    </div>
  );
}

function RangeIndicator({ value, low, high }: { value: number; low: number | null; high: number | null }) {
  if (low == null && high == null) return null;
  if (low != null && value < low) {
    return (
      <span className="inline-flex items-center gap-1 text-info">
        <TrendingDown size={12} /> Below range ({low})
      </span>
    );
  }
  if (high != null && value > high) {
    return (
      <span className="inline-flex items-center gap-1 text-critical">
        <TrendingUp size={12} /> Above range ({high})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-success">
      <Minus size={12} /> Normal ({low}&ndash;{high})
    </span>
  );
}

function MiniSparkline({ values, currentIdx }: { values: number[]; currentIdx?: number }) {
  if (values.length < 2) return null;
  const recent = values.slice(-100);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;
  const w = 200;
  const h = 32;
  const points = recent.map((v, i) => `${(i / (recent.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <svg width={w} height={h} className="my-1">
      <polyline points={points} fill="none" stroke="var(--info)" strokeWidth={1.5} />
      {currentIdx != null && currentIdx < recent.length && (
        <circle
          cx={(currentIdx / (recent.length - 1)) * w}
          cy={h - ((recent[currentIdx] - min) / range) * h}
          r={3}
          fill="var(--text-primary)"
          stroke="var(--info)"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}

export default function ConceptDetailDrawer({ event, onClose, dataset }: ConceptDetailDrawerProps) {
  const { data: popStats } = useMorpheusConceptStats(
    event?.concept_id ?? undefined,
    dataset,
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!event) return null;

  const color = DOMAIN_COLORS[event.domain as keyof typeof DOMAIN_COLORS] ?? '#8A857D';
  const numericValue = typeof event.value === 'number' ? event.value : (typeof event.value === 'string' ? Number(event.value) : null);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[360px] flex-col border-l bg-surface-base"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-highlight px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary truncate">{event.concept_name}</h3>
          <button type="button" onClick={onClose} className="text-text-ghost hover:text-text-secondary transition-colors focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Dual Code Display */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-ghost mb-1">Source Code</div>
              {event.source_code ? (
                <>
                  <div className="font-mono text-sm text-accent">{event.source_code}</div>
                  <div className="text-[10px] text-text-ghost">{event.source_vocabulary}</div>
                </>
              ) : (
                <div className="text-xs text-text-ghost">&mdash;</div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-ghost mb-1">OMOP Concept</div>
              {event.concept_id ? (
                <>
                  <div className="font-mono text-sm text-success">{event.concept_id}</div>
                  <div className="text-[10px] text-text-ghost">{event.standard_concept_name}</div>
                  <span className="inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success">Mapped</span>
                </>
              ) : (
                <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-400">Unmapped</span>
              )}
            </div>
          </div>

          {/* Current Occurrence */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Occurrence Details</div>
            {event.start_date && <Row icon={Tag} label="Date" value={`${event.start_date}${event.end_date ? ` \u2013 ${event.end_date}` : ''}`} />}
            {numericValue != null && !isNaN(numericValue) && (
              <>
                <Row icon={Hash} label="Value" value={`${numericValue} ${event.unit ?? ''}`} />
                <div className="ml-5 text-xs">
                  <RangeIndicator value={numericValue} low={event.ref_range_lower} high={event.ref_range_upper} />
                </div>
              </>
            )}
            {event.route && <Row icon={Tag} label="Route" value={event.route} />}
            {event.dose && <Row icon={Tag} label="Dose" value={event.dose} />}
            {event.seq_num != null && <Row icon={Hash} label="Sequence" value={`#${event.seq_num}`} mono />}
          </div>

          {/* Patient History */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">This Patient</div>
            <div className="text-xs text-text-secondary">
              {event.occurrenceCount} occurrence{event.occurrenceCount !== 1 ? 's' : ''}
            </div>
            {event.sparklineValues.length > 1 && (
              <MiniSparkline values={event.sparklineValues} currentIdx={event.sparklineValues.length - 1} />
            )}
          </div>

          {/* Population Context */}
          {popStats && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Dataset Population</div>
              <div className="text-xs text-text-secondary">
                {popStats.patient_count.toLocaleString()} of {popStats.total_patients.toLocaleString()} patients ({popStats.percentage}%)
              </div>
              {popStats.mean_value != null && (
                <div className="text-xs text-text-muted mt-1">
                  Mean: {popStats.mean_value} | Median: {popStats.median_value}
                </div>
              )}
            </div>
          )}
          {!popStats && event.concept_id && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Dataset Population</div>
              <div className="text-xs text-text-ghost">Population data not available</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-surface-highlight px-4 py-3 space-y-2">
          {event.concept_id && (
            <Link
              to={`/vocabulary?concept=${event.concept_id}`}
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs text-success transition-colors hover:bg-surface-raised focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
              title="View concept in Vocabulary Browser"
            >
              <ExternalLink size={12} /> View in Vocabulary Browser
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
