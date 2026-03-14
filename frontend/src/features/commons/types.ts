export interface ChannelUser {
  id: number;
  name: string;
}

export interface DirectMessage {
  id: number;
  slug: string;
  other_user: ChannelUser | null;
  last_message_at: string | null;
  members_count: number;
}

export interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: "topic" | "study" | "custom" | "dm";
  visibility: "public" | "private";
  study_id: number | null;
  created_by: number;
  archived_at: string | null;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelMember {
  id: number;
  channel_id: number;
  user_id: number;
  role: "owner" | "admin" | "member";
  notification_preference: "all" | "mentions" | "none";
  last_read_at: string | null;
  joined_at: string;
  user: ChannelUser;
}

export interface ReactionUser {
  id: number;
  name: string;
}

export interface ReactionEntry {
  count: number;
  users: ReactionUser[];
  reacted: boolean;
}

export type ReactionSummary = Record<string, ReactionEntry>;

export type ReferenceType = "cohort_definition" | "concept_set" | "study" | "source";

export interface ObjectReference {
  id: number;
  message_id: number;
  referenceable_type: ReferenceType;
  referenceable_id: number;
  display_name: string;
}

export interface ObjectSearchResult {
  type: ReferenceType;
  id: number;
  name: string;
  description: string | null;
  url: string;
  status?: string;
}

export interface Message {
  id: number;
  channel_id: number;
  user: ChannelUser;
  body: string;
  body_html: string | null;
  parent_id: number | null;
  depth: number;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  reply_count?: number;
  latest_reply_at?: string | null;
  reactions?: ReactionSummary;
  object_references?: ObjectReference[];
}

export interface PresenceUser {
  id: number;
  name: string;
}

export interface PinnedMessage {
  id: number;
  message: {
    id: number;
    body: string;
    user: ChannelUser;
    created_at: string;
  };
  pinned_by: ChannelUser;
  pinned_at: string;
}

export interface SearchResult {
  id: number;
  body: string;
  user: ChannelUser;
  channel: { id: number; slug: string; name: string };
  created_at: string;
}

export interface CreateChannelPayload {
  name: string;
  slug: string;
  description?: string;
  type: "topic" | "study" | "custom";
  visibility: "public" | "private";
  study_id?: number;
}
