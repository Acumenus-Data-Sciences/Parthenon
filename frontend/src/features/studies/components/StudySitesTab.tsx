import { useState } from "react";
import { Loader2, Plus, MapPin, Trash2, Edit3, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStudySites,
  useCreateStudySite,
  useUpdateStudySite,
  useDeleteStudySite,
} from "../hooks/useStudies";
import type { StudySite } from "../types/study";

const SITE_STATUS_COLORS: Record<string, string> = {
  pending: "#8A857D",
  invited: "#60A5FA",
  approved: "#2DD4BF",
  active: "#34D399",
  completed: "#A78BFA",
  withdrawn: "#E85A6B",
};

interface StudySitesTabProps {
  slug: string;
}

export function StudySitesTab({ slug }: StudySitesTabProps) {
  const { data: sites, isLoading } = useStudySites(slug);
  const createMutation = useCreateStudySite();
  const updateMutation = useUpdateStudySite();
  const deleteMutation = useDeleteStudySite();

  const [editId, setEditId] = useState<number | null>(null);
  const [editPayload, setEditPayload] = useState<Partial<StudySite>>({});

  const handleAdd = () => {
    createMutation.mutate({
      slug,
      payload: { source_id: 1, site_role: "data_partner", status: "pending" },
    });
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

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#C5C0B8]">Sites ({sites?.length ?? 0})</h3>
        <button type="button" onClick={handleAdd} disabled={createMutation.isPending} className="btn btn-primary btn-sm">
          {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add Site
        </button>
      </div>

      {(!sites || sites.length === 0) ? (
        <div className="empty-state">
          <MapPin size={24} className="text-[#323238] mb-2" />
          <h3 className="empty-title">No sites enrolled</h3>
          <p className="empty-message">Add data partner sites to this study</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Role</th>
                <th>Status</th>
                <th>IRB #</th>
                <th>Patients</th>
                <th>CDM</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const isEditing = editId === site.id;
                const color = SITE_STATUS_COLORS[site.status] ?? "#8A857D";
                return (
                  <tr key={site.id}>
                    <td className="text-[#F0EDE8] font-medium">{site.source?.source_name ?? `Source #${site.source_id}`}</td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editPayload.site_role ?? ""}
                          onChange={(e) => setEditPayload({ ...editPayload, site_role: e.target.value })}
                          className="form-input form-select py-1 text-xs"
                        >
                          <option value="data_partner">Data Partner</option>
                          <option value="coordinating_center">Coordinating Center</option>
                          <option value="analysis_center">Analysis Center</option>
                        </select>
                      ) : (
                        <span className="text-xs text-[#8A857D] capitalize">{site.site_role.replace(/_/g, " ")}</span>
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
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {site.status}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-[#8A857D]">{site.irb_protocol_number ?? "—"}</td>
                    <td className="text-xs text-[#8A857D] font-['IBM_Plex_Mono',monospace]">
                      {site.patient_count_estimate?.toLocaleString() ?? "—"}
                    </td>
                    <td className="text-xs text-[#8A857D]">{site.cdm_version ?? "—"}</td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={handleSave} className="p-1 text-[#2DD4BF] hover:text-[#2DD4BF]"><Save size={14} /></button>
                            <button type="button" onClick={() => setEditId(null)} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEdit(site)} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]"><Edit3 size={14} /></button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm("Remove this site?")) deleteMutation.mutate({ slug, siteId: site.id }); }}
                              className="p-1 text-[#5A5650] hover:text-[#E85A6B]"
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
