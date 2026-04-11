import { useFeasibilityTemplates } from "../../../hooks/useNetworkData";
import type { FeasibilityCriteria, FeasibilityTemplate } from "../../../types/ares";

interface TemplateSelectorProps {
  onSelect: (criteria: FeasibilityCriteria, name: string) => void;
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const { data: templates, isLoading } = useFeasibilityTemplates();

  if (isLoading) {
    return <span className="text-[10px] text-[#555]">Loading templates...</span>;
  }

  if (!templates || templates.length === 0) {
    return null;
  }

  const handleSelect = (template: FeasibilityTemplate) => {
    const criteria: FeasibilityCriteria = {
      required_domains: (template.criteria as Record<string, unknown>).required_domains as string[] ?? [],
      required_concepts: (template.criteria as Record<string, unknown>).required_concepts as number[] ?? undefined,
      visit_types: (template.criteria as Record<string, unknown>).visit_types as number[] ?? undefined,
      date_range: (template.criteria as Record<string, unknown>).date_range as { start: string; end: string } ?? undefined,
      min_patients: (template.criteria as Record<string, unknown>).min_patients as number ?? undefined,
    };
    onSelect(criteria, template.name);
  };

  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs text-[#888]">Start from Template</label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t: FeasibilityTemplate) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleSelect(t)}
            className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-xs text-[#ccc] transition-colors hover:border-accent hover:text-accent"
            title={t.description ?? undefined}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
