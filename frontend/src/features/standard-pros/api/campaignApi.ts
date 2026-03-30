import apiClient from "@/lib/api-client";

export interface SurveyCampaignApi {
  id: number;
  name: string;
  survey_instrument_id: number;
  cohort_generation_id: number | null;
  status: "draft" | "active" | "closed";
  publish_token: string | null;
  description: string | null;
  closed_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  instrument?: {
    id: number;
    name: string;
    abbreviation: string;
  };
  creator?: {
    id: number;
    name: string;
  } | null;
  stats?: CampaignStatsApi;
}

export interface CampaignStatsApi {
  seeded_total: number;
  complete: number;
  pending: number;
  anonymous: number;
  completion_rate: number;
}

export interface SurveyCampaignDetailApi extends SurveyCampaignApi {
  stats: CampaignStatsApi;
}

export interface SurveyConductRecordApi {
  id: number;
  person_id: number | null;
  survey_instrument_id: number;
  campaign_id: number | null;
  completion_status: string;
  total_score: string | null;
  survey_start_datetime: string | null;
  survey_end_datetime: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedCampaignResponse {
  data: SurveyCampaignApi[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface StoreCampaignPayload {
  name: string;
  survey_instrument_id: number;
  cohort_generation_id?: number | null;
  description?: string | null;
}

export async function fetchCampaigns(params?: {
  status?: SurveyCampaignApi["status"];
  per_page?: number;
}): Promise<PaginatedCampaignResponse> {
  const { data } = await apiClient.get<PaginatedCampaignResponse>(
    "/survey-campaigns",
    { params },
  );

  return data;
}

export async function fetchCampaign(id: number): Promise<SurveyCampaignDetailApi> {
  const { data } = await apiClient.get<SurveyCampaignDetailApi>(
    `/survey-campaigns/${id}`,
  );

  return data;
}

export async function createCampaign(payload: StoreCampaignPayload): Promise<SurveyCampaignApi> {
  const { data } = await apiClient.post<SurveyCampaignApi>(
    "/survey-campaigns",
    payload,
  );

  return data;
}

export async function updateCampaign(
  id: number,
  payload: StoreCampaignPayload,
): Promise<SurveyCampaignApi> {
  const { data } = await apiClient.put<SurveyCampaignApi>(
    `/survey-campaigns/${id}`,
    payload,
  );

  return data;
}

export async function deleteCampaign(id: number): Promise<void> {
  await apiClient.delete(`/survey-campaigns/${id}`);
}

export async function activateCampaign(id: number): Promise<SurveyCampaignApi> {
  const { data } = await apiClient.post<SurveyCampaignApi>(
    `/survey-campaigns/${id}/activate`,
  );

  return data;
}

export async function closeCampaign(id: number): Promise<SurveyCampaignApi> {
  const { data } = await apiClient.post<SurveyCampaignApi>(
    `/survey-campaigns/${id}/close`,
  );

  return data;
}

export async function fetchCampaignConductRecords(
  id: number,
  params?: { status?: string },
): Promise<SurveyConductRecordApi[]> {
  const { data } = await apiClient.get<{ data: SurveyConductRecordApi[] }>(
    `/survey-campaigns/${id}/conduct-records`,
    { params },
  );

  return data.data;
}

export async function importCampaignResponses(
  id: number,
  csv_content: string,
): Promise<{
  processed: number;
  matched: number;
  missing: number;
  created_responses: number;
}> {
  const { data } = await apiClient.post<{
    data: {
      processed: number;
      matched: number;
      missing: number;
      created_responses: number;
    };
  }>(`/survey-campaigns/${id}/import`, { csv_content });

  return data.data;
}

export async function storeConductResponses(
  conductId: number,
  responses: Array<{ survey_item_id: number; value: string | number | string[] }>,
): Promise<{
  conduct_id: number;
  created: number;
  total_score: number | null;
  subscale_scores: Record<string, number>;
}> {
  const { data } = await apiClient.post<{
    data: {
      conduct_id: number;
      created: number;
      total_score: number | null;
      subscale_scores: Record<string, number>;
    };
  }>(`/survey-conduct/${conductId}/responses`, {
    responses,
    replace_existing: true,
  });

  return data.data;
}
