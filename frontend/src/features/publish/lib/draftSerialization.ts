import type {
  DocumentJson,
  DraftSection,
  DraftSelectedExecution,
} from "../types/publish";

export interface WizardSerializableState {
  title: string;
  authors: string[];
  template: string;
  step: 1 | 2 | 3 | 4;
  selectedExecutions: Array<DraftSelectedExecution & { resultJson?: unknown }>;
  sections: DraftSection[];
}

export function serializeForSave(state: WizardSerializableState): DocumentJson {
  return {
    version: 1,
    title: state.title,
    authors: state.authors,
    template: state.template,
    step: state.step,
    selectedExecutions: state.selectedExecutions.map((exec) => {
      // Drop resultJson — never persisted.
      const { resultJson: _drop, ...rest } = exec;
      return rest;
    }),
    sections: state.sections,
  };
}

export function deserializeFromLoad(doc: DocumentJson): WizardSerializableState {
  const validSteps = [1, 2, 3, 4] as const;
  const step = (validSteps as readonly number[]).includes(doc.step)
    ? doc.step
    : 1;
  return {
    title: doc.title ?? "",
    authors: doc.authors ?? [],
    template: doc.template ?? "generic-ohdsi",
    step: step as 1 | 2 | 3 | 4,
    selectedExecutions: doc.selectedExecutions ?? [],
    sections: doc.sections ?? [],
  };
}
