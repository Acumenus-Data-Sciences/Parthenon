import apiClient from "@/lib/api-client";
import type {
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbyFeedbackRequest,
  AbbyConversationSummary,
  AbbyConversationMessage,
} from "../types/abby";
import type { AbbyProfileResponse, AbbyProfileUpdateRequest } from '../../abby-ai/types/memory';
import type { ExecutePlanResponse } from '../../abby-ai/types/agency';

export async function queryAbby(
  request: AbbyQueryRequest
): Promise<AbbyQueryResponse> {
  const { data } = await apiClient.post<{
    reply?: string;
    message?: string;
    suggestions?: string[];
    conversation_id?: number | null;
  }>(
    "/abby/chat",
    {
      message: request.query,
      page_context: request.page_context ?? "commons_ask_abby",
      page_data: {
        channel_id: request.channel_id,
        channel_name: request.channel_name,
        object_type: request.object_type,
        object_id: request.object_id,
        parent_message_id: request.parent_message_id,
      },
      user_profile: {
        name: request.user_name,
      },
      conversation_id: request.conversation_id ?? null,
    }
  );

  return {
    content: data.reply ?? data.message ?? "",
    sources: [],
    object_references: [],
    collections_searched: [],
    retrieval_time_ms: 0,
    generation_time_ms: 0,
    conversation_id: typeof data.conversation_id === "number" ? data.conversation_id : undefined,
  };
}

export async function submitFeedback(
  feedback: AbbyFeedbackRequest
): Promise<void> {
  await apiClient.post("/commons/abby/feedback", feedback);
}

export async function fetchAbbyHistory(params: {
  cursor?: string;
  limit?: number;
}): Promise<{
  messages: AbbyQueryResponse[];
  next_cursor: string | null;
}> {
  const { data } = await apiClient.get<{
    data: { messages: AbbyQueryResponse[]; next_cursor: string | null };
  }>("/commons/abby/history", { params });
  return data.data;
}

export async function listAbbyConversations(): Promise<AbbyConversationSummary[]> {
  const { data } = await apiClient.get<{
    data: AbbyConversationSummary[];
  }>("/abby/conversations?per_page=20");

  return data.data ?? [];
}

export async function fetchAbbyConversation(
  conversationId: number,
): Promise<{
  id: number;
  title: string | null;
  page_context: string;
  messages: AbbyConversationMessage[];
}> {
  const { data } = await apiClient.get<{
    data: {
      id: number;
      title: string | null;
      page_context: string;
      messages: AbbyConversationMessage[];
    };
  }>(`/abby/conversations/${conversationId}`);

  return data.data;
}

export async function fetchAbbyProfile(): Promise<AbbyProfileResponse> {
  const response = await apiClient.get('/api/v1/abby/profile');
  return response.data;
}

export async function updateAbbyProfile(
  data: AbbyProfileUpdateRequest
): Promise<AbbyProfileResponse> {
  const response = await apiClient.put('/api/v1/abby/profile', data);
  return response.data;
}

export async function resetAbbyProfile(): Promise<void> {
  await apiClient.post('/api/v1/abby/profile/reset');
}

export async function executePlan(planId: string): Promise<ExecutePlanResponse> {
  const response = await apiClient.post('/api/v1/abby/execute-plan', { plan_id: planId });
  return response.data;
}
