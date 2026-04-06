import { useState } from "react";
import type { AbbySourceAttributionProps, AbbySource } from "../../types/abby";

const COLLECTION_LABELS: Record<string, string> = {
  docs: "Parthenon Documentation",
  conv: "Previous Conversation",
  faq: "FAQ",
  clinical: "Clinical Reference",
  ohdsi: "OHDSI Research Literature",
  textbook: "Medical Textbook Reference",
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

function clampScore(score?: number): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return Math.max(8, Math.min(100, Math.round(score * 100)));
}

function getSourceLabel(source: AbbySource): string {
  return source.label?.trim()
    || source.metadata?.channel_name
    || COLLECTION_LABELS[source.collection]
    || source.collection;
}

function getSourceTitle(source: AbbySource): string {
  return source.title?.trim()
    || source.document_id?.trim()
    || source.metadata?.channel_name
    || getSourceLabel(source);
}

function getSourcePath(source: AbbySource): string | null {
  if (source.source_file?.trim()) return source.source_file.trim();
  if (source.url?.trim()) return source.url.trim();
  return null;
}

function getSourceSubline(source: AbbySource): string {
  return [source.section, getSourcePath(source)]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" · ");
}

function SourceScore({ score }: { score?: number }) {
  const pct = clampScore(score);
  if (pct === null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span>Match {pct}%</span>
      <span className="inline-block h-[3px] w-10 overflow-hidden rounded-full bg-muted">
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
  const label = getSourceLabel(source);
  const title = getSourceTitle(source);
  const subline = getSourceSubline(source);
  const path = getSourcePath(source);
  const hasExternalLink = Boolean(source.url?.trim());

  return (
    <div
      className="rounded-md border border-border/60 bg-muted/40 p-2.5 transition-colors duration-150 hover:bg-muted"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && e.key === "Enter") {
          onClick();
        }
      }}
    >
      <div className="flex gap-2.5">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            <span className="font-medium text-emerald-400">{label}</span>
            <SourceScore score={source.score ?? source.relevance_score} />
            {hasExternalLink && source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline-offset-2 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Open reference
              </a>
            )}
          </div>

          <p className="mt-1 truncate text-[12px] font-medium text-foreground">
            {title}
          </p>

          {subline && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {subline}
            </p>
          )}

          {!subline && path && (
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {path}
            </p>
          )}

          {source.snippet && (
            <p className="mt-1 line-clamp-2 text-[11px] italic leading-snug text-muted-foreground">
              {source.snippet}
            </p>
          )}
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
    <div className="mt-2.5 border-t border-border pt-2.5">
      <button
        className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span
          className="inline-block transition-transform duration-200"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▸
        </span>
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-1.5">
          {sources.map((source, index) => (
            <SourceCard
              key={[
                source.collection,
                source.title ?? "",
                source.source_file ?? "",
                source.url ?? "",
                source.document_id ?? "",
                index,
              ].join("|")}
              source={source}
              rank={index + 1}
              onClick={() => onSourceClick?.(source)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
