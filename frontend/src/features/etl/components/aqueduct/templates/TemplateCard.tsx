import { cn } from "@/lib/utils";
import type { Template } from "../../../types/templates";

export type TemplateCardProps = Pick<
  Template,
  "id" | "name" | "description" | "category" | "tags" | "cdm_versions"
> & {
  onSelect: (id: string) => void;
};

export function TemplateCard(props: TemplateCardProps) {
  const { id, name, description, category, tags, cdm_versions, onSelect } =
    props;

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
      className={cn(
        "group relative flex w-full flex-col items-start gap-3 rounded-xl border border-border-default bg-surface-raised p-5 text-left transition",
        "hover:border-critical hover:shadow-lg hover:shadow-critical/10",
        "focus:outline-none focus-visible:border-critical focus-visible:ring-2 focus-visible:ring-critical/40",
      )}
      aria-label={name}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-primary truncate">
            {name}
          </h3>
          <p className="mt-1 text-sm text-text-muted line-clamp-2">
            {description}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-surface-overlay px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-ghost">
          {category}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {cdm_versions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cdm_versions.map((v) => (
            <span
              key={v}
              className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success"
            >
              CDM {v}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
