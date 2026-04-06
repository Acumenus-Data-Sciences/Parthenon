import { Link2, FileText, Tags } from "lucide-react";
import type { WikiPageDetail } from "../../types/wiki";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function WikiPageView({
  page,
  onNavigate,
}: {
  page?: WikiPageDetail;
  onNavigate: (slug: string) => void;
}) {
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/[0.06] bg-[#15151a] p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">No wiki page selected</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Select a page from the tree or ingest a new source to populate the workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15151a]">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="rounded-full border border-white/[0.08] px-2 py-1">{page.page_type}</span>
          <span>{new Date(page.updated_at).toLocaleString()}</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{page.title}</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            {page.path}
          </span>
          {page.source_title && (
            <span className="flex items-center gap-2">
              <Tags className="h-3.5 w-3.5" />
              Source: {page.source_title}
            </span>
          )}
          {!!page.links.length && (
            <span className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5" />
              {page.links.length} linked page{page.links.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {!!page.keywords.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {page.keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <MarkdownRenderer markdown={page.body} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
