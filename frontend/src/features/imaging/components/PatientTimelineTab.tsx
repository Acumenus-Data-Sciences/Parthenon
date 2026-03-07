import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, Users, ChevronRight, Loader2, ScanLine, Link2,
} from "lucide-react";
import {
  usePatientsWithImaging,
  usePatientTimeline,
  useAutoLinkStudies,
} from "../hooks/useImaging";
import PatientTimeline from "./PatientTimeline";

export default function PatientTimelineTab() {
  const [personIdInput, setPersonIdInput] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<number>(0);
  const [minStudies, setMinStudies] = useState(2);

  const { data: patients, isLoading: patientsLoading } = usePatientsWithImaging({
    min_studies: minStudies,
    per_page: 20,
  });

  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
  } = usePatientTimeline(selectedPersonId);

  const autoLink = useAutoLinkStudies();

  const handleSearch = () => {
    const pid = parseInt(personIdInput);
    if (pid > 0) setSelectedPersonId(pid);
  };

  const handleSelectPatient = (personId: number) => {
    setSelectedPersonId(personId);
    setPersonIdInput(String(personId));
  };

  return (
    <div className="space-y-6">
      {/* Search + Auto-link bar */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-[#8A857D] mb-1.5">Patient Person ID</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg bg-[#151518] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors font-mono"
              placeholder="Enter OMOP person_id…"
              value={personIdInput}
              onChange={(e) => setPersonIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!personIdInput}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 transition-colors"
            >
              <Search size={14} />
              View Timeline
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => autoLink.mutate()}
          disabled={autoLink.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] disabled:opacity-50 transition-colors"
        >
          {autoLink.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Link2 size={14} />
          )}
          Auto-Link Studies
        </button>
      </div>

      {autoLink.isSuccess && (
        <div className="rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-4 py-3 text-sm text-[#2DD4BF]">
          Auto-linked {(autoLink.data as { linked: number }).linked} studies to OMOP persons.
        </div>
      )}

      {/* Timeline view (when a patient is selected) */}
      {selectedPersonId > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[#232328] pb-3">
            <Users size={14} className="text-[#A78BFA]" />
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Patient Timeline — Person {selectedPersonId}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedPersonId(0)}
              className="ml-auto text-xs text-[#5A5650] hover:text-[#8A857D] transition-colors"
            >
              ← Back to patient list
            </button>
          </div>

          {timeline && (
            <PatientTimeline
              data={timeline}
              isLoading={timelineLoading}
              error={timelineError as Error | null}
            />
          )}
          {timelineLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
            </div>
          )}
          {timelineError && !timeline && (
            <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 p-6 text-center text-sm text-[#E85A6B]">
              Failed to load timeline: {(timelineError as Error).message}
            </div>
          )}
        </div>
      )}

      {/* Patients with imaging list (when no patient selected) */}
      {selectedPersonId === 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
              <Users size={14} className="text-[#A78BFA]" />
              Patients with Longitudinal Imaging
            </h3>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider">Min studies</label>
              <select
                className="rounded-lg bg-[#151518] border border-[#232328] px-2 py-1 text-xs text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF] transition-colors"
                value={minStudies}
                onChange={(e) => setMinStudies(parseInt(e.target.value))}
              >
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="5">5+</option>
              </select>
            </div>
          </div>

          {patientsLoading && (
            <div className="flex items-center gap-2 py-8 justify-center text-[#5A5650]">
              <Loader2 size={16} className="animate-spin text-[#2DD4BF]" />
              <span className="text-sm">Loading patients…</span>
            </div>
          )}

          {!patientsLoading && (!patients?.data || patients.data.length === 0) && (
            <div className="rounded-lg border border-[#232328] bg-[#151518] p-10 text-center text-sm text-[#5A5650]">
              No patients with linked imaging studies found. Use "Auto-Link Studies" to match DICOM patient IDs to OMOP persons,
              or manually link studies on the Studies tab.
            </div>
          )}

          {patients && patients.data && patients.data.length > 0 && (
            <div className="rounded-lg border border-[#232328] bg-[#151518]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#232328]">
                      {["Person ID", "Studies", "Modalities", "First Study", "Last Study", ""].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-[#5A5650] uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E1E23]">
                    {patients.data.map((p) => (
                      <tr key={p.person_id} className="hover:bg-[#1A1A1F] transition-colors cursor-pointer" onClick={() => handleSelectPatient(p.person_id)}>
                        <td className="px-4 py-3 text-[#F0EDE8] text-xs font-mono font-semibold">{p.person_id}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#60A5FA]/15 text-[#60A5FA]">
                            <ScanLine size={10} />
                            {p.study_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#8A857D] text-xs">
                          {(Array.isArray(p.modalities) ? p.modalities : []).filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-[#C5C0B8] text-xs">{p.first_study_date ?? "—"}</td>
                        <td className="px-4 py-3 text-[#C5C0B8] text-xs">{p.last_study_date ?? "—"}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
                          >
                            Timeline <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 text-xs text-[#5A5650] border-t border-[#232328]">
                {patients.total} patients · page {patients.current_page} of {patients.last_page}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
