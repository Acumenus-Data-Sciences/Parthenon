import { useState } from "react";
import type { AbbySourceAttributionProps, AbbySource } from "../../types/abby";

const COLLECTION_LABELS: Record<string, string> = {
  commons_messages: "Discussion",
  review_decisions: "Review decision",
  wiki_articles: "Wiki",
  cohort_definitions: "Cohort",
  concept_sets: "Concept set",
  study_designs: "Study",
  analysis_results: "Analysis",
  announcements: "Announcement",
  object_discussions: "Discussion",
};

function getSourceLabel(source: AbbySource): string {
  const channel = source.metadata.channel_name;
  if (channel) return `#${channel}`;
  return COLLECTION_LABELS[source.collection] ?? source.collection;
}

function getSourceAttribution(source: AbbySource): string {
  const parts: string[] = [];
  if (source.metadata.user_name) {
    parts.push(source.metadata.user_name);
  }
  if (source.metadata.created_at) {
    const date = new Date(source.metadata.created_at);
    parts.push(
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  }
  return parts.join(" · ");
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
      Relevance
      <span className="inline-block w-10 h-[3px] bg-muted rounded-full overflow-hidden align-middle">
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
  const attribution = getSourceAttribution(source);
  return (
    <div
      className="flex gap-2.5 p-2.5 bg-muted/50 rounded-md cursor-pointer hover:bg-muted transition-colors duration-150"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <span className="w-[18px] h-[18px] rounded-full shrink-0 bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-medium text-primary">
            {getSourceLabel(source)}
          </span>
          {attribution && (
            <>
              <span className="opacity-50">·</span>
              <span>{attribution}</span>
            </>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug italic line-clamp-2">
          {source.snippet}
        </p>
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
    <div className="mt-2.5 pt-2.5 border-t border-border">
      <button
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span
          className="transition-transform duration-200 inline-block"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▸
        </span>
        {sources.length} {sources.length === 1 ? "source" : "sources"} from
        institutional memory
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-1.5">
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
