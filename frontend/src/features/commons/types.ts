export interface ChannelUser {
  id: number;
  name: string;
}

export interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: "topic" | "study" | "custom";
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

export interface Message {
  id: number;
  channel_id: number;
  user: ChannelUser;
  body: string;
  body_html: string | null;
  parent_id: number | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface PresenceUser {
  id: number;
  name: string;
}

export interface CreateChannelPayload {
  name: string;
  slug: string;
  description?: string;
  type: "topic" | "study" | "custom";
  visibility: "public" | "private";
  study_id?: number;
}
