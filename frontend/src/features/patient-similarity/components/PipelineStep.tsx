import { type ReactNode } from 'react';
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
      <div className="mb-2 rounded-lg border border-dashed border-border-default bg-sidebar-bg-light px-4 py-3 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border-default">
              <span className="text-[8px] text-text-ghost">{stepNumber}</span>
            </div>
            <span className="text-xs text-text-muted">{name}</span>
            <span className="text-[10px] text-text-ghost">— {description}</span>
          </div>
          {onRun && (
            <button
              onClick={onRun}
              className="rounded border border-border-default bg-transparent px-2.5 py-1 text-[10px] text-text-ghost transition-colors hover:border-surface-highlight hover:text-text-muted"
            >
              Run ▸
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="mb-2 rounded-lg border border-border-default bg-sidebar-bg-light px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-[#2DD4BF]" />
          <span className="text-xs text-text-primary">{name}</span>
          <span className="text-[10px] text-text-ghost">Running...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mb-2 rounded-lg border border-primary bg-sidebar-bg-light px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
            <span className="text-[11px] text-primary">✕</span>
          </div>
          <span className="text-xs text-text-primary">{name}</span>
          <span className="text-[10px] text-primary">Failed</span>
        </div>
      </div>
    );
  }

  // status === 'completed'
  const borderColor = isExpanded ? 'border-primary' : 'border-success/40';

  return (
    <div className={`mb-2 overflow-hidden rounded-lg border ${borderColor} bg-sidebar-bg-light`}>
      {/* Clickable header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
            <span className="text-[11px] text-success">✓</span>
          </div>
          <span className="text-xs font-medium text-text-primary">{name}</span>
          {!isExpanded && summary && (
            <span className="ml-2 text-[11px] text-text-ghost">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && (
            <span className="text-[10px] text-text-ghost">
              {(executionTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-xs text-text-ghost">{isExpanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border-subtle p-4">{children}</div>
      )}
    </div>
  );
}
