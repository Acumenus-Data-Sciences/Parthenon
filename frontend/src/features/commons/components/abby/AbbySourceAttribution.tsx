import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { AbbySourceAttributionProps, AbbySource } from "../../types/abby";

const COLLECTION_LABEL_KEYS: Record<string, string> = {
  docs: "abby.sourceAttribution.collections.docs",
  conv: "abby.sourceAttribution.collections.conv",
  faq: "abby.sourceAttribution.collections.faq",
  clinical: "abby.sourceAttribution.collections.clinical",
  ohdsi: "abby.sourceAttribution.collections.ohdsi",
  textbook: "abby.sourceAttribution.collections.textbook",
  wiki: "abby.sourceAttribution.collections.wiki",
  commons_messages: "abby.sourceAttribution.collections.commonsMessages",
  review_decisions: "abby.sourceAttribution.collections.reviewDecisions",
  wiki_articles: "abby.sourceAttribution.collections.wikiArticles",
  cohort_definitions: "abby.sourceAttribution.collections.cohortDefinitions",
  concept_sets: "abby.sourceAttribution.collections.conceptSets",
  study_designs: "abby.sourceAttribution.collections.studyDesigns",
  analysis_results: "abby.sourceAttribution.collections.analysisResults",
  announcements: "abby.sourceAttribution.collections.announcements",
  object_discussions: "abby.sourceAttribution.collections.objectDiscussions",
};

function clampScore(score?: number): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return Math.max(8, Math.min(100, Math.round(score * 100)));
}

function getSourceLabel(
  source: AbbySource,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  return (
    source.label?.trim() ||
    source.metadata?.channel_name ||
    t(COLLECTION_LABEL_KEYS[source.collection] ?? source.collection, {
      defaultValue: source.collection,
    }) ||
    source.collection
  );
}

function getSourceTitle(
  source: AbbySource,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  return (
    source.title?.trim() ||
    source.document_id?.trim() ||
    source.metadata?.channel_name ||
    getSourceLabel(source, t)
  );
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

type AbbySourceNavigationTarget =
  | { type: "internal"; to: string }
  | { type: "external"; href: string };

function clean(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function metadataValue(source: AbbySource, keys: string[]): string | null {
  for (const key of keys) {
    const value = clean(source.metadata?.[key]);
    if (value) return value;
  }

  return null;
}

function positiveInteger(value?: string | null): string | null {
  const trimmed = clean(value);
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  return Number(trimmed) > 0 ? trimmed : null;
}

function artifactId(source: AbbySource, metadataKeys: string[]): string | null {
  return (
    positiveInteger(metadataValue(source, metadataKeys)) ??
    positiveInteger(source.document_id)
  );
}

function routeTarget(to: string): AbbySourceNavigationTarget {
  return { type: "internal", to };
}

function resolveAbbySourceNavigation(
  source: AbbySource,
): AbbySourceNavigationTarget | null {
  const url = clean(source.url);
  if (url) {
    if (url.startsWith("/")) return { type: "internal", to: url };
    if (/^https?:\/\//i.test(url)) return { type: "external", href: url };
  }

  const collection = source.collection.toLowerCase();
  const sourceId = artifactId(source, ["source_id", "data_source_id"]);
  const cohortId = artifactId(source, ["cohort_id", "cohort_definition_id"]);
  const conceptSetId = artifactId(source, ["concept_set_id"]);
  const studyId = artifactId(source, ["study_id"]);

  if (["data_source", "data_sources", "sources"].includes(collection) && sourceId) {
    return routeTarget(`/data-explorer/${sourceId}`);
  }

  if (
    ["cohort_definition", "cohort_definitions"].includes(collection) &&
    cohortId
  ) {
    return routeTarget(`/cohort-definitions/${cohortId}`);
  }

  if (["concept_set", "concept_sets"].includes(collection) && conceptSetId) {
    return routeTarget(`/concept-sets/${conceptSetId}`);
  }

  if (["study", "study_design", "study_designs"].includes(collection) && studyId) {
    return routeTarget(`/studies/${studyId}`);
  }

  const channelSlug = metadataValue(source, ["channel_slug"]);
  const messageId = positiveInteger(metadataValue(source, ["message_id"]));
  if (
    ["commons_messages", "conv", "object_discussions"].includes(collection) &&
    channelSlug
  ) {
    const highlight = messageId ? `?highlight=${messageId}` : "";
    return routeTarget(`/commons/${encodeURIComponent(channelSlug)}${highlight}`);
  }

  return null;
}

function SourceScore({ score }: { score?: number }) {
  const { t } = useTranslation("commons");
  const pct = clampScore(score);
  if (pct === null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span>{t("abby.sourceAttribution.match", { pct })}</span>
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
  const { t } = useTranslation("commons");
  const label = getSourceLabel(source, t);
  const title = getSourceTitle(source, t);
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
                {t("abby.sourceAttribution.openReference")}
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
  const { t } = useTranslation("commons");
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!sources.length) return null;

  function handleSourceClick(source: AbbySource) {
    if (onSourceClick) {
      onSourceClick(source);
      return;
    }

    const target = resolveAbbySourceNavigation(source);
    if (!target) return;

    if (target.type === "internal") {
      navigate(target.to);
      return;
    }

    window.open(target.href, "_blank", "noopener,noreferrer");
  }

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
        {t("abby.sourceAttribution.sourceCount", { count: sources.length })}
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
              onClick={
                onSourceClick || resolveAbbySourceNavigation(source)
                  ? () => handleSourceClick(source)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
