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
      <div className="mb-3 rounded-xl border border-dashed border-[#2A2A30] bg-[#151518] px-5 py-3 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#2A2A30]">
              <span className="text-[10px] text-[#5A5650] tabular-nums">{stepNumber}</span>
            </div>
            <span className="text-sm text-[#8A857D]">{name}</span>
            <span className="text-xs text-[#5A5650]">{description}</span>
          </div>
          {onRun && (
            <button
              onClick={onRun}
              className="rounded-md border border-[#2A2A30] bg-[#151518] px-2.5 py-1 text-xs font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
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
      <div className="mb-3 rounded-xl border border-[#2A2A30] bg-[#151518] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Loader2 size={20} className="animate-spin text-[#2DD4BF]" />
          <span className="text-sm font-medium text-[#F0EDE8]">{name}</span>
          <span className="text-xs text-[#8A857D]">Running...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mb-3 rounded-xl border border-[#E85A6B]/40 bg-[#151518] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <XCircle size={20} className="text-[#E85A6B]" />
          <span className="text-sm font-medium text-[#F0EDE8]">{name}</span>
          <span className="text-xs text-[#E85A6B]">Failed</span>
        </div>
      </div>
    );
  }

  // status === 'completed'
  return (
    <div className={cn(
      'mb-3 overflow-hidden rounded-xl border bg-[#151518]',
      isExpanded ? 'border-[#9B1B30]' : 'border-[#2DD4BF]/25',
    )}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={20} className="text-[#2DD4BF]" />
          <span className="text-sm font-medium text-[#F0EDE8]">{name}</span>
          {!isExpanded && summary && (
            <span className="ml-1 text-xs text-[#8A857D]">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && (
            <span className="text-xs text-[#5A5650] tabular-nums">
              {(executionTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={16} className="text-[#5A5650]" />
          ) : (
            <ChevronRight size={16} className="text-[#5A5650]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[#2A2A30] px-5 py-4">{children}</div>
      )}
    </div>
  );
}
