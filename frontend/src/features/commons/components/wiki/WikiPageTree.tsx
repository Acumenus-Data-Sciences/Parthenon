import { AlertTriangle, FileText, FileType } from "lucide-react";
import type { WikiLintIssue, WikiPageSummary } from "../../types/wiki";

interface SourceEntry {
  slug: string;
  title: string;
  sourceType: string | null;
  updatedAt: string;
  ingestedAt: string;
  firstAuthor: string | null;
  publicationYear: string | null;
  childPages: WikiPageSummary[];
  hasIssues: boolean;
}

function buildSourceList(pages: WikiPageSummary[], lintIssues: WikiLintIssue[]): SourceEntry[] {
  const issueSet = new Set(lintIssues.map((i) => i.page_slug));

  // Group by source_slug, or treat each page as its own source
  const sources = new Map<string, SourceEntry>();

  for (const page of pages) {
    const key = page.source_slug ?? page.slug;
    const existing = sources.get(key);
    if (existing) {
      existing.childPages.push(page);
      if (issueSet.has(page.slug)) existing.hasIssues = true;
      // Use the most recent updated_at
      if (page.updated_at > existing.updatedAt) existing.updatedAt = page.updated_at;
      // Use the earliest ingested_at for the source group
      const pageIngested = page.ingested_at ?? page.updated_at;
      if (pageIngested < existing.ingestedAt) existing.ingestedAt = pageIngested;
      if (!existing.firstAuthor && page.first_author) existing.firstAuthor = page.first_author;
      if (!existing.publicationYear && page.publication_year) existing.publicationYear = page.publication_year;
    } else {
      const displayTitle = page.title;
      sources.set(key, {
        slug: key,
        title: displayTitle,
        sourceType: page.source_type ?? null,
        updatedAt: page.updated_at,
        ingestedAt: page.ingested_at ?? page.updated_at,
        firstAuthor: page.first_author ?? null,
        publicationYear: page.publication_year ?? null,
        childPages: [page],
        hasIssues: issueSet.has(page.slug),
      });
    }
  }

  // Fix titles: prefer the source_summary title for grouped sources
  for (const entry of sources.values()) {
    const summary = entry.childPages.find((p) => p.page_type === "source_summary");
    if (summary) entry.title = summary.title;
  }

  // Sort by most recently ingested (newest first)
  return Array.from(sources.values()).sort(
    (a, b) => b.ingestedAt.localeCompare(a.ingestedAt),
  );
}

const TYPE_ICONS: Record<string, string> = {
  pdf: "PDF",
  markdown: "MD",
  text: "TXT",
};

export function WikiPageTree({
  pages,
  selectedSlug,
  searchQuery,
  onSelect,
  lintIssues,
}: {
  pages: WikiPageSummary[];
  selectedSlug: string | null;
  searchQuery: string;
  onSelect: (slug: string) => void;
  lintIssues: WikiLintIssue[];
}) {
  // Client-side keyword filtering for instant feedback
  const filtered = pages.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  });

  const sources = buildSourceList(filtered, lintIssues);

  return (
    <div className="space-y-0.5 px-2 py-2">
      {sources.map((source) => {
        const conceptPage = source.childPages.find((p) => p.page_type !== "source_summary");
        const targetSlug = conceptPage?.slug ?? source.childPages[0]?.slug ?? source.slug;
        const isSelected = source.childPages.some((p) => p.slug === selectedSlug);

        return (
          <button
            key={source.slug}
            type="button"
            onClick={() => onSelect(targetSlug)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
              isSelected
                ? "bg-success/10 text-success"
                : "text-text-secondary hover:bg-surface-overlay"
            }`}
          >
            {/* File type icon */}
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
              source.sourceType === "pdf"
                ? "bg-critical/10 text-critical"
                : "bg-info/10 text-info"
            }`}>
              {source.sourceType === "pdf" ? <FileType size={14} /> : <FileText size={14} />}
            </div>

            {/* Title + metadata */}
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${isSelected ? "text-success" : "text-text-primary"}`}>
                {source.title}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                {source.sourceType && (
                  <span className="text-[10px] font-medium uppercase text-text-ghost">
                    {TYPE_ICONS[source.sourceType] ?? source.sourceType}
                  </span>
                )}
                {source.firstAuthor && (
                  <span className="truncate text-[10px] text-text-ghost">
                    {source.firstAuthor}
                  </span>
                )}
                {source.publicationYear && (
                  <span className="text-[10px] text-text-ghost">
                    {source.publicationYear}
                  </span>
                )}
                <span className="text-[10px] text-text-ghost">
                  {new Date(source.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Lint warning */}
            {source.hasIssues && (
              <AlertTriangle size={12} className="flex-shrink-0 text-accent" />
            )}
          </button>
        );
      })}

      {sources.length === 0 && (
        <div className="px-3 py-12 text-center">
          <FileText size={24} className="mx-auto mb-2 text-text-ghost" />
          <p className="text-xs text-text-ghost">
            {searchQuery ? "No papers match this search." : "No papers ingested yet."}
          </p>
        </div>
      )}
    </div>
  );
}
