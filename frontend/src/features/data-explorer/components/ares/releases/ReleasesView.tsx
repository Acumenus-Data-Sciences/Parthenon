import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Pencil, Package, ChevronDown, ChevronRight, Server } from "lucide-react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useReleases, useCreateRelease, useUpdateRelease, useDeleteRelease, useReleaseDiff } from "../../../hooks/useReleaseData";
import { useReleasesTimeline, useReleasesCalendar } from "../../../hooks/useNetworkData";
import { ReleaseEditForm } from "./ReleaseEditForm";
import ReleaseDiffPanel from "./ReleaseDiffPanel";
import SwimLaneTimeline from "./SwimLaneTimeline";
import ReleaseCalendar from "./ReleaseCalendar";
import type { EtlMetadata, StoreReleasePayload, UpdateReleasePayload } from "../../../types/ares";

type ReleasesTab = "list" | "swimlane" | "calendar";

function ReleaseCard({
  release,
  sourceId,
  editingId,
  setEditingId,
  handleUpdate,
  handleDelete,
  updateMutation,
  deleteMutation,
}: {
  release: { id: number; source_id: number; release_key: string; release_name: string; release_type: string; cdm_version: string | null; vocabulary_version: string | null; etl_version: string | null; person_count: number; record_count: number; notes: string | null; etl_metadata?: EtlMetadata | null; created_at: string; updated_at: string };
  sourceId: number;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  handleUpdate: (releaseId: number, payload: UpdateReleasePayload) => void;
  handleDelete: (releaseId: number) => void;
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
}) {
  const [showDiff, setShowDiff] = useState(false);
  const [showEtl, setShowEtl] = useState(false);
  const { data: diff, isLoading: diffLoading } = useReleaseDiff(
    showDiff ? sourceId : null,
    showDiff ? release.id : null,
  );

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{release.release_name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                release.release_type === "snapshot"
                  ? "bg-success/10 text-success"
                  : "bg-accent/10 text-accent"
              }`}
            >
              {release.release_type === "scheduled_etl" ? "ETL" : "Snapshot"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            {release.cdm_version && <span>CDM {release.cdm_version}</span>}
            {release.vocabulary_version && <span>Vocab {release.vocabulary_version}</span>}
            <span>{release.person_count.toLocaleString()} persons</span>
            <span>{release.record_count.toLocaleString()} records</span>
            <span>{new Date(release.created_at).toLocaleDateString()}</span>
          </div>
          {release.notes && (
            <p className="text-xs text-text-muted mt-1">{release.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowDiff(!showDiff)}
            className="text-text-muted hover:text-success transition-colors p-1"
            title="Show diff"
          >
            {showDiff ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setEditingId(editingId === release.id ? null : release.id)}
            className="text-text-muted hover:text-accent transition-colors p-1"
            title="Edit release"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(release.id)}
            disabled={deleteMutation.isPending}
            className="text-text-muted hover:text-primary transition-colors p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showDiff && <ReleaseDiffPanel diff={diff ?? null} isLoading={diffLoading} />}

      {/* ETL Provenance section — only visible when etl_metadata is populated */}
      {release.etl_metadata && Object.keys(release.etl_metadata).length > 0 && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => setShowEtl(!showEtl)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
          >
            <Server size={12} />
            ETL Provenance
            {showEtl ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {showEtl && (
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-surface-base p-3 text-xs">
              {release.etl_metadata.who && (
                <div>
                  <span className="text-text-ghost">Ran by: </span>
                  <span className="text-text-primary">{release.etl_metadata.who}</span>
                </div>
              )}
              {release.etl_metadata.code_version && (
                <div>
                  <span className="text-text-ghost">Code version: </span>
                  <span className="font-mono text-success">{release.etl_metadata.code_version}</span>
                </div>
              )}
              {release.etl_metadata.duration_seconds != null && (
                <div>
                  <span className="text-text-ghost">Duration: </span>
                  <span className="text-text-primary">
                    {release.etl_metadata.duration_seconds >= 3600
                      ? `${Math.floor(release.etl_metadata.duration_seconds / 3600)}h ${Math.floor((release.etl_metadata.duration_seconds % 3600) / 60)}m`
                      : release.etl_metadata.duration_seconds >= 60
                        ? `${Math.floor(release.etl_metadata.duration_seconds / 60)}m ${release.etl_metadata.duration_seconds % 60}s`
                        : `${release.etl_metadata.duration_seconds}s`}
                  </span>
                </div>
              )}
              {release.etl_metadata.started_at && (
                <div>
                  <span className="text-text-ghost">Started: </span>
                  <span className="text-text-primary">{new Date(release.etl_metadata.started_at).toLocaleString()}</span>
                </div>
              )}
              {release.etl_metadata.parameters && Object.keys(release.etl_metadata.parameters).length > 0 && (
                <div className="col-span-2 mt-1">
                  <span className="text-text-ghost">Parameters:</span>
                  <pre className="mt-1 overflow-x-auto rounded bg-surface-raised p-2 text-[10px] text-text-muted">
                    {JSON.stringify(release.etl_metadata.parameters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editingId === release.id && (
        <ReleaseEditForm
          release={release}
          onSave={(payload) => handleUpdate(release.id, payload)}
          onCancel={() => setEditingId(null)}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

export function ReleasesView() {
  const [activeTab, setActiveTab] = useState<ReleasesTab>("list");
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<StoreReleasePayload>({
    release_name: "",
    release_type: "scheduled_etl",
  });

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const { data: releases, isLoading } = useReleases(selectedSourceId);
  const createMutation = useCreateRelease(selectedSourceId ?? 0);
  const updateMutation = useUpdateRelease(selectedSourceId ?? 0);
  const deleteMutation = useDeleteRelease(selectedSourceId ?? 0);
  const { data: timelineData } = useReleasesTimeline();
  const { data: calendarData } = useReleasesCalendar();

  const handleUpdate = (releaseId: number, payload: UpdateReleasePayload) => {
    updateMutation.mutate(
      { releaseId, payload },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const handleCreate = () => {
    if (!selectedSourceId || !formData.release_name.trim()) return;
    createMutation.mutate(formData, {
      onSuccess: () => {
        setFormData({ release_name: "", release_type: "scheduled_etl" });
        setShowForm(false);
      },
    });
  };

  const handleDelete = (releaseId: number) => {
    if (!confirm("Delete this release?")) return;
    deleteMutation.mutate(releaseId);
  };

  const tabs: Array<{ key: ReleasesTab; label: string }> = [
    { key: "list", label: "Releases" },
    { key: "swimlane", label: "Swimlane" },
    { key: "calendar", label: "Calendar" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface-base p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-surface-accent text-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "swimlane" && (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-white">Release Timeline (All Sources)</h3>
          {timelineData ? (
            <SwimLaneTimeline data={timelineData} />
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          )}
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-white">Release Calendar</h3>
          {calendarData ? (
            <ReleaseCalendar events={calendarData} />
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          )}
        </div>
      )}

      {activeTab === "list" && (
        <>
          {/* Source selector + Create button */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSourceId ?? ""}
              onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="">Select a source</option>
              {sources?.map((s) => (
                <option key={s.id} value={s.id}>{s.source_name}</option>
              ))}
            </select>

            {selectedSourceId && (
              <button
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2 text-sm text-accent hover:border-accent transition-colors"
              >
                <Plus size={14} />
                Create Release
              </button>
            )}
          </div>

          {/* Create form */}
          {showForm && selectedSourceId && (
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Release name"
                  value={formData.release_name}
                  onChange={(e) => setFormData({ ...formData, release_name: e.target.value })}
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
                />
                <select
                  value={formData.release_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      release_type: e.target.value as "scheduled_etl" | "snapshot",
                    })
                  }
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="scheduled_etl">Scheduled ETL</option>
                  <option value="snapshot">Snapshot</option>
                </select>
                <input
                  type="text"
                  placeholder="CDM version (optional)"
                  value={formData.cdm_version ?? ""}
                  onChange={(e) => setFormData({ ...formData, cdm_version: e.target.value || undefined })}
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Vocabulary version (optional)"
                  value={formData.vocabulary_version ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, vocabulary_version: e.target.value || undefined })
                  }
                  className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !formData.release_name.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-[#e0b82e] disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Release list */}
          {!selectedSourceId && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-16">
              <Package size={32} className="text-text-muted mb-3" />
              <p className="text-sm text-text-muted">Select a source to view its releases</p>
            </div>
          )}

          {selectedSourceId && isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          )}

          {selectedSourceId && !isLoading && (!releases || releases.length === 0) && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-16">
              <Package size={32} className="text-text-muted mb-3" />
              <p className="text-sm text-text-muted">No releases yet for this source</p>
            </div>
          )}

          {releases && releases.length > 0 && (
            <div className="space-y-3">
              {releases.map((release) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  sourceId={selectedSourceId!}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  handleUpdate={handleUpdate}
                  handleDelete={handleDelete}
                  updateMutation={updateMutation}
                  deleteMutation={deleteMutation}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
