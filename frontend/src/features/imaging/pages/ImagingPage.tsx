import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ScanLine,
  Activity,
  Layers,
  BarChart3,
  Filter,
  RefreshCw,
  Brain,
  ChevronRight,
} from "lucide-react";
import {
  useImagingStats,
  useImagingStudies,
  useImagingFeatures,
  useImagingCriteria,
  useDeleteImagingCriterion,
  useIndexFromDicomweb,
  useExtractNlp,
} from "../hooks/useImaging";
import type { ImagingStudy, ImagingFeature } from "../types";

const TABS = [
  { id: "studies", label: "Studies", icon: ScanLine },
  { id: "features", label: "AI Features", icon: Brain },
  { id: "criteria", label: "Imaging Criteria", icon: Filter },
] as const;

type Tab = (typeof TABS)[number]["id"];

const MODALITY_COLORS: Record<string, string> = {
  CT: "bg-blue-100 text-blue-800",
  MR: "bg-purple-100 text-purple-800",
  PT: "bg-orange-100 text-orange-800",
  US: "bg-teal-100 text-teal-800",
  CR: "bg-slate-100 text-slate-700",
  DX: "bg-slate-100 text-slate-700",
  MG: "bg-pink-100 text-pink-800",
};

function ModalityBadge({ modality }: { modality: string | null }) {
  if (!modality) return <span className="text-muted text-sm">—</span>;
  const cls = MODALITY_COLORS[modality] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {modality}
    </span>
  );
}

function StatsBar() {
  const { data: stats, isLoading } = useImagingStats();

  const items = [
    { label: "Total Studies", value: stats?.total_studies ?? 0 },
    { label: "AI Features", value: stats?.total_features ?? 0 },
    { label: "Persons with Imaging", value: stats?.persons_with_imaging ?? 0 },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {items.map((item) => (
        <div key={item.label} className="card p-4">
          <p className="text-sm text-muted mb-1">{item.label}</p>
          <p className="text-2xl font-bold">
            {isLoading ? "—" : item.value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function StudiesTab() {
  const [sourceId, setSourceId] = useState("");
  const [modality, setModality] = useState("");
  const { data, isLoading } = useImagingStudies({
    source_id: sourceId ? parseInt(sourceId) : undefined,
    modality: modality || undefined,
    per_page: 25,
  });
  const indexMutation = useIndexFromDicomweb();

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          className="input"
          placeholder="Source ID"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          style={{ width: 120 }}
        />
        <input
          className="input"
          placeholder="Modality (CT, MR…)"
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          style={{ width: 160 }}
        />
        {sourceId && (
          <button
            className="btn btn-secondary"
            onClick={() =>
              indexMutation.mutate({
                source_id: parseInt(sourceId),
                modality: modality || undefined,
              })
            }
            disabled={indexMutation.isPending}
          >
            <RefreshCw size={14} className={indexMutation.isPending ? "animate-spin" : ""} />
            Index from DICOMweb
          </button>
        )}
      </div>

      {indexMutation.isSuccess && (
        <div className="alert alert-success mb-4 text-sm">
          Indexed {(indexMutation.data as { indexed: number }).indexed} new /{" "}
          updated {(indexMutation.data as { updated: number }).updated} studies
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Study Date</th>
              <th>Modality</th>
              <th>Body Part</th>
              <th>Description</th>
              <th>Series</th>
              <th>Images</th>
              <th>Person</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-muted">
                  Loading studies…
                </td>
              </tr>
            )}
            {!isLoading && (!data?.data?.length) && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-muted">
                  No studies indexed. Enter a Source ID and click "Index from DICOMweb" to import.
                </td>
              </tr>
            )}
            {data?.data?.map((study: ImagingStudy) => (
              <tr key={study.id}>
                <td>{study.study_date ?? "—"}</td>
                <td>
                  <ModalityBadge modality={study.modality} />
                </td>
                <td className="text-sm">{study.body_part_examined ?? "—"}</td>
                <td className="text-sm max-w-xs truncate">
                  {study.study_description ?? "—"}
                </td>
                <td className="text-center">{study.num_series}</td>
                <td className="text-center">{study.num_images}</td>
                <td className="text-sm">{study.person_id ?? "—"}</td>
                <td>
                  <span
                    className={`badge badge-sm ${
                      study.status === "processed"
                        ? "badge-success"
                        : study.status === "error"
                          ? "badge-danger"
                          : "badge-neutral"
                    }`}
                  >
                    {study.status}
                  </span>
                </td>
                <td>
                  <Link
                    to={`/imaging/studies/${study.id}`}
                    className="text-accent hover:underline text-sm flex items-center gap-1"
                  >
                    Details <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && (
          <div className="p-3 text-sm text-muted border-t">
            {data.total.toLocaleString()} total studies · page {data.current_page} of{" "}
            {data.last_page}
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

  const CONFIDENCE_BAR = (v: number | null) => {
    if (v === null) return null;
    const pct = Math.round(v * 100);
    const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-400";
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-muted w-8 text-right">{pct}%</span>
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          className="input"
          value={featureType}
          onChange={(e) => setFeatureType(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">All feature types</option>
          <option value="nlp_finding">NLP Finding</option>
          <option value="ai_classification">AI Classification</option>
          <option value="radiomic">Radiomic</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Type</th>
              <th>Body Site</th>
              <th>Value</th>
              <th>Algorithm</th>
              <th>Confidence</th>
              <th>OMOP Concept</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted">
                  Loading features…
                </td>
              </tr>
            )}
            {!isLoading && !data?.data?.length && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted">
                  No features extracted yet. Use "Extract NLP" on a study to populate.
                </td>
              </tr>
            )}
            {data?.data?.map((f: ImagingFeature) => (
              <tr key={f.id}>
                <td className="font-medium text-sm">{f.feature_name}</td>
                <td>
                  <span className="badge badge-sm badge-neutral">{f.feature_type}</span>
                </td>
                <td className="text-sm">{f.body_site ?? "—"}</td>
                <td className="text-sm">
                  {f.value_as_number !== null
                    ? `${f.value_as_number} ${f.unit_source_value ?? ""}`
                    : f.value_as_string ?? "—"}
                </td>
                <td className="text-sm text-muted">{f.algorithm_name ?? "—"}</td>
                <td style={{ width: 120 }}>{CONFIDENCE_BAR(f.confidence)}</td>
                <td className="text-sm font-mono text-muted">
                  {f.value_concept_id ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && (
          <div className="p-3 text-sm text-muted border-t">
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
    <div>
      <p className="text-sm text-muted mb-4">
        Saved imaging cohort criteria. Use these in the Cohort Builder to select patients based on
        imaging characteristics.
      </p>

      {isLoading && <div className="text-muted text-sm">Loading…</div>}

      {!isLoading && !criteria?.length && (
        <div className="card p-8 text-center text-muted">
          No imaging criteria saved yet.
        </div>
      )}

      <div className="space-y-2">
        {criteria?.map((c) => (
          <div key={c.id} className="card p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{c.name}</span>
                <span className="badge badge-sm badge-neutral">
                  {TYPE_LABELS[c.criteria_type] ?? c.criteria_type}
                </span>
                {c.is_shared && (
                  <span className="badge badge-sm badge-success">Shared</span>
                )}
              </div>
              {c.description && <p className="text-sm text-muted">{c.description}</p>}
              <pre className="text-xs text-muted mt-2 bg-surface rounded p-2 overflow-auto">
                {JSON.stringify(c.criteria_definition, null, 2)}
              </pre>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => deleteMutation.mutate(c.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ImagingPage() {
  const [tab, setTab] = useState<Tab>("studies");

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header mb-6">
        <div className="flex items-center gap-3">
          <ScanLine size={24} className="text-accent" />
          <div>
            <h1 className="page-title">Medical Imaging</h1>
            <p className="page-subtitle">
              DICOM study management, AI feature extraction, and imaging cohort criteria
            </p>
          </div>
        </div>
      </div>

      <StatsBar />

      {/* Tabs */}
      <div className="tabs mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`tab ${tab === id ? "tab-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "studies" && <StudiesTab />}
      {tab === "features" && <FeaturesTab />}
      {tab === "criteria" && <CriteriaTab />}
    </div>
  );
}
