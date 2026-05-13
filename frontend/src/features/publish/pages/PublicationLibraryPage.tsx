import { useMemo, useState } from "react";
import { FileOutput } from "lucide-react";
import { HelpButton } from "@/features/help";
import {
  useDeleteDraft,
  useDraftList,
  useUpdateDraftById,
  useCreateDraft,
} from "../hooks/useDrafts";
import { DraftCardGrid } from "../components/library/DraftCardGrid";
import { DraftFilters, type DraftSort } from "../components/library/DraftFilters";
import { NewDraftButton } from "../components/library/NewDraftButton";
import { SessionStorageMigrationBanner } from "../components/library/SessionStorageMigrationBanner";
import type { PublicationDraft, PublicationDraftStatus } from "../types/publish";

function sortDrafts(drafts: PublicationDraft[], by: DraftSort): PublicationDraft[] {
  const copy = [...drafts];
  switch (by) {
    case "last_opened":
      return copy.sort((a, b) => (b.last_opened_at ?? "").localeCompare(a.last_opened_at ?? ""));
    case "last_updated":
      return copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "created":
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

export default function PublicationLibraryPage() {
  const { data: drafts, isLoading } = useDraftList();
  const update = useUpdateDraftById();
  const deleteDraft = useDeleteDraft();
  const createDraft = useCreateDraft();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PublicationDraftStatus | "all">("all");
  const [sort, setSort] = useState<DraftSort>("last_opened");

  const filtered = useMemo(() => {
    const list = drafts ?? [];
    return sortDrafts(
      list
        .filter((d) => (status === "all" ? d.status !== "archived" : d.status === status))
        .filter((d) => (search ? d.title.toLowerCase().includes(search.toLowerCase()) : true)),
      sort,
    );
  }, [drafts, status, sort, search]);

  const handleArchive = (id: number) => update.mutate({ id, payload: { status: "archived" } });
  const handleDelete = (id: number) => {
    if (!confirm("Delete this draft permanently?")) return;
    deleteDraft.mutate(id);
  };
  const handleDuplicate = (id: number) => {
    const original = drafts?.find((d) => d.id === id);
    if (!original) return;
    createDraft.mutate({
      title: `${original.title} (copy)`,
      template: original.template,
      study_id: original.study_id,
      document_json: original.document_json,
    });
  };
  const handleRename = (id: number) => {
    const original = drafts?.find((d) => d.id === id);
    const next = prompt("New title", original?.title);
    if (!next) return;
    update.mutate({ id, payload: { title: next } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileOutput size={22} className="text-success" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Pre-Publication Library</h1>
            <p className="text-sm text-text-primary/50">Your saved manuscript drafts.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <HelpButton helpKey="publish" />
          <NewDraftButton />
        </div>
      </div>

      <SessionStorageMigrationBanner />

      <DraftFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
      />

      <DraftCardGrid
        drafts={filtered}
        isLoading={isLoading}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onRename={handleRename}
      />
    </div>
  );
}
