import apiClient from "@/lib/api-client";

export interface SurveyCampaignApi {
  id: number;
  name: string;
  survey_instrument_id: number;
  cohort_generation_id: number | null;
  status: "draft" | "active" | "closed";
  publish_token: string | null;
  description: string | null;
  requires_honest_broker: boolean;
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
  blinded_participant_id?: string | null;
  total_score: string | null;
  survey_start_datetime: string | null;
  survey_end_datetime: string | null;
  created_at: string;
  updated_at: string;
}

export interface HonestBrokerLinkApi {
  id: number;
  survey_campaign_id: number;
  survey_conduct_id: number | null;
  person_id: number | null;
  blinded_participant_id: string;
  match_status: string;
  submitted_at: string | null;
  notes: string | null;
  contact?: HonestBrokerContactApi | null;
  latest_invitation?: HonestBrokerInvitationApi | null;
  created_at: string;
  updated_at: string;
}

export interface HonestBrokerContactApi {
  id: number;
  survey_honest_broker_link_id: number;
  preferred_channel: "email" | "sms";
  delivery_email: string | null;
  delivery_phone: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HonestBrokerInvitationApi {
  id: number;
  survey_campaign_id: number;
  survey_honest_broker_link_id: number;
  survey_honest_broker_contact_id: number | null;
  delivery_channel: "email" | "sms";
  delivery_status: string;
  token_last_four: string;
  sent_at: string | null;
  opened_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_error: string | null;
  message_subject: string | null;
  created_at: string;
  updated_at: string;
  link?: {
    id: number;
    blinded_participant_id: string;
    person_id: number | null;
  } | null;
  contact?: HonestBrokerContactApi | null;
}

export interface HonestBrokerAuditLogApi {
  id: number;
  survey_campaign_id: number | null;
  survey_honest_broker_link_id: number | null;
  survey_honest_broker_invitation_id: number | null;
  action: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  actor: {
    id: number;
    name: string;
    email: string;
  } | null;
  link: {
    id: number;
    blinded_participant_id: string;
  } | null;
  invitation: {
    id: number;
    token_last_four: string;
  } | null;
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
  requires_honest_broker?: boolean;
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

export async function fetchCampaignHonestBrokerLinks(
  campaignId: number,
): Promise<HonestBrokerLinkApi[]> {
  const { data } = await apiClient.get<{ data: HonestBrokerLinkApi[] }>(
    `/survey-campaigns/${campaignId}/honest-broker-links`,
  );

  return data.data;
}

export async function createCampaignHonestBrokerLink(
  campaignId: number,
  payload: {
    respondent_identifier: string;
    person_id?: number | null;
    notes?: string | null;
  },
): Promise<HonestBrokerLinkApi> {
  const { data } = await apiClient.post<{ data: HonestBrokerLinkApi }>(
    `/survey-campaigns/${campaignId}/honest-broker-links`,
    payload,
  );

  return data.data;
}

export async function upsertCampaignHonestBrokerContact(
  campaignId: number,
  linkId: number,
  payload: {
    delivery_email?: string | null;
    delivery_phone?: string | null;
    preferred_channel?: "email" | "sms";
  },
): Promise<HonestBrokerContactApi> {
  const { data } = await apiClient.put<{ data: HonestBrokerContactApi }>(
    `/survey-campaigns/${campaignId}/honest-broker-links/${linkId}/contact`,
    payload,
  );

  return data.data;
}

export async function fetchCampaignHonestBrokerInvitations(
  campaignId: number,
): Promise<HonestBrokerInvitationApi[]> {
  const { data } = await apiClient.get<{ data: HonestBrokerInvitationApi[] }>(
    `/survey-campaigns/${campaignId}/honest-broker-invitations`,
  );

  return data.data;
}

export async function sendCampaignHonestBrokerInvitation(
  campaignId: number,
  payload: {
    survey_honest_broker_link_id: number;
    delivery_email?: string | null;
    delivery_phone?: string | null;
    preferred_channel?: "email" | "sms";
  },
): Promise<{ invitation: HonestBrokerInvitationApi; survey_url: string }> {
  const { data } = await apiClient.post<{
    data: { invitation: HonestBrokerInvitationApi; survey_url: string };
  }>(`/survey-campaigns/${campaignId}/honest-broker-invitations`, payload);

  return data.data;
}

export async function resendCampaignHonestBrokerInvitation(
  campaignId: number,
  invitationId: number,
): Promise<{ invitation: HonestBrokerInvitationApi; survey_url: string }> {
  const { data } = await apiClient.post<{
    data: { invitation: HonestBrokerInvitationApi; survey_url: string };
  }>(`/survey-campaigns/${campaignId}/honest-broker-invitations/${invitationId}/resend`);

  return data.data;
}

export async function revokeCampaignHonestBrokerInvitation(
  campaignId: number,
  invitationId: number,
): Promise<HonestBrokerInvitationApi> {
  const { data } = await apiClient.post<{ data: HonestBrokerInvitationApi }>(
    `/survey-campaigns/${campaignId}/honest-broker-invitations/${invitationId}/revoke`,
  );

  return data.data;
}

export async function fetchCampaignHonestBrokerAuditLogs(
  campaignId: number,
): Promise<HonestBrokerAuditLogApi[]> {
  const { data } = await apiClient.get<{ data: HonestBrokerAuditLogApi[] }>(
    `/survey-campaigns/${campaignId}/honest-broker-audit-logs`,
  );

  return data.data;
}
