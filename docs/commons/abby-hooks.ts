/**
 * Abby Custom Hooks
 *
 * React hooks for Abby query handling, feedback submission,
 * and real-time RAG pipeline state tracking via WebSocket.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbyFeedbackRequest,
  AbbyFeedback,
  RagPipelineState,
  RagStage,
} from '../types/abby';
import { queryAbby, submitFeedback } from '../services/abbyService';

// ─── useAbbyQuery ───────────────────────────────────────────────

interface UseAbbyQueryReturn {
  response: AbbyQueryResponse | null;
  pipelineState: RagPipelineState;
  isLoading: boolean;
  error: Error | null;
  sendQuery: (request: AbbyQueryRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Manages the full lifecycle of an Abby query — from sending
 * through RAG pipeline stages to receiving the response.
 */
export function useAbbyQuery(): UseAbbyQueryReturn {
  const [response, setResponse] = useState<AbbyQueryResponse | null>(null);
  const [pipelineState, setPipelineState] = useState<RagPipelineState>({
    stage: 'complete',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendQuery = useCallback(async (request: AbbyQueryRequest) => {
    // Cancel any in-flight query
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setResponse(null);

    // Simulate pipeline stages with timing
    // In production, these would come via WebSocket events from the FastAPI service
    const stages: { stage: RagStage; delay: number; extras?: Partial<RagPipelineState> }[] = [
      { stage: 'analyzing', delay: 0 },
      { stage: 'retrieving', delay: 400, extras: { collections_count: 4 } },
      { stage: 'reading', delay: 1200 },
      { stage: 'composing', delay: 2000 },
    ];

    for (const { stage, delay, extras } of stages) {
      await new Promise((r) => setTimeout(r, delay));
      if (abortRef.current?.signal.aborted) return;
      setPipelineState({ stage, ...extras });
    }

    try {
      const result = await queryAbby(request);
      if (abortRef.current?.signal.aborted) return;

      // Update reading stage with actual source count
      setPipelineState({
        stage: 'reading',
        sources_found: result.sources.length,
        collections_count: result.collections_searched.length,
      });

      // Brief pause before showing complete
      await new Promise((r) => setTimeout(r, 300));

      setResponse(result);
      setPipelineState({ stage: 'complete' });
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setPipelineState({ stage: 'error', error_message: error.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResponse(null);
    setPipelineState({ stage: 'complete' });
    setIsLoading(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { response, pipelineState, isLoading, error, sendQuery, reset };
}

// ─── useAbbyFeedback ────────────────────────────────────────────

interface UseAbbyFeedbackReturn {
  feedback: AbbyFeedback | null;
  isSubmitting: boolean;
  submit: (request: AbbyFeedbackRequest) => Promise<void>;
}

/**
 * Manages feedback submission for an Abby response.
 */
export function useAbbyFeedback(
  existingFeedback?: AbbyFeedback
): UseAbbyFeedbackReturn {
  const [feedback, setFeedback] = useState<AbbyFeedback | null>(
    existingFeedback ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (request: AbbyFeedbackRequest) => {
    setIsSubmitting(true);
    try {
      const result = await submitFeedback(request);
      setFeedback(result);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { feedback, isSubmitting, submit };
}

// ─── useAbbyMention ─────────────────────────────────────────────

/**
 * Detects @Abby mentions in a text string and extracts the query.
 * Returns null if no mention is found.
 */
export function useAbbyMention() {
  const extractQuery = useCallback((text: string): string | null => {
    // Match @Abby (case-insensitive) followed by the query text
    const match = text.match(/@abby\s+(.+)/i);
    return match ? match[1].trim() : null;
  }, []);

  const containsMention = useCallback((text: string): boolean => {
    return /@abby\b/i.test(text);
  }, []);

  return { extractQuery, containsMention };
}
