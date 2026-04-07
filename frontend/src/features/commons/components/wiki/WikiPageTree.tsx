import { AlertTriangle, FileText, FileType } from "lucide-react";
import type { WikiLintIssue, WikiPageSummary } from "../../types/wiki";

interface SourceEntry {
  slug: string;
  title: string;
  sourceType: string | null;
  updatedAt: string;
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
    } else {
      // Always use the human-readable title, never the slug
      const displayTitle = page.title;
      sources.set(key, {
        slug: key,
        title: displayTitle,
        sourceType: page.source_type ?? null,
        updatedAt: page.updated_at,
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

  // Sort by most recently updated (newest first)
  return Array.from(sources.values()).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
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
  // Filter by search query
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
        // Find the best page to select when clicked (prefer concept over source_summary)
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
                ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                : "text-[#C5C0B8] hover:bg-[#1C1C20]"
            }`}
          >
            {/* File type icon */}
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
              source.sourceType === "pdf"
                ? "bg-[#E85A6B]/10 text-[#E85A6B]"
                : "bg-[#60A5FA]/10 text-[#60A5FA]"
            }`}>
              {source.sourceType === "pdf" ? <FileType size={14} /> : <FileText size={14} />}
            </div>

            {/* Title + metadata */}
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${isSelected ? "text-[#2DD4BF]" : "text-[#F0EDE8]"}`}>
                {source.title}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                {source.sourceType && (
                  <span className="text-[10px] font-medium uppercase text-[#5A5650]">
                    {TYPE_ICONS[source.sourceType] ?? source.sourceType}
                  </span>
                )}
                <span className="text-[10px] text-[#5A5650]">
                  {new Date(source.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Lint warning */}
            {source.hasIssues && (
              <AlertTriangle size={12} className="flex-shrink-0 text-[#C9A227]" />
            )}
          </button>
        );
      })}

      {sources.length === 0 && (
        <div className="px-3 py-12 text-center">
          <FileText size={24} className="mx-auto mb-2 text-[#323238]" />
          <p className="text-xs text-[#5A5650]">
            {searchQuery ? "No papers match this search." : "No papers ingested yet."}
          </p>
        </div>
      )}
    </div>
  );
}
