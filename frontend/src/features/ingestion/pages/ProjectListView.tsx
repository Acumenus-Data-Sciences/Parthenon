import { useState, useCallback } from "react";
import { Plus, Trash2, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useIngestionProjects,
  useCreateIngestionProject,
  useDeleteIngestionProject,
} from "../hooks/useIngestionProjects";
import type { IngestionProject } from "../api/ingestionApi";

interface ProjectListViewProps {
  onSelectProject: (id: number) => void;
}

const STATUS_STYLES: Record<IngestionProject["status"], { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-[#2A2A30] text-[#8A857D]" },
  profiling: { label: "Profiling", classes: "bg-blue-900/30 text-blue-400 animate-pulse" },
  ready: { label: "Ready", classes: "bg-teal-900/30 text-[#2DD4BF]" },
  mapping: { label: "Mapping", classes: "bg-amber-900/30 text-[#C9A227]" },
  completed: { label: "Completed", classes: "bg-green-900/30 text-green-400" },
  failed: { label: "Failed", classes: "bg-red-900/30 text-red-400" },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectListView({ onSelectProject }: ProjectListViewProps) {
  const { data, isLoading } = useIngestionProjects();
  const createMutation = useCreateIngestionProject();
  const deleteMutation = useDeleteIngestionProject();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const projects = data?.data ?? [];

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(
      { name: trimmed },
      {
        onSuccess: (project) => {
          setNewName("");
          setShowForm(false);
          onSelectProject(project.id);
        },
      },
    );
  }, [newName, createMutation, onSelectProject]);

  const handleDelete = useCallback(
    (id: number) => {
      deleteMutation.mutate(id, {
        onSuccess: () => setConfirmDeleteId(null),
      });
    },
    [deleteMutation],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#F0EDE8]">Ingestion Projects</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-[#9B1B30] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B22040]"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#151518] p-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name..."
            className="flex-1 rounded-md border border-[#323238] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#C9A227] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setShowForm(false);
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createMutation.isPending}
            className="rounded-md bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26BCA8] disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Create"
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-md px-3 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-[#232328] bg-[#151518] py-16 text-center">
          <FolderOpen size={40} className="mb-3 text-[#5A5650]" />
          <p className="text-sm text-[#8A857D]">
            No ingestion projects yet. Create one to start uploading source data.
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && projects.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#232328]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#232328] bg-[#151518]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8A857D]">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8A857D]">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#8A857D]">
                  Files
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#8A857D]">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8A857D]">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#8A857D]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const status = STATUS_STYLES[project.status];
                return (
                  <tr
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="cursor-pointer border-b border-[#232328] bg-[#0E0E11] transition-colors hover:bg-[#1A1A1E]"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-[#F0EDE8]">
                      {project.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          status.classes,
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#8A857D]">
                      {project.file_count}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#8A857D]">
                      {formatBytes(project.total_size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#8A857D]">
                      {formatDate(project.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(project.id);
                          }}
                          className="rounded-md px-2 py-1 text-xs text-[#2DD4BF] hover:bg-[#1C1C20] transition-colors"
                        >
                          Open
                        </button>
                        {confirmDeleteId === project.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleDelete(project.id)}
                              disabled={deleteMutation.isPending}
                              className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
                            >
                              {deleteMutation.isPending ? "..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md px-2 py-1 text-xs text-[#8A857D] hover:bg-[#1C1C20] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(project.id);
                            }}
                            className="rounded-md p-1 text-[#8A857D] hover:text-red-400 hover:bg-[#1C1C20] transition-colors"
                            aria-label="Delete project"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
