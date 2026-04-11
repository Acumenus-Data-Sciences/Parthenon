import type { Concept } from "@/features/vocabulary/types/vocabulary";

export type ConceptSetContext = "Entry" | "Inclusion" | "Censoring" | "Era";

export function autoNameConceptSet(
  context: ConceptSetContext,
  concepts: Pick<Concept, "concept_name">[],
): string {
  if (concepts.length === 0) return `${context}: (empty)`;
  const primary = concepts[0].concept_name;
  if (concepts.length === 1) return `${context}: ${primary}`;
  return `${context}: ${primary} + ${concepts.length - 1} more`;
}
