import { useCallback, useEffect, useState } from "react";
import AbbyTypingIndicator from "./AbbyTypingIndicator";
import AbbyResponseCard from "./AbbyResponseCard";
import { useAbbyQuery, useAbbyMention } from "../../hooks/useAbby";
import { submitFeedback } from "../../services/abbyService";
import type { AbbyMentionHandlerProps, AbbyFeedbackRequest } from "../../types/abby";

export default function AbbyMentionHandler({
  channelId,
  channelName,
  parentMessageId,
  onQueryStart,
  onQueryComplete,
  onQueryError,
}: AbbyMentionHandlerProps) {
  const { response, pipelineState, isLoading, error, sendQuery } =
    useAbbyQuery();
  const { extractQuery, containsMention } = useAbbyMention();
  const [pendingText, setPendingText] = useState<string | null>(null);

  const handleMessageWithMention = useCallback(
    (messageText: string, userName: string) => {
      const query = extractQuery(messageText);
      if (!query) return;

      setPendingText(query);
      onQueryStart?.();

      sendQuery({
        query,
        channel_id: channelId,
        channel_name: channelName,
        user_name: userName,
        parent_message_id: parentMessageId,
      });
    },
    [channelId, channelName, parentMessageId, extractQuery, sendQuery, onQueryStart]
  );

  useEffect(() => {
    if (response) {
      onQueryComplete?.(response);
    }
  }, [response, onQueryComplete]);

  useEffect(() => {
    if (error) {
      onQueryError?.(error);
    }
  }, [error, onQueryError]);

  const handleFeedback = useCallback(async (feedback: AbbyFeedbackRequest) => {
    try {
      await submitFeedback(feedback);
    } catch (err) {
      console.error("Failed to submit Abby feedback:", err);
    }
  }, []);

  // Listen for message-sent custom events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; userName: string }>).detail;
      if (containsMention(detail.text)) {
        handleMessageWithMention(detail.text, detail.userName);
      }
    };

    window.addEventListener("commons:message-sent", handler);
    return () => {
      window.removeEventListener("commons:message-sent", handler);
    };
  }, [containsMention, handleMessageWithMention]);

  return (
    <>
      {isLoading && <AbbyTypingIndicator pipelineState={pipelineState} />}

      {response && !isLoading && (
        <AbbyResponseCard
          message={{
            id: crypto.randomUUID(),
            channel_id: channelId,
            user_id: "abby-system-user",
            body: response.content,
            object_references: response.object_references,
            created_at: new Date().toISOString(),
            metadata: {
              is_ai_generated: true,
              model: "MedGemma1.5:4b",
              sources: response.sources,
              confidence_score: response.confidence_score,
              collections_searched: response.collections_searched,
              retrieval_time_ms: response.retrieval_time_ms,
              generation_time_ms: response.generation_time_ms,
            },
          }}
          sources={response.sources}
          objectReferences={response.object_references}
          onFeedback={handleFeedback}
        />
      )}

      {error && !isLoading && (
        <div className="flex gap-2.5 px-4 py-3">
          <div className="ml-10 px-3 py-2 bg-red-500/10 rounded-lg">
            <p className="text-[12px] text-red-400">
              Abby couldn't process your question: {error.message}
            </p>
            <button
              className="mt-1.5 text-[11px] text-red-400 underline cursor-pointer hover:text-red-300"
              onClick={() => {
                if (pendingText) {
                  sendQuery({
                    query: pendingText,
                    channel_id: channelId,
                    channel_name: channelName,
                    user_name: "Unknown",
                  });
                }
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function dispatchAbbyMentionEvent(text: string, userName: string) {
  window.dispatchEvent(
    new CustomEvent("commons:message-sent", {
      detail: { text, userName },
    })
  );
}
