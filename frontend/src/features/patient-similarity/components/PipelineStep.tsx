import { type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepStatus } from '../types/pipeline';

interface PipelineStepProps {
  stepNumber: number;
  name: string;
  description: string;
  status: StepStatus;
  isExpanded?: boolean;
  summary?: string;
  executionTimeMs?: number;
  onToggle: () => void;
  onRun?: () => void;
  children: ReactNode;
}

export function PipelineStep({
  stepNumber,
  name,
  description,
  status,
  isExpanded = false,
  summary,
  executionTimeMs,
  onToggle,
  onRun,
  children,
}: PipelineStepProps) {
  if (status === 'future') {
    return (
      <div className="mb-3 rounded-xl border border-dashed border-border-default bg-surface-raised px-5 py-3 opacity-60 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border-default">
              <span className="text-[10px] text-text-muted tabular-nums">{stepNumber}</span>
            </div>
            <span className="text-sm text-text-secondary">{name}</span>
            <span className="text-xs text-text-muted">{description}</span>
          </div>
          {onRun && (
            <button
              onClick={onRun}
              className="rounded-md border border-border-default bg-surface-base px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
              type="button"
            >
              Run
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="mb-3 rounded-xl border border-border-default bg-surface-raised px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />
          <span className="text-sm font-medium text-text-primary">{name}</span>
          <span className="text-xs text-text-secondary">Running...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mb-3 rounded-xl border border-[var(--color-critical)]/40 bg-surface-raised px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <XCircle size={20} className="text-[var(--color-critical)]" />
          <span className="text-sm font-medium text-text-primary">{name}</span>
          <span className="text-xs text-[var(--color-critical)]">Failed</span>
        </div>
      </div>
    );
  }

  // status === 'completed'
  return (
    <div className={cn(
      'mb-3 overflow-hidden rounded-xl border bg-surface-raised shadow-sm transition-shadow',
      isExpanded
        ? 'border-[var(--color-primary)]/40 shadow-md'
        : 'border-border-default hover:shadow-md',
    )}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={20} className="text-[var(--color-primary)]" />
          <span className="text-sm font-medium text-text-primary">{name}</span>
          {!isExpanded && summary && (
            <span className="ml-1 text-xs text-text-secondary">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && (
            <span className="text-xs text-text-muted tabular-nums">
              {(executionTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={16} className="text-text-muted" />
          ) : (
            <ChevronRight size={16} className="text-text-muted" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border-default bg-surface-base px-5 py-4">{children}</div>
      )}
    </div>
  );
}
