import apiClient from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Abby gate ledger API (ADR-0020 Phase 3)
// ---------------------------------------------------------------------------

export type GateStage =
  | "design"
  | "phenotype"
  | "cohort_diagnostics"
  | "data_quality"
  | "study_diagnostics"
  | "estimation_calibration"
  | "publication";

export type GateStatus = "pending" | "passed" | "failed" | "overridden" | "approved";

export interface StudyGate {
  id: number;
  study_id: number;
  stage: GateStage;
  gate_key: string;
  status: GateStatus;
  metrics_json: ({ reasons?: string[] } & Record<string, unknown>) | null;
  threshold_json: Record<string, unknown> | null;
  decision: "auto" | "human";
  decided_by: number | null;
  decided_at: string | null;
  override_rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyGatesResponse {
  data: StudyGate[];
  gating_enabled: boolean;
}

const base = (slug: string): string => `/studies/${slug}/gates`;

export async function listStudyGates(slug: string): Promise<StudyGatesResponse> {
  const { data } = await apiClient.get<StudyGatesResponse>(base(slug));
  return data;
}

export async function evaluateStudyGates(
  slug: string,
): Promise<{ data: StudyGate[]; message: string }> {
  const { data } = await apiClient.post<{ data: StudyGate[]; message: string }>(
    `${base(slug)}/evaluate`,
  );
  return data;
}

export async function approveStudyGate(
  slug: string,
  gateId: number,
): Promise<{ data: StudyGate }> {
  const { data } = await apiClient.post<{ data: StudyGate }>(`${base(slug)}/${gateId}/approve`);
  return data;
}

export async function overrideStudyGate(
  slug: string,
  gateId: number,
  rationale: string,
): Promise<{ data: StudyGate }> {
  const { data } = await apiClient.post<{ data: StudyGate }>(`${base(slug)}/${gateId}/override`, {
    rationale,
  });
  return data;
}
