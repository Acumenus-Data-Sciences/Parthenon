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
      <div className="mb-2 rounded-lg border border-dashed border-[#333] bg-[#131316] px-4 py-3 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#444]">
              <span className="text-[8px] text-[#555]">{stepNumber}</span>
            </div>
            <span className="text-xs text-[#777]">{name}</span>
            <span className="text-[10px] text-[#555]">— {description}</span>
          </div>
          {onRun && (
            <button
              onClick={onRun}
              className="rounded border border-[#444] bg-transparent px-2.5 py-1 text-[10px] text-[#555] transition-colors hover:border-[#666] hover:text-[#888]"
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
      <div className="mb-2 rounded-lg border border-[#333] bg-[#131316] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#333] border-t-[#2DD4BF]" />
          <span className="text-xs text-[#ddd]">{name}</span>
          <span className="text-[10px] text-[#555]">Running...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mb-2 rounded-lg border border-[#9B1B30] bg-[#131316] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9B1B3020]">
            <span className="text-[11px] text-[#9B1B30]">✕</span>
          </div>
          <span className="text-xs text-[#ddd]">{name}</span>
          <span className="text-[10px] text-[#9B1B30]">Failed</span>
        </div>
      </div>
    );
  }

  // status === 'completed'
  const borderColor = isExpanded ? 'border-[#9B1B30]' : 'border-[#2DD4BF40]';

  return (
    <div className={`mb-2 overflow-hidden rounded-lg border ${borderColor} bg-[#131316]`}>
      {/* Clickable header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2DD4BF20]">
            <span className="text-[11px] text-[#2DD4BF]">✓</span>
          </div>
          <span className="text-xs font-medium text-[#ddd]">{name}</span>
          {!isExpanded && summary && (
            <span className="ml-2 text-[11px] text-[#555]">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && (
            <span className="text-[10px] text-[#555]">
              {(executionTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-xs text-[#555]">{isExpanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[#222] p-4">{children}</div>
      )}
    </div>
  );
}
