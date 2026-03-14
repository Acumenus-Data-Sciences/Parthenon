/**
 * AbbyMentionHandler
 *
 * Integrates with the message composer to detect @Abby mentions.
 * When a message containing @Abby is sent, this component:
 *   1. Extracts the query text after the mention
 *   2. Fires the RAG query via useAbbyQuery
 *   3. Shows the AbbyTypingIndicator in-thread
 *   4. Renders the AbbyResponseCard when complete
 *
 * This component does NOT render the composer itself — it wraps
 * the thread/reply area where Abby's response will appear.
 */

import { useCallback, useEffect, useState } from 'react';
import AbbyTypingIndicator from './AbbyTypingIndicator';
import AbbyResponseCard from './AbbyResponseCard';
import { useAbbyQuery, useAbbyMention } from '../hooks/useAbby';
import type {
  AbbyMentionHandlerProps,
  AbbyFeedbackRequest,
} from '../types/abby';
import { submitFeedback } from '../services/abbyService';

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

  /**
   * Called by the parent MessageComposer when a message is submitted.
   * The parent should check containsMention() before calling this.
   */
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

  // Notify parent on completion
  useEffect(() => {
    if (response) {
      onQueryComplete?.(response);
    }
  }, [response, onQueryComplete]);

  // Notify parent on error
  useEffect(() => {
    if (error) {
      onQueryError?.(error);
    }
  }, [error, onQueryError]);

  const handleFeedback = useCallback(async (feedback: AbbyFeedbackRequest) => {
    try {
      await submitFeedback(feedback);
    } catch (err) {
      console.error('Failed to submit Abby feedback:', err);
    }
  }, []);

  // Expose the handler and mention check to parent via ref or context
  // For now, we expose via a custom event pattern
  useEffect(() => {
    const handler = (e: CustomEvent<{ text: string; userName: string }>) => {
      if (containsMention(e.detail.text)) {
        handleMessageWithMention(e.detail.text, e.detail.userName);
      }
    };

    window.addEventListener(
      'commons:message-sent' as any,
      handler as EventListener
    );
    return () => {
      window.removeEventListener(
        'commons:message-sent' as any,
        handler as EventListener
      );
    };
  }, [containsMention, handleMessageWithMention]);

  return (
    <>
      {/* Show typing indicator while RAG pipeline is running */}
      {isLoading && <AbbyTypingIndicator pipelineState={pipelineState} />}

      {/* Show response card when complete */}
      {response && !isLoading && (
        <AbbyResponseCard
          message={{
            id: crypto.randomUUID(),
            channel_id: channelId,
            user_id: 'abby-system-user',
            body: response.content,
            object_references: response.object_references,
            created_at: new Date().toISOString(),
            metadata: {
              is_ai_generated: true,
              model: 'MedGemma1.5:4b',
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

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex gap-2.5 px-4 py-3">
          <div className="ml-10 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-[12px] text-red-600 dark:text-red-400">
              Abby couldn't process your question: {error.message}
            </p>
            <button
              className="
                mt-1.5 text-[11px] text-red-500 dark:text-red-400
                underline cursor-pointer
                hover:text-red-700 dark:hover:text-red-300
              "
              onClick={() => {
                if (pendingText) {
                  sendQuery({
                    query: pendingText,
                    channel_id: channelId,
                    channel_name: channelName,
                    user_name: 'Unknown',
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

/**
 * Utility to dispatch the message-sent event from the MessageComposer.
 * Call this when a message is submitted that might contain @Abby.
 */
export function dispatchAbbyMentionEvent(text: string, userName: string) {
  window.dispatchEvent(
    new CustomEvent('commons:message-sent', {
      detail: { text, userName },
    })
  );
}
