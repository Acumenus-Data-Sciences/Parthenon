import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type {
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbyFeedbackRequest,
  AbbyConversationSummary,
  AbbyConversationMessage,
} from "../types/abby";
import type { AbbyProfileResponse, AbbyProfileUpdateRequest } from '../../abby-ai/types/memory';
import type { ExecutePlanResponse } from '../../abby-ai/types/agency';

interface AbbyStreamHandlers {
  onToken?: (token: string) => void;
  onSuggestions?: (suggestions: string[]) => void;
  onConversationId?: (conversationId: number) => void;
  signal?: AbortSignal;
}

export async function queryAbby(
  request: AbbyQueryRequest,
  signal?: AbortSignal,
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
      title: request.title,
      conversation_id: request.conversation_id ?? null,
      history: request.history ?? [],
    },
    { signal },
  );

  return {
    content: data.reply ?? data.message ?? "",
    suggestions: data.suggestions ?? [],
    sources: [],
    object_references: [],
    collections_searched: [],
    retrieval_time_ms: 0,
    generation_time_ms: 0,
    conversation_id: typeof data.conversation_id === "number" ? data.conversation_id : undefined,
  };
}

export async function queryAbbyStream(
  request: AbbyQueryRequest,
  handlers: AbbyStreamHandlers = {},
): Promise<AbbyQueryResponse> {
  const token = useAuthStore.getState().token;
  const response = await fetch("/api/v1/abby/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({
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
      title: request.title,
      conversation_id: request.conversation_id ?? null,
      history: request.history ?? [],
    }),
    signal: handlers.signal,
  });

  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  ) {
    return queryAbby(request, handlers.signal);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let suggestions: string[] = [];
  let conversationId: number | undefined;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;

        const parsed = JSON.parse(payload) as {
          token?: string;
          suggestions?: string[];
          conversation_id?: number;
          error?: string;
        };

        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (typeof parsed.conversation_id === "number") {
          conversationId = parsed.conversation_id;
          handlers.onConversationId?.(parsed.conversation_id);
        }
        if (parsed.token) {
          content += parsed.token;
          handlers.onToken?.(parsed.token);
        }
        if (parsed.suggestions) {
          suggestions = parsed.suggestions;
          handlers.onSuggestions?.(parsed.suggestions);
        }
      }
    }
  }

  return {
    content,
    suggestions,
    sources: [],
    object_references: [],
    collections_searched: [],
    retrieval_time_ms: 0,
    generation_time_ms: 0,
    conversation_id: conversationId,
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
