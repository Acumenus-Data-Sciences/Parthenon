import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Layers, Brain, RefreshCw } from "lucide-react";
import { useImagingStudy, useIndexSeries, useExtractNlp, useImagingFeatures } from "../hooks/useImaging";
import type { ImagingSeries, ImagingFeature } from "../types";

export default function ImagingStudyPage() {
  const { id } = useParams<{ id: string }>();
  const studyId = parseInt(id ?? "0");

  const { data: study, isLoading } = useImagingStudy(studyId);
  const { data: features } = useImagingFeatures({ study_id: studyId, per_page: 50 });
  const indexSeries = useIndexSeries();
  const extractNlp = useExtractNlp();

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="text-muted">Loading study…</div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="page-container">
        <div className="text-muted">Study not found.</div>
      </div>
    );
  }

  const fields = [
    { label: "Study Instance UID", value: study.study_instance_uid },
    { label: "Accession Number", value: study.accession_number ?? "—" },
    { label: "Modality", value: study.modality ?? "—" },
    { label: "Body Part", value: study.body_part_examined ?? "—" },
    { label: "Description", value: study.study_description ?? "—" },
    { label: "Study Date", value: study.study_date ?? "—" },
    { label: "Series Count", value: study.num_series },
    { label: "Image Count", value: study.num_images },
    { label: "Person ID", value: study.person_id ?? "—" },
    { label: "Status", value: study.status },
  ];

  return (
    <div className="page-container">
      <Link to="/imaging" className="flex items-center gap-1 text-sm text-muted mb-4 hover:text-foreground">
        <ChevronLeft size={14} /> Back to Imaging
      </Link>

      <h1 className="page-title mb-1">DICOM Study</h1>
      <p className="text-muted text-sm mb-6 font-mono truncate">{study.study_instance_uid}</p>

      <div className="flex gap-2 mb-6">
        <button
          className="btn btn-secondary"
          onClick={() => indexSeries.mutate(studyId)}
          disabled={indexSeries.isPending}
        >
          <Layers size={14} className={indexSeries.isPending ? "animate-spin" : ""} />
          Index Series
        </button>
        {study.person_id && (
          <button
            className="btn btn-secondary"
            onClick={() => extractNlp.mutate(studyId)}
            disabled={extractNlp.isPending}
          >
            <Brain size={14} className={extractNlp.isPending ? "animate-spin" : ""} />
            Extract NLP
          </button>
        )}
      </div>

      {indexSeries.isSuccess && (
        <div className="alert alert-success mb-4 text-sm">
          Indexed {(indexSeries.data as { indexed: number }).indexed} series.
        </div>
      )}
      {extractNlp.isSuccess && (
        <div className="alert alert-success mb-4 text-sm">
          Extracted {(extractNlp.data as { extracted: number }).extracted} findings,{" "}
          {(extractNlp.data as { mapped: number }).mapped} OMOP-mapped.
        </div>
      )}

      {/* Metadata */}
      <div className="card p-4 mb-6">
        <h2 className="font-semibold mb-3">Study Metadata</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex gap-2">
              <dt className="text-muted text-sm w-36 shrink-0">{label}</dt>
              <dd className="text-sm font-medium break-all">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Series */}
      {study.series && study.series.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="p-4 border-b font-semibold flex items-center gap-2">
            <Layers size={14} /> Series ({study.series.length})
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Modality</th>
                <th>Description</th>
                <th>Images</th>
                <th>Slice Thickness</th>
                <th>Manufacturer</th>
              </tr>
            </thead>
            <tbody>
              {study.series.map((s: ImagingSeries) => (
                <tr key={s.id}>
                  <td className="text-sm">{s.series_number ?? "—"}</td>
                  <td className="text-sm font-semibold">{s.modality ?? "—"}</td>
                  <td className="text-sm">{s.series_description ?? "—"}</td>
                  <td className="text-sm">{s.num_images}</td>
                  <td className="text-sm">
                    {s.slice_thickness_mm !== null ? `${s.slice_thickness_mm} mm` : "—"}
                  </td>
                  <td className="text-sm text-muted">
                    {[s.manufacturer, s.manufacturer_model].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Features */}
      {features && features.total > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b font-semibold flex items-center gap-2">
            <Brain size={14} /> AI Features ({features.total})
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>Type</th>
                <th>Body Site</th>
                <th>Value</th>
                <th>Confidence</th>
                <th>OMOP</th>
              </tr>
            </thead>
            <tbody>
              {features.data.map((f: ImagingFeature) => (
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
                  <td className="text-sm">
                    {f.confidence !== null ? `${Math.round(f.confidence * 100)}%` : "—"}
                  </td>
                  <td className="text-sm font-mono text-muted">
                    {f.value_concept_id ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
