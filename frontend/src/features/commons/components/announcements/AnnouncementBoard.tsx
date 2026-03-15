import { useState } from "react";
import {
  Megaphone,
  Pin,
  Bookmark,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useToggleBookmark,
} from "../../api";
import { avatarColor } from "../../utils/avatarColor";
import type { Announcement } from "../../types";
import { useAuthStore } from "@/stores/authStore";

const CATEGORIES = [
  { value: "general", label: "General", color: "bg-blue-400/10 text-blue-400" },
  { value: "study_recruitment", label: "Study Recruitment", color: "bg-green-400/10 text-green-400" },
  { value: "data_update", label: "Data Update", color: "bg-amber-400/10 text-amber-400" },
  { value: "milestone", label: "Milestone", color: "bg-purple-400/10 text-purple-400" },
  { value: "policy", label: "Policy", color: "bg-red-400/10 text-red-400" },
] as const;

function getCategoryStyle(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.color ?? "bg-muted text-muted-foreground";
}

function getCategoryLabel(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

interface AnnouncementCardProps {
  announcement: Announcement;
  currentUserId: number;
  onDelete: (id: number) => void;
  onBookmark: (id: number) => void;
}

function AnnouncementCard({ announcement, currentUserId, onDelete, onBookmark }: AnnouncementCardProps) {
  const time = new Date(announcement.created_at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {announcement.is_pinned && (
            <Pin className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getCategoryStyle(announcement.category)}`}>
            {getCategoryLabel(announcement.category)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onBookmark(announcement.id)}
            title={announcement.is_bookmarked ? "Remove bookmark" : "Bookmark"}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${announcement.is_bookmarked ? "fill-amber-400 text-amber-400" : ""}`}
            />
          </button>
          {announcement.user_id === currentUserId && (
            <button
              onClick={() => onDelete(announcement.id)}
              title="Delete"
              className="rounded p-1 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-foreground">{announcement.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
        {announcement.body}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {announcement.user && (
          <>
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(announcement.user.id) }}
            >
              {announcement.user.name[0]?.toUpperCase()}
            </div>
            <span className="text-[11px] text-muted-foreground">{announcement.user.name}</span>
          </>
        )}
        <span className="text-[11px] text-muted-foreground/60">{time}</span>
        {announcement.expires_at && (
          <span className="text-[10px] text-amber-400/70">
            Expires {new Date(announcement.expires_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

interface CreateAnnouncementFormProps {
  onClose: () => void;
  channelSlug?: string;
}

function CreateAnnouncementForm({ onClose, channelSlug }: CreateAnnouncementFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [isPinned, setIsPinned] = useState(false);
  const createMutation = useCreateAnnouncement();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    createMutation.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        category,
        channel_slug: channelSlug,
        is_pinned: isPinned,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">New Announcement</h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mb-2 w-full rounded border border-border bg-[#1a1a22] px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Announcement body..."
        rows={4}
        className="mb-2 w-full resize-none rounded border border-border bg-[#1a1a22] px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-border bg-[#1a1a22] px-2 py-1 text-xs text-foreground"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded"
          />
          Pin to top
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || !body.trim() || createMutation.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {createMutation.isPending ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}

interface AnnouncementBoardProps {
  channelSlug?: string;
}

export function AnnouncementBoard({ channelSlug }: AnnouncementBoardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const { data: announcements = [], isLoading } = useAnnouncements(channelSlug, filterCategory || undefined);
  const deleteMutation = useDeleteAnnouncement();
  const bookmarkMutation = useToggleBookmark();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Announcements</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded border border-border bg-[#1a1a22] px-2 py-1 text-[11px] text-foreground"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {showCreate && (
          <CreateAnnouncementForm
            onClose={() => setShowCreate(false)}
            channelSlug={channelSlug}
          />
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {!isLoading && announcements.length === 0 && !showCreate && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No announcements yet</p>
            <p className="text-xs text-muted-foreground/60">
              Post updates, study recruitment notices, and milestones
            </p>
          </div>
        )}

        {announcements.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            currentUserId={currentUserId}
            onDelete={(id) => deleteMutation.mutate(id)}
            onBookmark={(id) => bookmarkMutation.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}
