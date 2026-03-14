import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  Attachment,
  Channel,
  ChannelMember,
  CreateChannelPayload,
  DirectMessage,
  Message,
  ObjectSearchResult,
  PinnedMessage,
  ReactionSummary,
  ReviewRequest,
  SearchResult,
} from "./types";

const CHANNELS_KEY = "commons-channels";
const MESSAGES_KEY = "commons-messages";
const MEMBERS_KEY = "commons-members";
const UNREAD_KEY = "commons-unread";
const PINS_KEY = "commons-pins";
const SEARCH_KEY = "commons-search";
const DM_KEY = "commons-dm";

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function fetchChannels(): Promise<Channel[]> {
  const { data } = await apiClient.get<{ data: Channel[] }>("/commons/channels");
  return data.data;
}

async function createChannel(payload: CreateChannelPayload): Promise<Channel> {
  const { data } = await apiClient.post<{ data: Channel }>(
    "/commons/channels",
    payload,
  );
  return data.data;
}

async function fetchChannel(slug: string): Promise<Channel> {
  const { data } = await apiClient.get<{ data: Channel }>(
    `/commons/channels/${slug}`,
  );
  return data.data;
}

async function fetchMessages(slug: string, before?: number): Promise<Message[]> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  params.set("limit", "50");
  const { data } = await apiClient.get<{ data: Message[] }>(
    `/commons/channels/${slug}/messages?${params.toString()}`,
  );
  return data.data;
}

async function sendMessage(
  slug: string,
  body: string,
  parentId?: number,
  references?: { type: string; id: number; name: string }[],
): Promise<Message> {
  const { data } = await apiClient.post<{ data: Message }>(
    `/commons/channels/${slug}/messages`,
    { body, parent_id: parentId ?? null, references: references ?? [] },
  );
  return data.data;
}

async function updateMessage(id: number, body: string): Promise<Message> {
  const { data } = await apiClient.patch<{ data: Message }>(
    `/commons/messages/${id}`,
    { body },
  );
  return data.data;
}

async function deleteMessage(id: number): Promise<void> {
  await apiClient.delete(`/commons/messages/${id}`);
}

async function fetchReplies(slug: string, messageId: number): Promise<Message[]> {
  const { data } = await apiClient.get<{ data: Message[] }>(
    `/commons/channels/${slug}/messages/${messageId}/replies`,
  );
  return data.data;
}

async function fetchMembers(slug: string): Promise<ChannelMember[]> {
  const { data } = await apiClient.get<{ data: ChannelMember[] }>(
    `/commons/channels/${slug}/members`,
  );
  return data.data;
}

async function joinChannel(slug: string): Promise<ChannelMember> {
  const { data } = await apiClient.post<{ data: ChannelMember }>(
    `/commons/channels/${slug}/members`,
  );
  return data.data;
}

async function markChannelRead(slug: string): Promise<void> {
  await apiClient.post(`/commons/channels/${slug}/read`);
}

async function toggleReaction(
  messageId: number,
  emoji: string,
): Promise<ReactionSummary> {
  const { data } = await apiClient.post<{ data: ReactionSummary }>(
    `/commons/messages/${messageId}/reactions`,
    { emoji },
  );
  return data.data;
}

async function fetchUnreadCounts(): Promise<Record<string, number>> {
  const { data } = await apiClient.get<{ data: Record<string, number> }>(
    "/commons/channels/unread",
  );
  return data.data;
}

async function fetchPins(slug: string): Promise<PinnedMessage[]> {
  const { data } = await apiClient.get<{ data: PinnedMessage[] }>(
    `/commons/channels/${slug}/pins`,
  );
  return data.data;
}

async function pinMessage(slug: string, messageId: number): Promise<PinnedMessage> {
  const { data } = await apiClient.post<{ data: PinnedMessage }>(
    `/commons/channels/${slug}/pins`,
    { message_id: messageId },
  );
  return data.data;
}

async function unpinMessage(slug: string, pinId: number): Promise<void> {
  await apiClient.delete(`/commons/channels/${slug}/pins/${pinId}`);
}

async function updateChannel(
  slug: string,
  payload: { name?: string; description?: string },
): Promise<Channel> {
  const { data } = await apiClient.patch<{ data: Channel }>(
    `/commons/channels/${slug}`,
    payload,
  );
  return data.data;
}

async function updateNotificationPreference(
  slug: string,
  memberId: number,
  preference: "all" | "mentions" | "none",
): Promise<ChannelMember> {
  const { data } = await apiClient.patch<{ data: ChannelMember }>(
    `/commons/channels/${slug}/members/${memberId}`,
    { notification_preference: preference },
  );
  return data.data;
}

async function searchMessages(
  query: string,
  channel?: string,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (channel) params.set("channel", channel);
  const { data } = await apiClient.get<{ data: SearchResult[] }>(
    `/commons/messages/search?${params.toString()}`,
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useChannels() {
  return useQuery({
    queryKey: [CHANNELS_KEY],
    queryFn: fetchChannels,
  });
}

export function useChannel(slug: string) {
  return useQuery({
    queryKey: [CHANNELS_KEY, slug],
    queryFn: () => fetchChannel(slug),
    enabled: !!slug,
  });
}

export function useMessages(slug: string) {
  return useQuery({
    queryKey: [MESSAGES_KEY, slug],
    queryFn: () => fetchMessages(slug),
    enabled: !!slug,
  });
}

export function useReplies(slug: string, messageId: number | null) {
  return useQuery({
    queryKey: [MESSAGES_KEY, slug, "replies", messageId],
    queryFn: () => fetchReplies(slug, messageId!),
    enabled: !!slug && messageId !== null,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      body,
      parentId,
      references,
    }: {
      slug: string;
      body: string;
      parentId?: number;
      references?: { type: string; id: number; name: string }[];
    }) => sendMessage(slug, body, parentId, references),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [MESSAGES_KEY, variables.slug] });
    },
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createChannel,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [CHANNELS_KEY] }),
  });
}

export function useJoinChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: joinChannel,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [CHANNELS_KEY] }),
  });
}

export function useUpdateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, slug }: { id: number; body: string; slug: string }) =>
      updateMessage(id, body),
    onSuccess: (_updated, variables) => {
      void qc.invalidateQueries({
        queryKey: [MESSAGES_KEY, variables.slug],
      });
    },
  });
}

export function useDeleteMessage() {
  return useMutation({
    mutationFn: (id: number) => deleteMessage(id),
  });
}

export function useMembers(slug: string) {
  return useQuery({
    queryKey: [MEMBERS_KEY, slug],
    queryFn: () => fetchMembers(slug),
    enabled: !!slug,
  });
}

export function useMarkRead() {
  return useMutation({ mutationFn: markChannelRead });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string }) =>
      toggleReaction(messageId, emoji),
    onSuccess: () => {
      // Invalidate all message caches to refresh reaction summaries
      void qc.invalidateQueries({ queryKey: [MESSAGES_KEY] });
    },
  });
}

export function useUnreadCounts() {
  return useQuery({
    queryKey: [UNREAD_KEY],
    queryFn: fetchUnreadCounts,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
}

export function usePins(slug: string) {
  return useQuery({
    queryKey: [PINS_KEY, slug],
    queryFn: () => fetchPins(slug),
    enabled: !!slug,
  });
}

export function usePinMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, messageId }: { slug: string; messageId: number }) =>
      pinMessage(slug, messageId),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [PINS_KEY, variables.slug] });
    },
  });
}

export function useUnpinMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, pinId }: { slug: string; pinId: number }) =>
      unpinMessage(slug, pinId),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [PINS_KEY, variables.slug] });
    },
  });
}

export function useSearchMessages(query: string, channel?: string) {
  return useQuery({
    queryKey: [SEARCH_KEY, query, channel],
    queryFn: () => searchMessages(query, channel),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      payload,
    }: {
      slug: string;
      payload: { name?: string; description?: string };
    }) => updateChannel(slug, payload),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [CHANNELS_KEY] });
      void qc.invalidateQueries({ queryKey: [CHANNELS_KEY, variables.slug] });
    },
  });
}

export function useUpdateNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      memberId,
      preference,
    }: {
      slug: string;
      memberId: number;
      preference: "all" | "mentions" | "none";
    }) => updateNotificationPreference(slug, memberId, preference),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [MEMBERS_KEY, variables.slug] });
    },
  });
}

// ---------------------------------------------------------------------------
// Direct Messages
// ---------------------------------------------------------------------------

async function fetchDirectMessages(): Promise<DirectMessage[]> {
  const { data } = await apiClient.get<{ data: DirectMessage[] }>("/commons/dm");
  return data.data;
}

async function createDirectMessage(userId: number): Promise<Channel> {
  const { data } = await apiClient.post<{ data: Channel }>("/commons/dm", {
    user_id: userId,
  });
  return data.data;
}

export function useDirectMessages() {
  return useQuery({
    queryKey: [DM_KEY],
    queryFn: fetchDirectMessages,
  });
}

export function useCreateDirectMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDirectMessage,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [DM_KEY] });
    },
  });
}

// ---------------------------------------------------------------------------
// Object References
// ---------------------------------------------------------------------------

async function searchObjects(
  query: string,
  type?: string,
): Promise<ObjectSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (type) params.set("type", type);
  const { data } = await apiClient.get<{ data: ObjectSearchResult[] }>(
    `/commons/objects/search?${params.toString()}`,
  );
  return data.data;
}

export function useSearchObjects(query: string, type?: string) {
  return useQuery({
    queryKey: ["commons-objects", query, type],
    queryFn: () => searchObjects(query, type),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// File Attachments
// ---------------------------------------------------------------------------

async function uploadAttachment(
  slug: string,
  messageId: number,
  file: File,
): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("message_id", String(messageId));
  const { data } = await apiClient.post<{ data: Attachment }>(
    `/commons/channels/${slug}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.data;
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      messageId,
      file,
    }: {
      slug: string;
      messageId: number;
      file: File;
    }) => uploadAttachment(slug, messageId, file),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [MESSAGES_KEY, variables.slug] });
    },
  });
}

// ---------------------------------------------------------------------------
// Review Requests
// ---------------------------------------------------------------------------

const REVIEWS_KEY = "commons-reviews";

async function fetchReviews(slug: string): Promise<ReviewRequest[]> {
  const { data } = await apiClient.get<{ data: ReviewRequest[] }>(
    `/commons/channels/${slug}/reviews`,
  );
  return data.data;
}

async function createReviewRequest(
  slug: string,
  messageId: number,
  reviewerId?: number,
): Promise<ReviewRequest> {
  const { data } = await apiClient.post<{ data: ReviewRequest }>(
    `/commons/channels/${slug}/reviews`,
    { message_id: messageId, reviewer_id: reviewerId ?? null },
  );
  return data.data;
}

async function resolveReview(
  id: number,
  status: "approved" | "changes_requested",
  comment?: string,
): Promise<ReviewRequest> {
  const { data } = await apiClient.patch<{ data: ReviewRequest }>(
    `/commons/reviews/${id}/resolve`,
    { status, comment: comment ?? null },
  );
  return data.data;
}

export function useReviews(slug: string) {
  return useQuery({
    queryKey: [REVIEWS_KEY, slug],
    queryFn: () => fetchReviews(slug),
    enabled: !!slug,
  });
}

export function useCreateReviewRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      messageId,
      reviewerId,
    }: {
      slug: string;
      messageId: number;
      reviewerId?: number;
    }) => createReviewRequest(slug, messageId, reviewerId),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [REVIEWS_KEY, variables.slug] });
    },
  });
}

export function useResolveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      comment,
    }: {
      id: number;
      slug: string;
      status: "approved" | "changes_requested";
      comment?: string;
    }) => resolveReview(id, status, comment),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [REVIEWS_KEY, variables.slug] });
    },
  });
}
