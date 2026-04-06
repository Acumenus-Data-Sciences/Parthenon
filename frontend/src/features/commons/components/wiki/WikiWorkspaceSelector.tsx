import { FolderTree, Plus } from "lucide-react";
import type { WikiWorkspace } from "../../types/wiki";

export function WikiWorkspaceSelector({
  workspaces,
  value,
  onChange,
  draftValue,
  onDraftChange,
  onCreate,
  creating,
}: {
  workspaces: WikiWorkspace[];
  value: string;
  onChange: (workspace: string) => void;
  draftValue: string;
  onDraftChange: (value: string) => void;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#15151a] p-4">
      <div className="flex items-center gap-2">
        <FolderTree className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Workspace</h2>
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-xl border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.name} value={workspace.name}>
            {workspace.name} ({workspace.page_count})
          </option>
        ))}
      </select>

      <div className="mt-3 flex gap-2">
        <input
          value={draftValue}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="new workspace"
          className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#111115] px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={creating || !draftValue.trim()}
          className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating ? "Creating..." : "Create"}
        </button>
      </div>
    </div>
  );
}
