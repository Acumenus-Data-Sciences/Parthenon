/**
 * AbbySourceAttribution
 *
 * Expandable panel showing which pieces of institutional memory
 * informed Abby's response. Each source shows its origin (channel,
 * wiki, review), a snippet, and a relevance score bar.
 *
 * Collapsed by default to keep responses clean — researchers who
 * want provenance can expand; those who just want the answer aren't
 * slowed down.
 */

import { useState } from 'react';
import type { AbbySourceAttributionProps, AbbySource } from '../types/abby';

/** Maps ChromaDB collection names to human-readable labels */
const COLLECTION_LABELS: Record<string, string> = {
  commons_messages: 'Discussion',
  review_decisions: 'Review decision',
  wiki_articles: 'Wiki',
  cohort_definitions: 'Cohort',
  concept_sets: 'Concept set',
  study_designs: 'Study',
  analysis_results: 'Analysis',
  announcements: 'Announcement',
  object_discussions: 'Discussion',
};

function getSourceLabel(source: AbbySource): string {
  const base = COLLECTION_LABELS[source.collection] ?? source.collection;
  const channel = source.metadata.channel_name;
  if (channel) return `#${channel}`;
  return base;
}

function getSourceAttribution(source: AbbySource): string {
  const parts: string[] = [];

  if (source.metadata.user_name) {
    parts.push(source.metadata.user_name);
  }

  if (source.metadata.created_at) {
    const date = new Date(source.metadata.created_at);
    parts.push(
      date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
  }

  return parts.join(' · ');
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
      Relevance
      <span className="inline-block w-10 h-[3px] bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden align-middle">
        <span
          className="block h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

function SourceCard({
  source,
  rank,
  onClick,
}: {
  source: AbbySource;
  rank: number;
  onClick?: () => void;
}) {
  return (
    <div
      className="
        flex gap-2.5 p-2.5
        bg-zinc-50 dark:bg-zinc-800/50
        rounded-md
        cursor-pointer
        hover:bg-zinc-100 dark:hover:bg-zinc-800
        transition-colors duration-150
      "
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Rank badge */}
      <span
        className="
          w-[18px] h-[18px] rounded-full shrink-0
          bg-zinc-200 dark:bg-zinc-700
          flex items-center justify-center
          text-[9px] font-medium text-zinc-500 dark:text-zinc-400
        "
      >
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        {/* Origin line */}
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {getSourceLabel(source)}
          </span>
          {getSourceAttribution(source) && (
            <>
              <span className="opacity-50">·</span>
              <span>{getSourceAttribution(source)}</span>
            </>
          )}
        </div>

        {/* Snippet */}
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug italic line-clamp-2">
          {source.snippet}
        </p>

        {/* Relevance */}
        <div className="mt-1">
          <RelevanceBar score={source.relevance_score} />
        </div>
      </div>
    </div>
  );
}

export default function AbbySourceAttribution({
  sources,
  defaultExpanded = false,
  onSourceClick,
}: AbbySourceAttributionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!sources.length) return null;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-zinc-200/60 dark:border-zinc-700/60">
      {/* Toggle */}
      <button
        className="
          flex items-center gap-1.5
          text-[11px] text-zinc-400 dark:text-zinc-500
          hover:text-zinc-600 dark:hover:text-zinc-300
          transition-colors duration-150
          cursor-pointer select-none
        "
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="transition-transform duration-200" style={{
          display: 'inline-block',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          ▸
        </span>
        {sources.length} {sources.length === 1 ? 'source' : 'sources'} from
        institutional memory
      </button>

      {/* Source cards */}
      {expanded && (
        <div className="mt-2 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {sources.map((source, i) => (
            <SourceCard
              key={source.document_id}
              source={source}
              rank={i + 1}
              onClick={() => onSourceClick?.(source)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
