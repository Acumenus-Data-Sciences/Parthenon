/**
 * AbbyTypingIndicator
 *
 * Shows Abby's RAG pipeline progress as a series of stages:
 *   ✓ Analyzing your question
 *   ✓ Searching 4 knowledge collections
 *   ⟳ Reading 12 relevant sources
 *   ○ Composing response
 *
 * Each stage transitions through pending → active → done states.
 * The active stage shows a spinner; done stages show a checkmark.
 * This gives researchers transparency into what Abby is doing
 * rather than a generic "typing..." indicator.
 */

import AbbyAvatar from './AbbyAvatar';
import type { AbbyTypingIndicatorProps, RagStage } from '../types/abby';

interface StageConfig {
  key: RagStage;
  label: (state: AbbyTypingIndicatorProps['pipelineState']) => string;
}

const STAGES: StageConfig[] = [
  {
    key: 'analyzing',
    label: () => 'Analyzing your question',
  },
  {
    key: 'retrieving',
    label: (state) =>
      state.collections_count
        ? `Searching ${state.collections_count} knowledge collections`
        : 'Searching knowledge collections',
  },
  {
    key: 'reading',
    label: (state) =>
      state.sources_found
        ? `Reading ${state.sources_found} relevant sources`
        : 'Reading relevant sources',
  },
  {
    key: 'composing',
    label: () => 'Composing response',
  },
];

const STAGE_ORDER: RagStage[] = [
  'analyzing',
  'retrieving',
  'reading',
  'composing',
  'complete',
];

function getStageStatus(
  stageKey: RagStage,
  currentStage: RagStage
): 'done' | 'active' | 'pending' {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const stageIdx = STAGE_ORDER.indexOf(stageKey);

  if (stageIdx < currentIdx) return 'done';
  if (stageIdx === currentIdx) return 'active';
  return 'pending';
}

function Spinner() {
  return (
    <span
      className="
        inline-block w-3 h-3 rounded-full
        border-[1.5px] border-zinc-300 dark:border-zinc-600
        border-t-blue-500 dark:border-t-blue-400
        animate-spin
      "
    />
  );
}

function StageRow({
  config,
  status,
  pipelineState,
}: {
  config: StageConfig;
  status: 'done' | 'active' | 'pending';
  pipelineState: AbbyTypingIndicatorProps['pipelineState'];
}) {
  return (
    <div
      className={`
        flex items-center gap-2 text-[11px]
        transition-colors duration-200
        ${status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : ''}
        ${status === 'active' ? 'text-zinc-800 dark:text-zinc-200 font-medium' : ''}
        ${status === 'pending' ? 'text-zinc-400 dark:text-zinc-600' : ''}
      `}
    >
      {/* Status icon */}
      <span className="w-3.5 flex items-center justify-center">
        {status === 'done' && (
          <span className="text-[10px]">✓</span>
        )}
        {status === 'active' && <Spinner />}
        {status === 'pending' && (
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        )}
      </span>

      {/* Label */}
      <span>{config.label(pipelineState)}</span>
    </div>
  );
}

export default function AbbyTypingIndicator({
  pipelineState,
}: AbbyTypingIndicatorProps) {
  // Don't render if pipeline is complete or hasn't started
  if (
    pipelineState.stage === 'complete' ||
    !STAGE_ORDER.includes(pipelineState.stage)
  ) {
    return null;
  }

  // Error state
  if (pipelineState.stage === 'error') {
    return (
      <div className="flex gap-2.5 px-4 py-3">
        <AbbyAvatar size="md" />
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <span className="text-[11px] text-red-600 dark:text-red-400">
            Something went wrong: {pipelineState.error_message ?? 'Unknown error'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 px-4 py-3 animate-in fade-in duration-300">
      <AbbyAvatar size="md" />

      <div className="flex flex-col gap-1 py-1">
        {STAGES.map((config) => (
          <StageRow
            key={config.key}
            config={config}
            status={getStageStatus(config.key, pipelineState.stage)}
            pipelineState={pipelineState}
          />
        ))}
      </div>
    </div>
  );
}
