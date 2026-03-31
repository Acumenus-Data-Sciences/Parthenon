import apiClient from "@/lib/api-client";

export interface PublicSurveyAnswerOptionApi {
  id: number;
  survey_item_id: number;
  option_text: string;
  option_value: string | null;
  display_order: number;
}

export interface PublicSurveyItemApi {
  id: number;
  survey_instrument_id: number;
  item_number: number;
  item_text: string;
  response_type: string;
  min_value: string | null;
  max_value: string | null;
  display_order: number;
  answer_options: PublicSurveyAnswerOptionApi[];
}

export interface PublicSurveyInstrumentApi {
  id: number;
  name: string;
  abbreviation: string;
  version: string;
  description: string | null;
  domain: string;
  items: PublicSurveyItemApi[];
}

export interface PublicSurveyCampaignApi {
  id: number;
  name: string;
  description: string | null;
  status: "active";
  requires_respondent_identifier?: boolean;
  blinded_participant_id?: string | null;
  delivery_status?: string | null;
  instrument: PublicSurveyInstrumentApi;
}

export interface PublicSurveySubmissionResult {
  conduct_id: number;
  created: number;
  total_score: number | null;
  subscale_scores: Record<string, number>;
}

export async function fetchPublicSurvey(
  token: string,
): Promise<PublicSurveyCampaignApi> {
  const { data } = await apiClient.get<{ data: PublicSurveyCampaignApi }>(
    `/survey-public/${token}`,
  );

  return data.data;
}

export async function submitPublicSurvey(
  token: string,
  payload: {
    responses: Array<{
      survey_item_id: number;
      value: string | number | string[];
    }>;
    respondent_identifier?: string;
  },
): Promise<PublicSurveySubmissionResult> {
  const { data } = await apiClient.post<{ data: PublicSurveySubmissionResult }>(
    `/survey-public/${token}/responses`,
    payload,
  );

  return data.data;
}
