import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type {
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbyFeedbackRequest,
  AbbyConversationSummary,
  AbbyConversationMessage,
  AbbySource,
} from "../types/abby";
import type { AbbyProfileResponse, AbbyProfileUpdateRequest } from '../../abby-ai/types/memory';
import type { ExecutePlanResponse } from '../../abby-ai/types/agency';

interface AbbyStreamHandlers {
  onToken?: (token: string) => void;
  onSuggestions?: (suggestions: string[]) => void;
  onSources?: (sources: AbbySource[]) => void;
  onConversationId?: (conversationId: number) => void;
  signal?: AbortSignal;
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeSourceMetadata(value: unknown): AbbySource["metadata"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]) => [key, asTrimmedString(entryValue)] as const)
    .filter(([, entryValue]) => entryValue !== undefined);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeAbbySource(source: unknown): AbbySource | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const raw = source as Record<string, unknown>;
  const metadata = normalizeSourceMetadata(raw.metadata);
  const collection = asTrimmedString(raw.collection) ?? "unknown";
  const label = asTrimmedString(raw.label)
    ?? (metadata?.channel_name ? `#${metadata.channel_name}` : undefined);
  const title = asTrimmedString(raw.title) ?? asTrimmedString(raw.document_id);
  const normalized: AbbySource = { collection };

  if (label) normalized.label = label;
  if (title) normalized.title = title;

  const sourceFile = asTrimmedString(raw.source_file);
  if (sourceFile) normalized.source_file = sourceFile;

  const section = asTrimmedString(raw.section);
  if (section) normalized.section = section;

  const url = asTrimmedString(raw.url);
  if (url) normalized.url = url;

  const score = asFiniteNumber(raw.score) ?? asFiniteNumber(raw.relevance_score);
  if (score !== undefined) normalized.score = score;

  const documentId = asTrimmedString(raw.document_id);
  if (documentId) normalized.document_id = documentId;

  const snippet = asTrimmedString(raw.snippet);
  if (snippet) normalized.snippet = snippet;

  const relevanceScore = asFiniteNumber(raw.relevance_score);
  if (relevanceScore !== undefined) normalized.relevance_score = relevanceScore;

  if (metadata) normalized.metadata = metadata;

  return normalized;
}

export function normalizeAbbySources(rawSources: unknown): AbbySource[] {
  if (!Array.isArray(rawSources)) return [];

  const seen = new Set<string>();
  const normalized: AbbySource[] = [];

  for (const rawSource of rawSources) {
    const source = normalizeAbbySource(rawSource);
    if (!source) continue;

    const dedupeKey = [
      source.collection,
      source.title ?? "",
      source.source_file ?? "",
      source.url ?? "",
      source.document_id ?? "",
    ].join("|");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push(source);
  }

  return normalized;
}

function normalizeSuggestions(rawSuggestions: unknown): string[] {
  if (!Array.isArray(rawSuggestions)) return [];
  return rawSuggestions
    .map((value) => asTrimmedString(value))
    .filter((value): value is string => Boolean(value));
}

export function normalizeConversationResponse(
  message: AbbyConversationMessage,
): AbbyQueryResponse | null {
  if (message.role !== "assistant") return null;

  return {
    content: message.content,
    suggestions: normalizeSuggestions(message.metadata?.suggestions),
    sources: normalizeAbbySources(message.metadata?.sources),
    object_references: [],
    collections_searched: [],
    retrieval_time_ms: 0,
    generation_time_ms: 0,
  };
}

export async function queryAbby(
  request: AbbyQueryRequest,
  signal?: AbortSignal,
): Promise<AbbyQueryResponse> {
  const { data } = await apiClient.post<{
    reply?: string;
    message?: string;
    suggestions?: string[];
    sources?: unknown[];
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
    suggestions: normalizeSuggestions(data.suggestions),
    sources: normalizeAbbySources(data.sources),
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

  if (!response.ok || !response.body) {
    return queryAbby(request, handlers.signal);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let suggestions: string[] = [];
  let sources: AbbySource[] = [];
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
          sources?: unknown[];
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
          suggestions = normalizeSuggestions(parsed.suggestions);
          handlers.onSuggestions?.(suggestions);
        }
        if (parsed.sources) {
          sources = normalizeAbbySources(parsed.sources);
          handlers.onSources?.(sources);
        }
      }
    }
  }

  return {
    content,
    suggestions,
    sources,
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
