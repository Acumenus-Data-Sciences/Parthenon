import { FileOutput } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicationDraft } from "../../types/publish";
import { DraftCard } from "./DraftCard";

interface DraftCardGridProps {
  drafts: PublicationDraft[];
  isLoading: boolean;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onRename: (id: number) => void;
}

export function DraftCardGrid({ drafts, isLoading, onArchive, onDelete, onDuplicate, onRename }: DraftCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-border-default bg-surface-raised animate-pulse" />
        ))}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-base py-16 text-center">
        <FileOutput size={32} className="text-text-ghost mb-3" />
        <h2 className="text-lg font-semibold text-text-primary">No drafts yet</h2>
        <p className="mt-1 text-sm text-text-primary/60">Start a new document to begin a manuscript draft.</p>
        <Link
          to="/publish/library/new"
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90"
        >
          Start a New Document
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {drafts.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          onArchive={onArchive}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
