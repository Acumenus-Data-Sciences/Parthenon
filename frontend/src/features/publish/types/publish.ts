// ---------------------------------------------------------------------------
// Publish & Export Types (v2 — Pre-Publication Document Generator)
// ---------------------------------------------------------------------------

export type ExportFormat = "docx" | "pdf" | "figures-zip" | "png" | "svg";

export type SectionType = "title" | "methods" | "results" | "diagram" | "discussion";

export type DiagramType = "consort" | "forest_plot" | "kaplan_meier" | "attrition";

export type NarrativeState = "idle" | "generating" | "draft" | "accepted";

export interface ReportSection {
  id: string;
  title: string;
  type: SectionType;
  analysisType?: string;
  executionId?: number;
  included: boolean;
  content: string;
  narrativeState: NarrativeState;
  diagramType?: DiagramType;
  diagramData?: Record<string, unknown>;
  svgMarkup?: string;
  caption?: string;
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

export interface NarrativeResponse {
  text: string;
  section_type: string;
  error?: string;
}
