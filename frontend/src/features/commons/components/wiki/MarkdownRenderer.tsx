import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

function normalizeWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, slug) => {
    const normalizedSlug = String(slug).trim();
    return `[${normalizedSlug}](/__wiki__/${normalizedSlug})`;
  });
}

export function MarkdownRenderer({
  markdown,
  onNavigate,
}: {
  markdown: string;
  onNavigate: (slug: string) => void;
}) {
  return (
    <div className="prose prose-invert max-w-none prose-headings:tracking-tight prose-a:text-primary prose-pre:bg-black/40">
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
                  className="rounded px-1 text-primary underline-offset-4 transition hover:bg-primary/10 hover:underline"
                >
                  {children}
                </button>
              );
            }

            return (
              <a href={href} target="_blank" rel="noreferrer">
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
