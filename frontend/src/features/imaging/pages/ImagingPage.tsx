import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  Layers,
  BarChart3,
  Filter,
  RefreshCw,
  Brain,
  ChevronRight,
  Loader2,
  Users,
  Trash2,
  Upload,
  Activity,
} from "lucide-react";
import {
  useImagingStats,
  useImagingStudies,
  useImagingFeatures,
  useImagingCriteria,
  useDeleteImagingCriterion,
  useIndexFromDicomweb,
  usePopulationAnalytics,
} from "../hooks/useImaging";
import { DicomUploadModal } from "../components/DicomUploadModal";
import type { ImagingStudy, ImagingFeature } from "../types";
import { HelpButton } from "@/features/help";
import PatientTimelineTab from "../components/PatientTimelineTab";

const TABS = [
  { id: "studies", label: "Studies", icon: ScanLine },
  { id: "features", label: "AI Features", icon: Brain },
  { id: "criteria", label: "Imaging Criteria", icon: Filter },
  { id: "timeline", label: "Patient Timeline", icon: Activity },
  { id: "analytics", label: "Population Analytics", icon: BarChart3 },
] as const;

type Tab = (typeof TABS)[number]["id"];

const MODALITY_COLORS: Record<string, string> = {
  CT: "bg-blue-400/15 text-blue-400",
  MR: "bg-domain-observation/15 text-domain-observation",
  PT: "bg-orange-400/15 text-orange-400",
  US: "bg-success/15 text-success",
  CR: "bg-text-muted/15 text-text-muted",
  DX: "bg-text-muted/15 text-text-muted",
  MG: "bg-pink-400/15 text-pink-400",
};

function ModalityBadge({ modality }: { modality: string | null }) {
  if (!modality) return <span className="text-text-ghost text-sm">—</span>;
  const cls = MODALITY_COLORS[modality] ?? "bg-surface-elevated text-text-muted";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {modality}
    </span>
  );
}

function StudyStatusBadge({ status }: { status: string }) {
  const cls =
    status === "processed"
      ? "bg-success/15 text-success"
      : status === "error"
        ? "bg-critical/15 text-critical"
        : "bg-surface-elevated text-text-muted";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function StatsBar() {
  const { data: stats, isLoading } = useImagingStats();

  const items = [
    { label: "Total Studies", value: stats?.total_studies ?? 0, icon: ScanLine, color: "var(--info)" },
    { label: "AI Features", value: stats?.total_features ?? 0, icon: Brain, color: "var(--domain-observation)" },
    {
      label: "Persons with Imaging",
      value: stats?.persons_with_imaging ?? 0,
      icon: Users,
      color: "var(--success)",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-3"
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0"
            style={{ backgroundColor: `${item.color}18` }}
          >
            <item.icon size={16} style={{ color: item.color }} />
          </div>
          <div>
            <p
              className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
              style={{ color: item.color }}
            >
              {isLoading ? "—" : item.value.toLocaleString()}
            </p>
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}


function StudiesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceId = searchParams.get("source_id") ?? "";
  const modality = searchParams.get("modality") ?? "";
  const status = searchParams.get("status") ?? "";
  const bodyPart = searchParams.get("body_part") ?? "";
  const search = searchParams.get("q") ?? "";
  const dateFrom = searchParams.get("date_from") ?? "";
  const dateTo = searchParams.get("date_to") ?? "";
  const sortBy = searchParams.get("sort_by") ?? "study_date";
  const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const { data, isLoading } = useImagingStudies({
    source_id: sourceId ? parseInt(sourceId) : undefined,
    modality: modality || undefined,
    status: status || undefined,
    body_part: bodyPart || undefined,
    q: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    per_page: 25,
    page,
  });
  const indexMutation = useIndexFromDicomweb();

  const updateStudyParams = (updates: Record<string, string | null>, resetPage = false) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });

    if (resetPage) {
      next.delete("page");
    }

    next.set("tab", "studies");
    setSearchParams(next);
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      updateStudyParams({ sort_dir: sortDir === "asc" ? "desc" : "asc" }, true);
      return;
    }
    updateStudyParams(
      {
        sort_by: column,
        sort_dir: column === "study_date" ? "desc" : "asc",
      },
      true,
    );
  };

  return (
    <div className="space-y-4">
      {/* DICOMweb filter + index */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Filter by Source ID</label>
          <input
            className="w-28 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            placeholder="e.g. 9"
            value={sourceId}
            onChange={(e) => updateStudyParams({ source_id: e.target.value }, true)}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Modality</label>
          <input
            className="w-40 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            placeholder="CT, MR…"
            value={modality}
            onChange={(e) => updateStudyParams({ modality: e.target.value }, true)}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Status</label>
          <select
            className="w-36 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            value={status}
            onChange={(e) => updateStudyParams({ status: e.target.value }, true)}
          >
            <option value="">All statuses</option>
            <option value="indexed">indexed</option>
            <option value="processed">processed</option>
            <option value="error">error</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Body Part</label>
          <input
            className="w-40 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            placeholder="Chest, Brain…"
            value={bodyPart}
            onChange={(e) => updateStudyParams({ body_part: e.target.value }, true)}
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="block text-xs text-text-muted mb-1.5">Find</label>
          <input
            className="w-full rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            placeholder="UID, accession, description, patient…"
            value={search}
            onChange={(e) => updateStudyParams({ q: e.target.value }, true)}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5">From</label>
          <input
            type="date"
            className="w-40 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            value={dateFrom}
            onChange={(e) => updateStudyParams({ date_from: e.target.value }, true)}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5">To</label>
          <input
            type="date"
            className="w-40 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
            value={dateTo}
            onChange={(e) => updateStudyParams({ date_to: e.target.value }, true)}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            [
              "source_id",
              "modality",
              "status",
              "body_part",
              "q",
              "date_from",
              "date_to",
              "sort_by",
              "sort_dir",
              "page",
            ].forEach((key) => next.delete(key));
            next.set("tab", "studies");
            setSearchParams(next);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
        >
          Reset
        </button>
        {sourceId && (
          <button
            type="button"
            onClick={() =>
              indexMutation.mutate({
                source_id: parseInt(sourceId),
                modality: modality || undefined,
                sync_all: true,
                batch_size: 100,
              })
            }
            disabled={indexMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={indexMutation.isPending ? "animate-spin" : ""} />
            Sync Full Catalog
          </button>
        )}
      </div>

      {indexMutation.isSuccess && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Indexed {(indexMutation.data as { indexed: number }).indexed} new /{" "}
          updated {(indexMutation.data as { updated: number }).updated} studies
          {"scanned" in (indexMutation.data as object) && (
            <> across {String((indexMutation.data as { scanned?: number }).scanned ?? 0)} scanned records</>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                {[
                  ["Study Date", "study_date"],
                  ["Modality", "modality"],
                  ["Body Part", "body_part_examined"],
                  ["Description", "study_description"],
                  ["Series", "num_series"],
                  ["Images", "num_images"],
                  ["Person", "person_id"],
                  ["Status", "status"],
                ].map(([label, column]) => (
                    <th
                      key={label}
                      className="px-4 py-2.5 text-left text-[10px] font-medium text-text-ghost uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1 hover:text-text-secondary"
                      >
                        {label}
                        {sortBy === column && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                      </button>
                    </th>
                  ))}
                <th
                  className="px-4 py-2.5 text-left text-[10px] font-medium text-text-ghost uppercase tracking-wider"
                >
                  {""}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="text-center py-10">
                    <Loader2 size={20} className="animate-spin text-success mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && !data?.data?.length && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm text-text-ghost">
                    No studies indexed. Use "Import Local DICOM Files" above or enter a Source ID and click "Index from DICOMweb".
                  </td>
                </tr>
              )}
              {data?.data?.map((study: ImagingStudy) => (
                <tr key={study.id} className="hover:bg-surface-overlay transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs">{study.study_date ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ModalityBadge modality={study.modality} />
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {study.body_part_examined ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs max-w-xs truncate">
                    {study.study_description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs text-center">
                    {study.num_series}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs text-center">
                    {study.num_images}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">{study.person_id ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StudyStatusBadge status={study.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={{
                        pathname: `/imaging/studies/${study.id}`,
                        search: searchParams.toString() ? `?${searchParams.toString()}` : "",
                      }}
                      className="inline-flex items-center gap-1 text-xs text-success hover:text-success-dark transition-colors"
                    >
                      Details <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-text-ghost border-t border-border-default">
            <div>
              {data.total.toLocaleString()} total studies · page {data.current_page} of{" "}
              {data.last_page}
            </div>
            <div className="flex items-center gap-2">
                <button
                  type="button"
                onClick={() => updateStudyParams({ page: String(Math.max(1, page - 1)) })}
                disabled={data.current_page <= 1 || isLoading}
                className="rounded border border-border-default px-2.5 py-1 text-text-muted hover:text-text-secondary hover:border-surface-highlight disabled:opacity-40"
              >
                Prev
              </button>
                <button
                  type="button"
                onClick={() => updateStudyParams({ page: String(Math.min(data.last_page, page + 1)) })}
                disabled={data.current_page >= data.last_page || isLoading}
                className="rounded border border-border-default px-2.5 py-1 text-text-muted hover:text-text-secondary hover:border-surface-highlight disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturesTab() {
  const [featureType, setFeatureType] = useState("");
  const { data, isLoading } = useImagingFeatures({
    feature_type: featureType || undefined,
    per_page: 50,
  });

  const ConfidenceBar = ({ v }: { v: number | null }) => {
    if (v === null) return <span className="text-text-ghost">—</span>;
    const pct = Math.round(v * 100);
    const barColor =
      pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--critical)";
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-base rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <span className="text-xs text-text-muted w-8 text-right">{pct}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-text-muted mb-1.5">Feature Type</label>
        <select
          className="w-52 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success transition-colors"
          value={featureType}
          onChange={(e) => setFeatureType(e.target.value)}
        >
          <option value="">All feature types</option>
          <option value="nlp_finding">NLP Finding</option>
          <option value="ai_classification">AI Classification</option>
          <option value="radiomic">Radiomic</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                {["Feature", "Type", "Body Site", "Value", "Algorithm", "Confidence", "OMOP Concept"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-medium text-text-ghost uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <Loader2 size={20} className="animate-spin text-success mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && !data?.data?.length && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-text-ghost">
                    No features extracted yet. Use "Extract NLP" on a study to populate.
                  </td>
                </tr>
              )}
              {data?.data?.map((f: ImagingFeature) => (
                <tr key={f.id} className="hover:bg-surface-overlay transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary text-xs">{f.feature_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-surface-elevated text-text-muted">
                      {f.feature_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">{f.body_site ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {f.value_as_number !== null
                      ? `${f.value_as_number} ${f.unit_source_value ?? ""}`
                      : f.value_as_string ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text-ghost text-xs">{f.algorithm_name ?? "—"}</td>
                  <td className="px-4 py-3" style={{ width: 140 }}>
                    <ConfidenceBar v={f.confidence} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-text-ghost">
                    {f.value_concept_id ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-2.5 text-xs text-text-ghost border-t border-border-default">
            {data.total.toLocaleString()} total features
          </div>
        )}
      </div>
    </div>
  );
}

function CriteriaTab() {
  const { data: criteria, isLoading } = useImagingCriteria();
  const deleteMutation = useDeleteImagingCriterion();

  const TYPE_LABELS: Record<string, string> = {
    modality: "Modality",
    anatomy: "Anatomy",
    quantitative: "Quantitative",
    ai_classification: "AI Classification",
    dose: "Radiation Dose",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Saved imaging cohort criteria. Use these in the Cohort Builder to select patients based on
        imaging characteristics.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-text-ghost">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!isLoading && !criteria?.length && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-10 text-center text-sm text-text-ghost">
          No imaging criteria saved yet.
        </div>
      )}

      <div className="space-y-2">
        {criteria?.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-border-default bg-surface-raised p-4 flex items-start gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-text-primary text-sm">{c.name}</span>
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-surface-elevated text-text-muted">
                  {TYPE_LABELS[c.criteria_type] ?? c.criteria_type}
                </span>
                {c.is_shared && (
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success">
                    Shared
                  </span>
                )}
              </div>
              {c.description && (
                <p className="text-sm text-text-muted mb-2">{c.description}</p>
              )}
              <pre className="text-xs text-text-ghost mt-2 bg-surface-base border border-border-default rounded-lg p-2 overflow-auto">
                {JSON.stringify(c.criteria_definition, null, 2)}
              </pre>
            </div>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(c.id)}
              disabled={deleteMutation.isPending}
              className="p-1.5 rounded text-text-ghost hover:text-critical hover:bg-critical/10 disabled:opacity-40 transition-colors flex-shrink-0"
              title="Delete criterion"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const [sourceId, setSourceId] = useState("");
  const sid = sourceId ? parseInt(sourceId) : 0;
  const { data, isLoading } = usePopulationAnalytics(sid);

  const maxModalityN = data ? Math.max(...data.by_modality.map((m) => m.n), 1) : 1;
  const maxBodyN = data ? Math.max(...data.by_body_part.map((b) => b.n), 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs text-text-muted mb-1.5">Source ID</label>
        <input
          className="w-36 rounded-lg bg-surface-raised border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
          placeholder="e.g. 9"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        />
      </div>

      {!sid && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-10 text-center text-sm text-text-ghost">
          Enter a Source ID to view population imaging analytics.
        </div>
      )}

      {sid > 0 && isLoading && (
        <div className="flex items-center gap-2 text-text-ghost">
          <Loader2 size={14} className="animate-spin text-success" />
          <span className="text-sm">Loading analytics…</span>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-4">
          {/* By Modality */}
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <ScanLine size={14} className="text-info" />
              Studies by Modality
            </h3>
            <div className="space-y-2.5">
              {data.by_modality.map((row) => (
                <div key={row.modality}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono font-semibold text-text-secondary">{row.modality}</span>
                    <span className="text-text-ghost">
                      {row.n.toLocaleString()} ({row.unique_persons.toLocaleString()} persons)
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-base rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.n / maxModalityN) * 100}%`,
                        backgroundColor: "var(--success)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By Body Part */}
          <div className="rounded-lg border border-border-default bg-surface-raised p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Layers size={14} className="text-info" />
              Studies by Body Part
            </h3>
            <div className="space-y-2.5">
              {data.by_body_part.map((row) => (
                <div key={row.body_part_examined}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary">{row.body_part_examined}</span>
                    <span className="text-text-ghost">{row.n.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-surface-base rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.n / maxBodyN) * 100}%`,
                        backgroundColor: "var(--info)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Features */}
          {data.top_features.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-raised p-4 col-span-2">
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Brain size={14} className="text-domain-observation" />
                Top AI / NLP Features
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {data.top_features.map((f, i) => (
                  <div key={i} className="rounded-lg bg-surface-base border border-border-default p-3">
                    <p className="font-medium text-sm text-text-primary truncate">{f.feature_name}</p>
                    <p className="text-xs text-text-ghost mt-0.5">{f.feature_type}</p>
                    <p
                      className="text-lg font-semibold font-['IBM_Plex_Mono',monospace] text-domain-observation mt-1"
                    >
                      {f.n.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImagingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();
  const tabParam = searchParams.get("tab");
  const tab: Tab = TABS.some(({ id }) => id === tabParam) ? (tabParam as Tab) : "studies";

  const setTab = (nextTab: Tab) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === "studies") {
      next.delete("tab");
    } else {
      next.set("tab", nextTab);
    }
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-info/12 flex-shrink-0">
          <ScanLine size={18} style={{ color: "var(--info)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Medical Imaging</h1>
          <p className="text-sm text-text-muted">
            Longitudinal imaging analysis, treatment response assessment, and outcomes research
          </p>
        </div>
        <HelpButton helpKey="imaging" />
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-surface-base hover:bg-info-dark transition-colors"
        >
          <Upload size={14} />
          Import DICOM
        </button>
      </div>

      <DicomUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["imaging"] });
        }}
      />

      <StatsBar />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-default">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? "border-success text-success"
                : "border-transparent text-text-ghost hover:text-text-muted"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "timeline" && <PatientTimelineTab />}
      {tab === "studies" && <StudiesTab />}
      {tab === "features" && <FeaturesTab />}
      {tab === "criteria" && <CriteriaTab />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}
