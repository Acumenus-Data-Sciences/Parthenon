/**
 * Renders the composer's lightweight content format: blocks separated by blank
 * lines, with `### ` lines becoming subheadings. Shared by the Studies
 * Manuscript tab and the /publish preview so the same prose renders identically
 * in both surfaces. Avoids pulling in a markdown dependency for the limited
 * formatting the composer actually emits.
 */
export function ManuscriptSectionRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter((block) => block.trim() !== "");

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.startsWith("### ")) {
          const [heading, ...rest] = block.split("\n");
          return (
            <div key={index}>
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-1">
                {heading.replace(/^###\s+/, "")}
              </h4>
              {rest.length > 0 && (
                <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">
                  {rest.join("\n")}
                </p>
              )}
            </div>
          );
        }

        return (
          <p key={index} className="text-sm text-text-muted leading-relaxed whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}
