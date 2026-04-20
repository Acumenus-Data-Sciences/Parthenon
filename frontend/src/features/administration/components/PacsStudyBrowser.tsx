import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { usePacsStudies } from "../hooks/usePacsConnections";
import type { PacsConnection, PacsStudyFilters } from "../api/pacsApi";

interface PacsStudyBrowserProps {
  connection: PacsConnection | null;
  onClose: () => void;
}

const PAGE_SIZE = 25;

const MODALITY_OPTIONS = ["", "CT", "MR", "PT", "US", "CR", "DX", "MG"] as const;

export default function PacsStudyBrowser({
  connection,
  onClose,
}: PacsStudyBrowserProps) {
  const { t } = useTranslation("app");
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [modality, setModality] = useState("");
  const [offset, setOffset] = useState(0);

  // Debounced filters
  const [debouncedFilters, setDebouncedFilters] = useState<PacsStudyFilters>({
    limit: PAGE_SIZE,
    offset: 0,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUpdate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFilters({
        patient_name: patientName || undefined,
        patient_id: patientId || undefined,
        modality: modality || undefined,
        limit: PAGE_SIZE,
        offset,
      });
    }, 300);
  }, [patientName, patientId, modality, offset]);

  useEffect(() => {
    scheduleUpdate();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scheduleUpdate]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [patientName, patientId, modality]);

  // Reset all when connection changes
  useEffect(() => {
    setPatientName("");
    setPatientId("");
    setModality("");
    setOffset(0);
  }, [connection?.id]);

  const { data, isLoading } = usePacsStudies(
    connection?.id ?? null,
    debouncedFilters,
  );

  const studies = data?.studies ?? [];
  const hasMore = data?.has_more ?? false;
  const totalStudies = data?.total_studies ?? null;
  const hasNext = hasMore;
  const hasPrev = offset > 0;

  if (!connection) return null;

  const inputCls =
    "w-full px-2.5 py-1.5 text-xs bg-surface-base border border-border-default rounded-lg text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success/50 focus:ring-1 focus:ring-success/30";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Slide panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[600px] bg-surface-raised border-l border-border-default shadow-2xl",
          "transform transition-transform duration-200 ease-out",
          connection ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary truncate">
            {t("administration.pacs.studyBrowser.browseTitle", {
              name: connection.name,
            })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-text-ghost hover:text-text-secondary hover:bg-surface-elevated transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-border-default space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <input
                className={inputCls}
                placeholder={t("administration.pacs.studyBrowser.filters.patientName")}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>
            <div>
              <input
                className={inputCls}
                placeholder={t("administration.pacs.studyBrowser.filters.patientId")}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>
            <div>
              <select
                className={inputCls}
                value={modality}
                onChange={(e) => setModality(e.target.value)}
              >
                <option value="">
                  {t("administration.pacs.studyBrowser.filters.allModalities")}
                </option>
                {MODALITY_OPTIONS.filter(Boolean).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto" style={{ height: "calc(100vh - 140px)" }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-success" />
            </div>
          ) : studies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-ghost">
              <Search size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-medium text-text-muted">
                {t("administration.pacs.studyBrowser.empty.noStudies")}
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default text-[10px] font-medium text-text-ghost uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">
                      {t("administration.pacs.studyBrowser.table.patientName")}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t("administration.pacs.studyBrowser.table.patientId")}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t("administration.pacs.studyBrowser.table.date")}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t("administration.pacs.studyBrowser.table.modality")}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t("administration.pacs.studyBrowser.table.description")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("administration.pacs.studyBrowser.table.series")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("administration.pacs.studyBrowser.table.instances")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studies.map((study, i) => (
                    <tr
                      key={study.study_instance_uid ?? i}
                      className="border-b border-border-subtle hover:bg-surface-overlay transition-colors"
                    >
                      <td className="px-3 py-2 text-text-primary truncate max-w-[120px]">
                        {study.patient_name ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-text-muted font-['IBM_Plex_Mono',monospace]">
                        {study.patient_id ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-text-muted font-['IBM_Plex_Mono',monospace]">
                        {study.study_date ?? "--"}
                      </td>
                      <td className="px-3 py-2">
                        {study.modalities ? (
                          <span className="rounded px-1 py-0.5 bg-success/10 text-success text-[10px] font-medium">
                            {study.modalities}
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-muted truncate max-w-[140px]">
                        {study.study_description ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary font-['IBM_Plex_Mono',monospace]">
                        {study.num_series ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary font-['IBM_Plex_Mono',monospace]">
                        {study.num_instances ?? "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-default">
                <span className="text-xs text-text-ghost">
                  {t("administration.pacs.studyBrowser.pagination.range", {
                    start: offset + 1,
                    end: offset + studies.length,
                  })}
                  {totalStudies != null && (
                    <>
                      {" "}
                      <span className="font-['IBM_Plex_Mono',monospace]">
                        {t("administration.pacs.studyBrowser.pagination.ofStudies", {
                          total: totalStudies.toLocaleString(),
                        })}
                      </span>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={!hasPrev}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={12} />
                    {t("administration.pacs.studyBrowser.pagination.previous")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={!hasNext}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {t("administration.pacs.studyBrowser.pagination.next")}
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
