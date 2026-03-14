/**
 * Abby AI Research Companion — Component Exports
 *
 * Usage in Parthenon:
 *   import { AbbyResponseCard, AskAbbyChannel } from '@/modules/commons/components/abby';
 */

// Components
export { default as AbbyAvatar } from './components/AbbyAvatar';
export { default as AbbyResponseCard } from './components/AbbyResponseCard';
export { default as AbbySourceAttribution } from './components/AbbySourceAttribution';
export { default as AbbyTypingIndicator } from './components/AbbyTypingIndicator';
export { default as AbbyFeedback } from './components/AbbyFeedback';
export { default as AbbyMentionHandler, dispatchAbbyMentionEvent } from './components/AbbyMentionHandler';
export { default as AskAbbyChannel } from './components/AskAbbyChannel';

// Hooks
export { useAbbyQuery, useAbbyFeedback, useAbbyMention } from './hooks/useAbby';

// Services
export { queryAbby, submitFeedback, fetchAbbyHistory } from './services/abbyService';

// Types
export type {
  AbbyUser,
  ObjectReference,
  ObjectReferenceType,
  AbbyQueryRequest,
  AbbyQueryResponse,
  AbbySource,
  AbbySourceMetadata,
  AbbyMessage,
  AbbyMessageMetadata,
  FeedbackRating,
  FeedbackCategory,
  AbbyFeedback as AbbyFeedbackType,
  AbbyFeedbackRequest,
  RagStage,
  RagPipelineState,
  IngestionStatus,
  IngestionLogEntry,
  AbbyResponseCardProps,
  AbbySourceAttributionProps,
  AbbyTypingIndicatorProps,
  AbbyFeedbackProps,
  AbbyMentionHandlerProps,
  AskAbbyChannelProps,
  AbbyAvatarProps,
} from './types/abby';
