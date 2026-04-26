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

export interface PublicationDraft {
  id: number;
  user_id: number;
  study_id: number | null;
  title: string;
  template: string;
  document_json: Partial<PublishState> & Record<string, unknown>;
  status: "draft" | "ready" | "archived";
  last_opened_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PublicationDraftInput {
  study_id?: number | null;
  title: string;
  template?: string;
  document_json: Partial<PublishState> & Record<string, unknown>;
  status?: PublicationDraft["status"];
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
