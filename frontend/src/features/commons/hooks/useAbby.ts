import { useState, useCallback, useEffect, useRef } from "react";
import type {
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbyFeedbackRequest,
  RagPipelineState,
} from "../types/abby";
import { queryAbbyStream, submitFeedback } from "../services/abbyService";

// ─── useAbbyQuery ───────────────────────────────────────────────

interface UseAbbyQueryReturn {
  response: AbbyQueryResponse | null;
  streamingContent: string;
  pipelineState: RagPipelineState;
  isLoading: boolean;
  error: Error | null;
  sendQuery: (
    request: AbbyQueryRequest,
    options?: { onConversationId?: (conversationId: number) => void }
  ) => Promise<void>;
  reset: () => void;
}

export function useAbbyQuery(): UseAbbyQueryReturn {
  const [response, setResponse] = useState<AbbyQueryResponse | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [pipelineState, setPipelineState] = useState<RagPipelineState>({
    stage: "complete",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendQuery = useCallback(async (
    request: AbbyQueryRequest,
    options?: { onConversationId?: (conversationId: number) => void },
  ) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setResponse(null);
    setStreamingContent("");
    setPipelineState({ stage: "analyzing" });

    try {
      setPipelineState({ stage: "retrieving", collections_count: request.history?.length ? 1 : 0 });

      const result = await queryAbbyStream(request, {
        signal: abortRef.current.signal,
        onConversationId: options?.onConversationId,
        onToken: (token) => {
          setPipelineState({ stage: "composing" });
          setStreamingContent((prev) => prev + token);
        },
      });
      if (abortRef.current?.signal.aborted) return;

      setStreamingContent("");
      setResponse(result);
      setPipelineState({ stage: "complete" });
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      const queryError =
        err instanceof Error ? err : new Error(String(err));
      setError(queryError);
      setPipelineState({
        stage: "error",
        error_message: queryError.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResponse(null);
    setStreamingContent("");
    setPipelineState({ stage: "complete" });
    setIsLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { response, streamingContent, pipelineState, isLoading, error, sendQuery, reset };
}

// ─── useAbbyFeedback ────────────────────────────────────────────

interface UseAbbyFeedbackReturn {
  isSubmitting: boolean;
  submit: (request: AbbyFeedbackRequest) => Promise<void>;
}

export function useAbbyFeedback(): UseAbbyFeedbackReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (request: AbbyFeedbackRequest) => {
    setIsSubmitting(true);
    try {
      await submitFeedback(request);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, submit };
}

// ─── useAbbyMention ─────────────────────────────────────────────

export function useAbbyMention() {
  const extractQuery = useCallback((text: string): string | null => {
    const match = text.match(/@abby\s+(.+)/i);
    return match ? match[1].trim() : null;
  }, []);

  const containsMention = useCallback((text: string): boolean => {
    return /@abby\b/i.test(text);
  }, []);

  return { extractQuery, containsMention };
}
