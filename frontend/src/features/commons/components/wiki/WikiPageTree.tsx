import { useDeferredValue } from "react";
import { BookOpen, ChevronDown, FolderTree, Plus, Search, AlertTriangle } from "lucide-react";
import type { WikiLintIssue, WikiPageSummary, WikiWorkspace } from "../../types/wiki";

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
  workspaces,
  workspace,
  onWorkspaceChange,
  draftWorkspaceName,
  onDraftChange,
  onCreateWorkspace,
  creatingWorkspace,
  lintIssues,
}: {
  pages: WikiPageSummary[];
  selectedSlug: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (slug: string) => void;
  workspaces: WikiWorkspace[];
  workspace: string;
  onWorkspaceChange: (workspace: string) => void;
  draftWorkspaceName: string;
  onDraftChange: (value: string) => void;
  onCreateWorkspace: () => void;
  creatingWorkspace: boolean;
  lintIssues: WikiLintIssue[];
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

  const issuesBySlug = lintIssues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.page_slug] = (acc[issue.page_slug] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15151a]">
      {/* Workspace selector — compact */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <FolderTree className="h-3.5 w-3.5" />
          Workspace
        </div>
        <div className="relative mt-2">
          <select
            value={workspace}
            onChange={(event) => onWorkspaceChange(event.target.value)}
            className="w-full appearance-none rounded-lg border border-white/[0.08] bg-[#111115] py-1.5 pl-3 pr-8 text-sm text-foreground outline-none transition focus:border-primary/50"
          >
            {workspaces.map((ws) => (
              <option key={ws.name} value={ws.name}>
                {ws.name} ({ws.page_count})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="mt-2 flex gap-1.5">
          <input
            value={draftWorkspaceName}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="new workspace"
            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#111115] px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-primary/50"
          />
          <button
            type="button"
            onClick={onCreateWorkspace}
            disabled={creatingWorkspace || !draftWorkspaceName.trim()}
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {creatingWorkspace ? "..." : "New"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Pages</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">{pages.length}</span>
        </div>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search pages..."
            className="w-full rounded-lg border border-white/[0.08] bg-[#111115] py-1.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary/50"
          />
        </div>
      </div>

      {/* Page tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {Object.entries(groups).map(([pageType, groupPages]) => (
          <div key={pageType} className="mb-3">
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {TYPE_LABELS[pageType] ?? pageType}
            </p>
            <div className="space-y-0.5">
              {groupPages.map((page) => {
                const issueCount = issuesBySlug[page.slug] ?? 0;
                return (
                  <button
                    key={page.slug}
                    type="button"
                    onClick={() => onSelect(page.slug)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                      selectedSlug === page.slug
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{page.title}</p>
                    </div>
                    {issueCount > 0 && (
                      <span title={`${issueCount} lint issue${issueCount > 1 ? "s" : ""}`}>
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {filteredPages.length === 0 && pages.length > 0 && (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">No pages match this filter.</p>
        )}
      </div>
    </div>
  );
}
