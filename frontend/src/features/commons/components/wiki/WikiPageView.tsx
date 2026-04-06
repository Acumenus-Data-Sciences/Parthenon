import { AlertTriangle, FileText, Link2, Tags } from "lucide-react";
import type { WikiLintIssue, WikiPageDetail } from "../../types/wiki";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function WikiPageView({
  page,
  onNavigate,
  lintIssues,
}: {
  page?: WikiPageDetail;
  onNavigate: (slug: string) => void;
  lintIssues: WikiLintIssue[];
}) {
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/[0.06] bg-[#15151a] p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">No page selected</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Select a page from the tree to view its content.
          </p>
        </div>
      </div>
    );
  }

  const pageIssues = lintIssues.filter((issue) => issue.page_slug === page.slug);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15151a]">
      <div className="border-b border-white/[0.06] px-6 py-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="rounded-full border border-white/[0.08] px-2 py-0.5">{page.page_type}</span>
          <span>{new Date(page.updated_at).toLocaleString()}</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{page.title}</h2>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {page.path}
          </span>
          {page.source_title && (
            <span className="flex items-center gap-1.5">
              <Tags className="h-3.5 w-3.5" />
              Source: {page.source_title}
            </span>
          )}
          {!!page.links.length && (
            <span className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              {page.links.length} linked page{page.links.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {!!page.keywords.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {page.keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Inline lint warnings for this page */}
      {pageIssues.length > 0 && (
        <div className="border-b border-amber-500/10 bg-amber-500/5 px-6 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
            <div className="space-y-1">
              {pageIssues.map((issue) => (
                <p key={issue.message} className="text-xs text-amber-300/80">
                  {issue.message}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <MarkdownRenderer markdown={page.body} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
