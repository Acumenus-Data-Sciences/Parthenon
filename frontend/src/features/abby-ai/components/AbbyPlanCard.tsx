import type { ActionPlan, PlanStep } from '../types/agency';

// ─── Step Status Icon ────────────────────────────────────────────

function StepStatusIcon({ status }: { status: PlanStep['status'] }) {
  switch (status) {
    case 'pending':
      return <span className="text-muted-foreground text-[13px]">○</span>;
    case 'running':
      return (
        <span className="text-teal-400 text-[13px] animate-pulse">◌</span>
      );
    case 'completed':
      return <span className="text-[#2DD4BF] text-[13px]">●</span>;
    case 'failed':
      return <span className="text-red-400 text-[13px]">✕</span>;
    case 'skipped':
      return <span className="text-muted-foreground text-[13px]">–</span>;
    default:
      return <span className="text-muted-foreground text-[13px]">○</span>;
  }
}

// ─── Plan Step Row ───────────────────────────────────────────────

function PlanStepRow({ step }: { step: PlanStep }) {
  const displayName = step.tool_name.replace(/_/g, ' ');
  const resultMessage =
    step.result && typeof step.result['message'] === 'string'
      ? step.result['message']
      : step.result && typeof step.result['data'] === 'string'
        ? step.result['data']
        : null;

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="mt-0.5 shrink-0 w-4 text-center">
        <StepStatusIcon status={step.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground capitalize">
          {displayName}
        </p>
        {step.error && (
          <p className="text-[11px] text-red-400 mt-0.5 truncate">{step.error}</p>
        )}
        {!step.error && resultMessage && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {resultMessage}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Plan Card ───────────────────────────────────────────────────

interface AbbyPlanCardProps {
  plan: ActionPlan;
  onApprove: (planId: string) => void;
  onCancel: (planId: string) => void;
}

export default function AbbyPlanCard({
  plan,
  onApprove,
  onCancel,
}: AbbyPlanCardProps) {
  const isExecuting = plan.status === 'executing';
  const isCompleted = plan.status === 'completed';
  const isFailed = plan.status === 'failed';
  const isPending = plan.status === 'pending';
  const isCancelled = plan.status === 'cancelled';

  return (
    <div className="rounded-xl border border-[#2DD4BF]/20 bg-[#0E0E11] shadow-md mt-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-gradient-to-r from-teal-900/10 to-transparent">
        <span className="text-[10px] px-1.5 py-px rounded bg-[#2DD4BF]/10 text-[#2DD4BF] font-medium uppercase tracking-wide">
          Action Plan
        </span>
        {isExecuting && (
          <span className="text-[10px] text-teal-400 animate-pulse">
            Executing…
          </span>
        )}
        {isCompleted && (
          <span className="text-[10px] text-[#2DD4BF]">Completed</span>
        )}
        {isFailed && (
          <span className="text-[10px] text-red-400">Failed</span>
        )}
        {isCancelled && (
          <span className="text-[10px] text-muted-foreground">Cancelled</span>
        )}
      </div>

      {/* Description */}
      <div className="px-4 py-3">
        <p className="text-[13px] text-foreground leading-relaxed">
          {plan.description}
        </p>
      </div>

      {/* Steps */}
      <div className="px-4 pb-2 divide-y divide-white/[0.04]">
        {plan.steps.map((step, idx) => (
          <PlanStepRow key={`${step.tool_name}-${idx}`} step={step} />
        ))}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => onApprove(plan.plan_id)}
            className="px-4 py-1.5 rounded-md text-[12px] font-medium bg-[#2DD4BF]/10 hover:bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/30 transition-all duration-150 cursor-pointer"
          >
            Approve &amp; Execute
          </button>
          <button
            type="button"
            onClick={() => onCancel(plan.plan_id)}
            className="px-4 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground border border-white/[0.08] hover:border-white/[0.15] transition-all duration-150 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {isExecuting && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-[12px] text-teal-400">
            <span className="animate-pulse">◌</span>
            <span>Running plan steps…</span>
          </div>
        </div>
      )}

      {(isCompleted || isFailed) && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p
            className={`text-[12px] ${
              isCompleted ? 'text-[#2DD4BF]' : 'text-red-400'
            }`}
          >
            {isCompleted
              ? 'All steps completed successfully.'
              : 'One or more steps failed. Remaining steps were skipped.'}
          </p>
        </div>
      )}
    </div>
  );
}
