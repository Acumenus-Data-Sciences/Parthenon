import apiClient from "@/lib/api-client";
import type {
  Investigation,
  EvidencePin,
  PaginatedResponse,
  InvestigationStatus,
  EvidenceDomain,
  ConceptSearchResult,
  ConceptHierarchy,
} from "./types";

// ── Investigations ────────────────────────────────────────────────────

export async function fetchInvestigations(
  status?: InvestigationStatus,
): Promise<PaginatedResponse<Investigation>> {
  const params = status ? { status } : {};
  const { data } = await apiClient.get("/investigations", { params });
  return data;
}

export async function fetchInvestigation(
  id: number,
): Promise<Investigation> {
  const { data } = await apiClient.get(`/investigations/${id}`);
  return data.data;
}

export async function createInvestigation(payload: {
  title: string;
  research_question?: string;
}): Promise<Investigation> {
  const { data } = await apiClient.post("/investigations", payload);
  return data;
}

export async function updateInvestigation(
  id: number,
  payload: Partial<Pick<Investigation, "title" | "research_question" | "status">>,
): Promise<Investigation> {
  const { data } = await apiClient.patch(`/investigations/${id}`, payload);
  return data.data;
}

export async function deleteInvestigation(id: number): Promise<void> {
  await apiClient.delete(`/investigations/${id}`);
}

export async function saveDomainState(
  id: number,
  domain: EvidenceDomain,
  state: Record<string, unknown>,
): Promise<{ saved_at: string; domain: string }> {
  const { data } = await apiClient.patch(
    `/investigations/${id}/state/${domain}`,
    { state },
  );
  return data.data;
}

// ── Evidence Pins ─────────────────────────────────────────────────────

export async function fetchPins(
  investigationId: number,
): Promise<EvidencePin[]> {
  const { data } = await apiClient.get(
    `/investigations/${investigationId}/pins`,
  );
  return data.data;
}

export async function createPin(
  investigationId: number,
  payload: {
    domain: string;
    section: string;
    finding_type: string;
    finding_payload: Record<string, unknown>;
    is_key_finding?: boolean;
  },
): Promise<EvidencePin> {
  const { data } = await apiClient.post(
    `/investigations/${investigationId}/pins`,
    payload,
  );
  return data;
}

export async function updatePin(
  investigationId: number,
  pinId: number,
  payload: Partial<
    Pick<
      EvidencePin,
      "sort_order" | "is_key_finding" | "narrative_before" | "narrative_after" | "section"
    >
  >,
): Promise<EvidencePin> {
  const { data } = await apiClient.patch(
    `/investigations/${investigationId}/pins/${pinId}`,
    payload,
  );
  return data.data;
}

export async function deletePin(
  investigationId: number,
  pinId: number,
): Promise<void> {
  await apiClient.delete(
    `/investigations/${investigationId}/pins/${pinId}`,
  );
}

// ── Concept Explorer ──────────────────────────────────────────────────

export async function searchConcepts(
  query: string,
  domain?: string,
  limit = 25,
): Promise<ConceptSearchResult[]> {
  const params: Record<string, string | number> = { q: query, limit };
  if (domain) params.domain = domain;
  const { data } = await apiClient.get("/concept-explorer/search", { params });
  return data.data ?? data;
}

export async function fetchConceptHierarchy(
  conceptId: number,
): Promise<ConceptHierarchy> {
  const { data } = await apiClient.get(
    `/concept-explorer/${conceptId}/hierarchy`,
  );
  return data.data ?? data;
}

export async function fetchConceptCount(
  conceptId: number,
): Promise<{ concept_id: number; patient_count: number }> {
  const { data } = await apiClient.get(
    `/concept-explorer/${conceptId}/count`,
  );
  return data.data ?? data;
}
