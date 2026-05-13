import { Search } from "lucide-react";
import type { PublicationDraftStatus } from "../../types/publish";

export type DraftSort = "last_opened" | "last_updated" | "title" | "created";

interface DraftFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: PublicationDraftStatus | "all";
  onStatusChange: (v: PublicationDraftStatus | "all") => void;
  sort: DraftSort;
  onSortChange: (v: DraftSort) => void;
}

export function DraftFilters({ search, onSearchChange, status, onStatusChange, sort, onSortChange }: DraftFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-ghost" />
        <input
          type="search"
          placeholder="Search drafts…"
          aria-label="Search drafts"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-60 rounded-md border border-border-default bg-surface-raised pl-7 pr-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
        />
      </div>
      <select
        aria-label="Status filter"
        value={status}
        onChange={(e) => onStatusChange(e.target.value as PublicationDraftStatus | "all")}
        className="rounded-md border border-border-default bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
      >
        <option value="all">All (except archived)</option>
        <option value="draft">Drafts</option>
        <option value="ready">Ready</option>
        <option value="archived">Archived</option>
      </select>
      <select
        aria-label="Sort by"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as DraftSort)}
        className="rounded-md border border-border-default bg-surface-raised px-2 py-1.5 text-sm text-text-primary"
      >
        <option value="last_opened">Recently opened</option>
        <option value="last_updated">Recently edited</option>
        <option value="title">Title (A–Z)</option>
        <option value="created">Date created</option>
      </select>
    </div>
  );
}
