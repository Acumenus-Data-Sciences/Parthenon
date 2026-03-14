/**
 * Abby AI Service
 *
 * Client-side service for communicating with the Laravel AbbyController,
 * which proxies to the FastAPI RAG pipeline.
 */

import type {
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbyFeedbackRequest,
  AbbyFeedback,
} from '../types/abby';

const API_BASE = '/api/commons/abby';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    credentials: 'same-origin',
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Abby API error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Send a query to Abby and receive a RAG-augmented response.
 */
export async function queryAbby(
  req: AbbyQueryRequest
): Promise<AbbyQueryResponse> {
  return request<AbbyQueryResponse>(`${API_BASE}/query`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * Submit feedback on an Abby response.
 */
export async function submitFeedback(
  feedback: AbbyFeedbackRequest
): Promise<AbbyFeedback> {
  return request<AbbyFeedback>(`${API_BASE}/feedback`, {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

/**
 * Fetch Abby's conversation history in #ask-abby channel.
 * Cursor-based pagination using created_at + id.
 */
export async function fetchAbbyHistory(params: {
  cursor?: string;
  limit?: number;
}): Promise<{
  messages: AbbyQueryResponse[];
  next_cursor: string | null;
}> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  return request(`${API_BASE}/history?${query.toString()}`);
}
