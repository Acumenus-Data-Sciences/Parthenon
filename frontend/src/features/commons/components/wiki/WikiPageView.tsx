import { AlertTriangle, FileType } from "lucide-react";
import type { WikiLintIssue, WikiPageDetail } from "../../types/wiki";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function WikiPageView({
  page, onNavigate, lintIssues, onViewSource,
}: {
  page?: WikiPageDetail;
  onNavigate: (slug: string) => void;
  lintIssues: WikiLintIssue[];
  onViewSource?: (filename: string) => void;
}) {
  if (!page) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-[#8A857D]">Select a paper to view</p>
        </div>
      </div>
    );
  }

  const pageIssues = lintIssues.filter((i) => i.page_slug === page.slug);
  const canViewSource = page.stored_filename && page.source_type === "pdf";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header — clean, human-readable */}
      <div className="border-b border-[#232328] bg-[#1C1C20] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-[#F0EDE8]">{page.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8A857D]">
              {page.first_author && <span>{page.first_author}</span>}
              {page.publication_year && <span>{page.publication_year}</span>}
              {page.journal && <span className="truncate">{page.journal}</span>}
              {page.primary_domain && (
                <span className="rounded bg-[#2DD4BF]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#2DD4BF]">
                  {page.primary_domain.replaceAll("-", " ")}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[#5A5650]">
              Last updated {new Date(page.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            {(page.doi || page.pmid || page.pmcid) && (
              <p className="mt-1 text-[11px] text-[#5A5650]">
                {page.doi && <span>DOI {page.doi}</span>}
                {page.pmid && <span>{page.doi ? " • " : ""}PMID {page.pmid}</span>}
                {page.pmcid && <span>{page.doi || page.pmid ? " • " : ""}PMCID {page.pmcid}</span>}
              </p>
            )}
          </div>

          {canViewSource && onViewSource && (
            <button
              type="button"
              onClick={() => onViewSource(page.stored_filename!)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2DD4BF]/20 to-[#A78BFA]/20 border border-[#2DD4BF]/30 px-3 py-2 text-xs font-medium text-[#2DD4BF] transition-all hover:from-[#2DD4BF]/30 hover:to-[#A78BFA]/30"
            >
              <FileType size={14} />
              View PDF
            </button>
          )}
        </div>

        {/* Keywords — only show meaningful ones */}
        {page.keywords.length > 0 && page.keywords[0] !== "source" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {page.keywords
              .filter((kw) => kw !== "source" && kw !== "summary" && kw !== "pdf" && kw !== "text" && kw !== "markdown")
              .map((kw) => (
                <span key={kw} className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
                  {kw}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Lint warnings */}
      {pageIssues.length > 0 && (
        <div className="border-b border-[#C9A227]/20 bg-[#C9A227]/5 px-6 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-[#C9A227]" />
            <div className="space-y-0.5">
              {pageIssues.map((issue) => (
                <p key={issue.message} className="text-xs text-[#C9A227]/80">{issue.message}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <MarkdownRenderer markdown={page.body} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
