// ---------------------------------------------------------------------------
// Publish & Export Types (v2 — Pre-Publication Document Generator)
// ---------------------------------------------------------------------------

export type ExportFormat = "docx" | "pdf" | "figures-zip" | "png" | "svg" | "xlsx";

export type SectionType = "title" | "methods" | "results" | "diagram" | "discussion" | "diagnostics";

export type DiagramType = "consort" | "forest_plot" | "kaplan_meier" | "attrition";

export type NarrativeState = "idle" | "generating" | "draft" | "accepted";

export interface ReportSection {
  id: string;
  title: string;
  type: SectionType;
  analysisType?: string;
  executionId?: number;
  included: boolean;
  content: string | Record<string, unknown> | null;
  narrativeState: NarrativeState;
  diagramType?: DiagramType;
  diagramData?: Record<string, unknown>;
  svgMarkup?: string;
  caption?: string;
  tableData?: TableData;
  tableIncluded?: boolean;
  narrativeIncluded?: boolean;
  diagramIncluded?: boolean;
  /**
   * Raw analysis result for the section's primary execution, used to render the
   * typed headline-metric summary in the editor's "Structured" view. Runtime
   * only — derived from the selected execution, not persisted in the draft.
   */
  resultSummary?: Record<string, unknown> | null;
}

export interface SelectedExecution {
  executionId: number;
  analysisId: number;
  analysisType: string;
  analysisName: string;
  studyId?: number;
  studyTitle?: string;
  resultJson: Record<string, unknown> | null;
  designJson: Record<string, unknown> | null;
}

export interface PublishState {
  step: 1 | 2 | 3 | 4;
  selectedExecutions: SelectedExecution[];
  sections: ReportSection[];
  title: string;
  authors: string[];
  template: string;
  exportFormat: ExportFormat;
}

export interface TableData {
  caption: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
  footnotes?: string[];
}

export interface NarrativeResponse {
  text: string;
  section_type: string;
  error?: string;
}

export interface PublicationReportBundleArtifact {
  format: "ohdsi_report_bundle" | "ohdsi_report_generator_r" | "ohdsi_sharing_bundle";
  mime_type: string;
  download_name: string;
  content: unknown;
}

export interface PublicationReportBundleExportRequest {
  format: PublicationReportBundleArtifact["format"] | string;
  title: string;
  authors: string[];
  template: string;
  sections: Array<Record<string, unknown>>;
  selected_executions?: SelectedExecution[];
  draft_id?: number | null;
}

export interface ImportPublicationReportBundlePayload {
  format: PublicationReportBundleArtifact["format"] | string;
  artifact: unknown;
  title?: string;
}

export interface ImportPublicationReportBundleResult {
  draft: PublicationDraft;
  bundle: {
    id: number;
    publication_draft_id: number | null;
    user_id: number | null;
    direction: "import" | "export";
    format: string;
    bundle_json: unknown;
    metadata_json: Record<string, unknown> | null;
    created_at: string | null;
    updated_at: string | null;
  };
}

// ── Persisted draft types (Phase 1) ─────────────────────────────────────────

export interface DraftSelectedExecution {
  studyId?: number;
  studyTitle?: string;
  analysisId?: number;
  executionId?: number;
  analysisType: string;
  analysisName?: string;
  designJson?: Record<string, unknown>;
  // resultJson is NEVER persisted — re-fetched on demand
}

export interface DraftSectionTableData {
  caption?: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
  footnotes?: string[];
}

export interface DraftSection {
  id: string;
  type: "introduction" | "methods" | "results" | "discussion" | "diagram";
  analysisType?: string;
  title: string;
  content: string;
  included: boolean;
  narrativeIncluded?: boolean;
  tableIncluded?: boolean;
  diagramIncluded?: boolean;
  diagramType?: string;
  tableData?: DraftSectionTableData;
  svgMarkup?: string;
  executionId?: number;
}

export interface DocumentJson {
  version: 1;
  title: string;
  authors: string[];
  template: string;
  step: 1 | 2 | 3 | 4;
  selectedExecutions: DraftSelectedExecution[];
  sections: DraftSection[];
}

export type PublicationDraftStatus = "draft" | "ready" | "archived";

export type PublicationDraftVisibility = "private" | "study";

export interface PublicationDraft {
  id: number;
  user_id: number;
  study_id: number | null;
  study_slug?: string | null;
  study_title?: string | null;
  source?: string | null;
  title: string;
  template: string;
  document_json: DocumentJson;
  status: PublicationDraftStatus;
  visibility: PublicationDraftVisibility;
  updated_by_user_id: number | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicationDraftInput {
  study_id?: number | null;
  title: string;
  template: string;
  document_json: DocumentJson;
  status?: PublicationDraftStatus;
  visibility?: PublicationDraftVisibility;
}
