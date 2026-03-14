import apiClient from "@/lib/api-client";
import type {
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbyFeedbackRequest,
} from "../types/abby";

export async function queryAbby(
  request: AbbyQueryRequest
): Promise<AbbyQueryResponse> {
  const { data } = await apiClient.post<{ data: AbbyQueryResponse }>(
    "/commons/abby/query",
    request
  );
  return data.data;
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
