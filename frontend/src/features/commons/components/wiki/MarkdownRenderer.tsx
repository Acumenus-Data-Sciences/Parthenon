import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function normalizeWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, label) => {
    const display = String(label).trim();
    return `[${display}](/__wiki__/${slugify(display)})`;
  });
}

export function MarkdownRenderer({
  markdown, onNavigate,
}: {
  markdown: string;
  onNavigate: (slug: string) => void;
}) {
  return (
    <div className="wiki-prose max-w-none text-sm leading-relaxed text-text-secondary
      [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-text-primary
      [&_h2]:mt-5 [&_h2]:mb-2.5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-text-primary
      [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-text-primary
      [&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-text-primary
      [&_p]:mb-3 [&_p]:leading-relaxed
      [&_ul]:mb-3 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1
      [&_ol]:mb-3 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1
      [&_li]:text-text-secondary [&_li]:leading-relaxed
      [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-success/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-muted
      [&_code]:rounded [&_code]:bg-surface-overlay [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-['IBM_Plex_Mono',monospace] [&_code]:text-xs [&_code]:text-accent
      [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border-default [&_pre]:bg-surface-base [&_pre]:p-4
      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-text-secondary
      [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse
      [&_th]:border [&_th]:border-border-default [&_th]:bg-surface-overlay [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-text-muted
      [&_td]:border [&_td]:border-border-default [&_td]:px-3 [&_td]:py-2 [&_td]:text-text-secondary
      [&_hr]:my-4 [&_hr]:border-border-default
      [&_strong]:font-semibold [&_strong]:text-text-primary
      [&_em]:italic [&_em]:text-text-muted
      [&_a]:text-success [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors hover:[&_a]:text-success
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("/__wiki__/")) {
              const slug = href.slice("/__wiki__/".length);
              return (
                <button
                  type="button"
                  onClick={() => onNavigate(slug)}
                  className="inline rounded px-1 text-success underline underline-offset-2 transition-colors hover:bg-success/10 hover:text-success"
                >
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-success underline underline-offset-2 transition-colors hover:text-success">
                {children}
              </a>
            );
          },
        }}
      >
        {normalizeWikiLinks(markdown)}
      </ReactMarkdown>
    </div>
  );
}
