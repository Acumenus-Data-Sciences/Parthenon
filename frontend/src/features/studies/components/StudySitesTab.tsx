import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, MapPin, Trash2, Edit3, Save, X, Search } from "lucide-react";
import { formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";
import {
  useStudySites,
  useCreateStudySite,
  useUpdateStudySite,
  useDeleteStudySite,
} from "../hooks/useStudies";
import { useSources } from "@/features/data-sources/hooks/useSources";
import type { StudySite } from "../types/study";

const SITE_ROLES = ["data_partner", "coordinating_center", "analytics_node", "observer"] as const;

const SITE_STATUS_COLORS: Record<string, string> = {
  pending: "var(--text-muted)",
  invited: "var(--info)",
  approved: "var(--success)",
  active: "var(--success)",
  completed: "var(--domain-observation)",
  withdrawn: "var(--critical)",
};

interface StudySitesTabProps {
  slug: string;
}

export function StudySitesTab({ slug }: StudySitesTabProps) {
  const { t } = useTranslation("app");
  const { data: sites, isLoading } = useStudySites(slug);
  const { data: allSources } = useSources();
  const createMutation = useCreateStudySite();
  const updateMutation = useUpdateStudySite();
  const deleteMutation = useDeleteStudySite();

  const [editId, setEditId] = useState<number | null>(null);
  const [editPayload, setEditPayload] = useState<Partial<StudySite>>({});

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [newSourceId, setNewSourceId] = useState<number | "">("");
  const [newRole, setNewRole] = useState<string>("data_partner");
  const [newIrb, setNewIrb] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");

  // Filter out sources already assigned
  const assignedSourceIds = new Set(sites?.map((s) => s.source_id) ?? []);
  const availableSources = (allSources ?? []).filter(
    (s: { id: number; source_name: string }) => !assignedSourceIds.has(s.id),
  );
  const filteredSources = sourceSearch
    ? availableSources.filter((s: { source_name: string }) =>
        s.source_name.toLowerCase().includes(sourceSearch.toLowerCase()),
      )
    : availableSources;

  const handleCreate = () => {
    if (!newSourceId) return;
    createMutation.mutate(
      {
        slug,
        payload: {
          source_id: newSourceId as number,
          site_role: newRole,
          status: "pending",
          irb_protocol_number: newIrb || null,
          notes: newNotes || null,
        },
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setNewSourceId("");
          setNewRole("data_partner");
          setNewIrb("");
          setNewNotes("");
          setSourceSearch("");
        },
      },
    );
  };

  const startEdit = (site: StudySite) => {
    setEditId(site.id);
    setEditPayload({
      site_role: site.site_role,
      status: site.status,
      notes: site.notes,
      irb_protocol_number: site.irb_protocol_number,
    });
  };

  const handleSave = () => {
    if (editId == null) return;
    updateMutation.mutate(
      { slug, siteId: editId, payload: editPayload },
      { onSuccess: () => setEditId(null) },
    );
  };

  const roleLabel = (role: string) =>
    t(`studies.sites.roles.${role}`, { defaultValue: role.replace(/_/g, " ") });
  const statusLabel = (status: string) =>
    t(`studies.sites.statuses.${status}`, { defaultValue: status });

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-muted" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary">
          {t("studies.sites.sections.sites", { count: sites?.length ?? 0 })}
        </h3>
        <button type="button" onClick={() => setShowAdd(true)} disabled={showAdd} className="btn btn-primary btn-sm">
          <Plus size={14} /> {t("studies.sites.actions.addSite")}
        </button>
      </div>

      {/* Add site form */}
      {showAdd && (
        <div className="panel space-y-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {t("studies.sites.form.addTitle")}
          </p>

          {/* Source search + select */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder={t("studies.sites.form.sourceSearchPlaceholder")}
                className="form-input pl-9 w-full"
                autoFocus
              />
            </div>
            {filteredSources.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border-default bg-surface-base">
                {filteredSources.map((source: { id: number; source_name: string; source_key?: string }) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => { setNewSourceId(source.id); setSourceSearch(source.source_name); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-surface-overlay transition-colors",
                      newSourceId === source.id ? "bg-success/10 text-success" : "text-text-primary",
                    )}
                  >
                    <span className="font-medium">{source.source_name}</span>
                    {source.source_key && (
                      <span className="ml-2 text-xs text-text-ghost">{source.source_key}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-ghost py-2">
                {availableSources.length === 0
                  ? t("studies.sites.messages.allSourcesAssigned")
                  : t("studies.sites.messages.noMatchingSources")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.sites.form.siteRole")}
              </label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="form-input form-select w-full">
                {SITE_ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.sites.form.irbProtocol")}
              </label>
              <input
                type="text"
                value={newIrb}
                onChange={(e) => setNewIrb(e.target.value)}
                placeholder={t("studies.sites.form.optional")}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.sites.form.notes")}
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder={t("studies.sites.form.optional")}
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowAdd(false); setSourceSearch(""); setNewSourceId(""); }} className="btn btn-ghost btn-sm">
              {t("studies.sites.actions.cancel")}
            </button>
            <button type="button" onClick={handleCreate} disabled={!newSourceId || createMutation.isPending} className="btn btn-primary btn-sm">
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t("studies.sites.actions.addSite")}
            </button>
          </div>
        </div>
      )}

      {(!sites || sites.length === 0) ? (
        <div className="empty-state">
          <MapPin size={24} className="text-text-ghost mb-2" />
          <h3 className="empty-title">{t("studies.sites.empty.title")}</h3>
          <p className="empty-message">{t("studies.sites.empty.message")}</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("studies.sites.table.source")}</th>
                <th>{t("studies.sites.table.role")}</th>
                <th>{t("studies.sites.table.status")}</th>
                <th>{t("studies.sites.table.irb")}</th>
                <th>{t("studies.sites.table.patients")}</th>
                <th>{t("studies.sites.table.cdm")}</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const isEditing = editId === site.id;
                const color = SITE_STATUS_COLORS[site.status] ?? "var(--text-muted)";
                return (
                  <tr key={site.id}>
                    <td className="text-text-primary font-medium">
                      {site.source?.source_name ?? t("studies.sites.messages.sourceFallback", { id: site.source_id })}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editPayload.site_role ?? ""}
                          onChange={(e) => setEditPayload({ ...editPayload, site_role: e.target.value })}
                          className="form-input form-select py-1 text-xs"
                        >
                          {SITE_ROLES.map((r) => (
                            <option key={r} value={r}>{roleLabel(r)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-text-muted">{roleLabel(site.site_role)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editPayload.status ?? ""}
                          onChange={(e) => setEditPayload({ ...editPayload, status: e.target.value })}
                          className="form-input form-select py-1 text-xs"
                        >
                          {Object.keys(SITE_STATUS_COLORS).map((s) => (
                            <option key={s} value={s}>{statusLabel(s)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {statusLabel(site.status)}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-text-muted">{site.irb_protocol_number ?? "—"}</td>
                    <td className="text-xs text-text-muted font-['IBM_Plex_Mono',monospace]">
                      {site.patient_count_estimate != null ? formatNumber(site.patient_count_estimate) : "—"}
                    </td>
                    <td className="text-xs text-text-muted">{site.cdm_version ?? "—"}</td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={handleSave} className="p-1 text-success hover:text-success" title={t("studies.sites.actions.save")}>
                              <Save size={14} />
                            </button>
                            <button type="button" onClick={() => setEditId(null)} className="p-1 text-text-ghost hover:text-text-secondary" title={t("studies.sites.actions.cancel")}>
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEdit(site)} className="p-1 text-text-ghost hover:text-text-secondary" title={t("studies.sites.actions.edit")}>
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm(t("studies.sites.confirmRemove"))) deleteMutation.mutate({ slug, siteId: site.id }); }}
                              className="p-1 text-text-ghost hover:text-critical"
                              title={t("studies.sites.actions.remove")}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
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
