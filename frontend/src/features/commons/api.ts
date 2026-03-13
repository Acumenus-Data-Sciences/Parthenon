import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  Channel,
  ChannelMember,
  CreateChannelPayload,
  Message,
} from "./types";

const CHANNELS_KEY = "commons-channels";
const MESSAGES_KEY = "commons-messages";
const MEMBERS_KEY = "commons-members";

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

async function sendMessage(slug: string, body: string): Promise<Message> {
  const { data } = await apiClient.post<{ data: Message }>(
    `/commons/channels/${slug}/messages`,
    { body },
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

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, body }: { slug: string; body: string }) =>
      sendMessage(slug, body),
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
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      updateMessage(id, body),
    onSuccess: (updated) => {
      void qc.invalidateQueries({
        queryKey: [MESSAGES_KEY, String(updated.channel_id)],
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
