// ---------------------------------------------------------------------------
// Canonical manuscript document model.
//
// Shared by the Studies "Manuscript" tab (backend ManuscriptComposer output)
// and the /publish workspace, so both features describe a composed publication
// the same way. The /publish editor's persisted `DraftSection`/`DocumentJson`
// is derived from this shape when a study manuscript seeds a draft.
// ---------------------------------------------------------------------------

export interface ManuscriptSection {
  key: string;
  title: string;
  content: string;
  type: string;
  included: boolean;
}

export interface ManuscriptMeta {
  effect_estimates_included: boolean;
  estimation_contrasts: number;
  gating_enabled: boolean;
}

export interface ManuscriptDocument {
  title: string;
  authors: string[];
  template: string;
  sections: ManuscriptSection[];
  manuscript_meta: ManuscriptMeta;
}

export type ManuscriptExportFormat = "docx" | "pdf";
