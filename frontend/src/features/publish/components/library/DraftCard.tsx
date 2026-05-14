import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Calendar, FileText } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { PublicationDraft } from "../../types/publish";
import { VisibilityBadge } from "./VisibilityBadge";

interface DraftCardProps {
  draft: PublicationDraft;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onRename: (id: number) => void;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusClass(status: string): string {
  switch (status) {
    case "ready":
      return "bg-accent/15 text-accent";
    case "archived":
      return "bg-surface-elevated text-text-primary/30";
    default:
      return "bg-surface-elevated text-text-primary/70";
  }
}

export function DraftCard({ draft, onArchive, onDelete, onDuplicate, onRename }: DraftCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const sections = draft.document_json?.sections ?? [];
  const tableCount = sections.filter((s) => s.tableIncluded).length;
  const figureCount = sections.filter((s) => s.diagramIncluded).length;

  return (
    <div className="relative rounded-xl border border-border-default bg-surface-raised p-4 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          to={`/publish/library/${draft.id}`}
          aria-label={`Open draft ${draft.title}`}
          className="text-base font-semibold text-text-primary line-clamp-2 hover:text-accent"
        >
          {draft.title}
        </Link>
        <button
          type="button"
          aria-label="More actions"
          className="text-text-ghost hover:text-text-primary"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <ul
            role="menu"
            className="absolute right-2 top-9 z-10 min-w-32 rounded-md border border-border-default bg-surface-elevated py-1 text-sm shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <li
              role="menuitem"
              className="cursor-pointer px-3 py-1.5 hover:bg-surface-raised"
              onClick={() => {
                onRename(draft.id);
                setMenuOpen(false);
              }}
            >
              Rename
            </li>
            <li
              role="menuitem"
              className="cursor-pointer px-3 py-1.5 hover:bg-surface-raised"
              onClick={() => {
                onDuplicate(draft.id);
                setMenuOpen(false);
              }}
            >
              Duplicate
            </li>
            <li
              role="menuitem"
              className="cursor-pointer px-3 py-1.5 hover:bg-surface-raised"
              onClick={() => {
                onArchive(draft.id);
                setMenuOpen(false);
              }}
            >
              Archive
            </li>
            <li
              role="menuitem"
              className="cursor-pointer px-3 py-1.5 text-danger hover:bg-surface-raised"
              onClick={() => {
                onDelete(draft.id);
                setMenuOpen(false);
              }}
            >
              Delete
            </li>
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-text-primary/60">
        <span className="rounded-full bg-surface-elevated px-2 py-0.5">{draft.template}</span>
        <span className={`rounded-full px-2 py-0.5 ${statusClass(draft.status)}`}>{draft.status}</span>
        <VisibilityBadge visibility={draft.visibility} />
        {currentUserId !== null && currentUserId !== draft.user_id && (
          <span className="text-xs text-text-primary/50">by user #{draft.user_id}</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-text-primary/50">
        <span className="flex items-center gap-1">
          <FileText size={12} />
          {sections.length} sections · {tableCount} table{tableCount === 1 ? "" : "s"} · {figureCount} figure
          {figureCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-text-ghost">
        <Calendar size={12} />
        opened {relativeTime(draft.last_opened_at)}
      </div>
    </div>
  );
}
