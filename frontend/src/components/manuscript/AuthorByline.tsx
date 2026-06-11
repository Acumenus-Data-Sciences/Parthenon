/**
 * Author byline for a composed manuscript. Shared so the Studies Manuscript tab
 * and the /publish preview render the author line identically.
 */
export function AuthorByline({ authors, className }: { authors: string[]; className?: string }) {
  if (authors.length === 0) {
    return null;
  }

  return (
    <p className={className ?? "text-sm text-text-muted"}>
      {authors.join(", ")}
    </p>
  );
}
