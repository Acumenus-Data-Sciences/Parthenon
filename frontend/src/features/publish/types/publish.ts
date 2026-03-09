// ---------------------------------------------------------------------------
// Publish & Export Types
// ---------------------------------------------------------------------------

export type ExportFormat = "pdf" | "docx" | "xlsx" | "png" | "svg";

export interface ReportSection {
  id: string;
  title: string;
  type: "methods" | "results" | "diagnostics";
  analysisType?: string;
  executionId?: number;
  included: boolean;
  content: unknown;
}

export interface PublishState {
  step: 1 | 2 | 3;
  studyId: number | null;
  selectedExecutionIds: number[];
  sections: ReportSection[];
  exportFormat: ExportFormat;
}
