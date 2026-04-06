import { useDeferredValue } from "react";
import { BookOpen, Search } from "lucide-react";
import type { WikiPageSummary } from "../../types/wiki";

const TYPE_LABELS: Record<string, string> = {
  source_summary: "Sources",
  entity: "Entities",
  concept: "Concepts",
  comparison: "Comparisons",
  analysis: "Analyses",
};

export function WikiPageTree({
  pages,
  selectedSlug,
  searchQuery,
  onSearchChange,
  onSelect,
}: {
  pages: WikiPageSummary[];
  selectedSlug: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (slug: string) => void;
}) {
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredPages = pages.filter((page) => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return true;
    return (
      page.title.toLowerCase().includes(normalized) ||
      page.slug.toLowerCase().includes(normalized) ||
      page.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
    );
  });

  const groups = filteredPages.reduce<Record<string, WikiPageSummary[]>>((acc, page) => {
    const key = page.page_type;
    acc[key] = [...(acc[key] ?? []), page];
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15151a]">
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Wiki Tree</h2>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search pages..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#111115] py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {Object.entries(groups).map(([pageType, groupPages]) => (
          <div key={pageType} className="mb-4">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {TYPE_LABELS[pageType] ?? pageType}
            </p>
            <div className="space-y-1">
              {groupPages.map((page) => (
                <button
                  key={page.slug}
                  type="button"
                  onClick={() => onSelect(page.slug)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition ${
                    selectedSlug === page.slug
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  }`}
                >
                  <p className="text-sm font-medium">{page.title}</p>
                  <p className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {page.slug}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredPages.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">No wiki pages match this filter.</p>
        )}
      </div>
    </div>
  );
}
