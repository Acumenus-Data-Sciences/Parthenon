import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { listAbbyConversations } from "./services/abbyService";
import type {
  ActivityItem,
  Announcement,
  WikiArticle,
  WikiRevision,
  Attachment,
  Channel,
  ChannelMember,
  CommonsNotification,
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
    mutationFn: ({ id, body }: { id: number; body: string; slug: string }) =>
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

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const NOTIFICATIONS_KEY = "commons-notifications";

async function fetchNotifications(): Promise<CommonsNotification[]> {
  const { data } = await apiClient.get<{ data: CommonsNotification[] }>(
    "/commons/notifications",
  );
  return data.data;
}

async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } = await apiClient.get<{ data: { count: number } }>(
    "/commons/notifications/unread-count",
  );
  return data.data.count;
}

async function markNotificationsRead(ids?: number[]): Promise<void> {
  await apiClient.post("/commons/notifications/mark-read", { ids: ids ?? null });
}

export function useNotifications() {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY],
    queryFn: fetchNotifications,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, "unread-count"],
    queryFn: fetchUnreadNotificationCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    },
  });
}

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------

const ACTIVITIES_KEY = "commons-activities";

async function fetchActivities(slug: string): Promise<ActivityItem[]> {
  const { data } = await apiClient.get<{ data: ActivityItem[] }>(
    `/commons/channels/${slug}/activities`,
  );
  return data.data;
}

export function useActivities(slug: string) {
  return useQuery({
    queryKey: [ACTIVITIES_KEY, slug],
    queryFn: () => fetchActivities(slug),
    enabled: !!slug,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

const ANNOUNCEMENTS_KEY = "commons-announcements";

async function fetchAnnouncements(
  channelSlug?: string,
  category?: string,
): Promise<Announcement[]> {
  const params = new URLSearchParams();
  if (channelSlug) params.set("channel", channelSlug);
  if (category) params.set("category", category);
  const { data } = await apiClient.get<{ data: Announcement[] }>(
    `/commons/announcements?${params.toString()}`,
  );
  return data.data;
}

async function createAnnouncement(payload: {
  title: string;
  body: string;
  category?: string;
  channel_slug?: string;
  is_pinned?: boolean;
  expires_at?: string;
}): Promise<Announcement> {
  const { data } = await apiClient.post<{ data: Announcement }>(
    "/commons/announcements",
    payload,
  );
  return data.data;
}

async function updateAnnouncement(
  id: number,
  payload: { title?: string; body?: string; category?: string; is_pinned?: boolean; expires_at?: string | null },
): Promise<Announcement> {
  const { data } = await apiClient.patch<{ data: Announcement }>(
    `/commons/announcements/${id}`,
    payload,
  );
  return data.data;
}

async function deleteAnnouncement(id: number): Promise<void> {
  await apiClient.delete(`/commons/announcements/${id}`);
}

async function toggleBookmark(id: number): Promise<{ bookmarked: boolean }> {
  const { data } = await apiClient.post<{ data: { bookmarked: boolean } }>(
    `/commons/announcements/${id}/bookmark`,
  );
  return data.data;
}

export function useAnnouncements(channelSlug?: string, category?: string) {
  return useQuery({
    queryKey: [ANNOUNCEMENTS_KEY, channelSlug, category],
    queryFn: () => fetchAnnouncements(channelSlug, category),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; title?: string; body?: string; category?: string; is_pinned?: boolean; expires_at?: string | null }) =>
      updateAnnouncement(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] }),
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleBookmark,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] }),
  });
}

// ---------------------------------------------------------------------------
// Wiki / Knowledge Base
// ---------------------------------------------------------------------------

const WIKI_KEY = "commons-wiki";

async function fetchWikiArticles(query?: string, tag?: string): Promise<WikiArticle[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tag) params.set("tag", tag);
  const { data } = await apiClient.get<{ data: WikiArticle[] }>(
    `/commons/wiki?${params.toString()}`,
  );
  return data.data;
}

async function fetchWikiArticle(slug: string): Promise<WikiArticle> {
  const { data } = await apiClient.get<{ data: WikiArticle }>(`/commons/wiki/${slug}`);
  return data.data;
}

async function createWikiArticle(payload: {
  title: string;
  body: string;
  tags?: string[];
}): Promise<WikiArticle> {
  const { data } = await apiClient.post<{ data: WikiArticle }>("/commons/wiki", payload);
  return data.data;
}

async function updateWikiArticle(
  slug: string,
  payload: { title?: string; body?: string; tags?: string[]; edit_summary?: string },
): Promise<WikiArticle> {
  const { data } = await apiClient.patch<{ data: WikiArticle }>(`/commons/wiki/${slug}`, payload);
  return data.data;
}

async function deleteWikiArticle(slug: string): Promise<void> {
  await apiClient.delete(`/commons/wiki/${slug}`);
}

async function fetchWikiRevisions(slug: string): Promise<WikiRevision[]> {
  const { data } = await apiClient.get<{ data: WikiRevision[] }>(`/commons/wiki/${slug}/revisions`);
  return data.data;
}

export function useWikiArticles(query?: string, tag?: string) {
  return useQuery({
    queryKey: [WIKI_KEY, "list", query, tag],
    queryFn: () => fetchWikiArticles(query, tag),
  });
}

export function useWikiArticle(slug: string) {
  return useQuery({
    queryKey: [WIKI_KEY, slug],
    queryFn: () => fetchWikiArticle(slug),
    enabled: !!slug,
  });
}

export function useCreateWikiArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWikiArticle,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [WIKI_KEY] }),
  });
}

export function useUpdateWikiArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, ...payload }: { slug: string; title?: string; body?: string; tags?: string[]; edit_summary?: string }) =>
      updateWikiArticle(slug, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [WIKI_KEY] }),
  });
}

export function useDeleteWikiArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteWikiArticle,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [WIKI_KEY] }),
  });
}

export function useWikiRevisions(slug: string) {
  return useQuery({
    queryKey: [WIKI_KEY, slug, "revisions"],
    queryFn: () => fetchWikiRevisions(slug),
    enabled: !!slug,
  });
}

// ---------------------------------------------------------------------------
// Abby AI Conversations
// ---------------------------------------------------------------------------

export function useAbbyConversations() {
  return useQuery({
    queryKey: ["abby", "conversations"],
    queryFn: listAbbyConversations,
    staleTime: 60_000,
  });
}
