import { useState } from "react";
import { Ruler, Plus, Trash2, Loader2, Target, Sparkles } from "lucide-react";
import { useStudyMeasurements, useCreateMeasurement, useDeleteMeasurement, useAiExtractMeasurements, useSuggestTemplate } from "../hooks/useImaging";
import type { ImagingMeasurement, MeasurementType } from "../types";

const MEASUREMENT_PRESETS: Array<{
  label: string;
  description: string;
  fields: Array<{ type: MeasurementType; name: string; unit: string; isTarget?: boolean }>;
}> = [
  {
    label: "RECIST — Solid Tumor",
    description: "Target lesion longest diameter measurements for RECIST 1.1 assessment",
    fields: [
      { type: "longest_diameter", name: "Target Lesion 1", unit: "mm", isTarget: true },
      { type: "longest_diameter", name: "Target Lesion 2", unit: "mm", isTarget: true },
      { type: "perpendicular_diameter", name: "Target Lesion 1 (perp)", unit: "mm" },
    ],
  },
  {
    label: "COVID Lung CT",
    description: "CT severity scoring for COVID-19 pneumonia assessment",
    fields: [
      { type: "ct_severity_score", name: "CT Severity Index (0-25)", unit: "score" },
      { type: "ground_glass_extent", name: "Ground Glass Opacity", unit: "%" },
      { type: "consolidation_extent", name: "Consolidation", unit: "%" },
      { type: "opacity_score", name: "Total Opacity Score", unit: "%" },
    ],
  },
  {
    label: "PET Response (Lugano)",
    description: "SUVmax and metabolic measurements for lymphoma/PET response",
    fields: [
      { type: "suvmax", name: "SUVmax", unit: "SUV" },
      { type: "metabolic_tumor_volume", name: "Metabolic Tumor Volume", unit: "cm3" },
      { type: "total_lesion_glycolysis", name: "Total Lesion Glycolysis", unit: "g" },
    ],
  },
  {
    label: "Tumor Volumetrics",
    description: "3D tumor volume and density measurements",
    fields: [
      { type: "tumor_volume", name: "Tumor Volume", unit: "cm3" },
      { type: "longest_diameter", name: "Longest Diameter", unit: "mm" },
      { type: "density_hu", name: "Mean Density", unit: "HU" },
      { type: "lesion_count", name: "Lesion Count", unit: "count" },
    ],
  },
];

const BODY_SITES = [
  "CHEST", "LUNG", "ABDOMEN", "PELVIS", "HEAD", "BRAIN", "NECK",
  "LIVER", "KIDNEY", "SPINE", "EXTREMITY", "BREAST", "BONE", "COLON",
  "PANCREAS", "LYMPH_NODE", "WHOLEBODY",
];

interface MeasurementPanelProps {
  studyId: number;
  personId: number | null;
}

export default function MeasurementPanel({ studyId, personId }: MeasurementPanelProps) {
  const { data: measurements, isLoading } = useStudyMeasurements(studyId);
  const createMutation = useCreateMeasurement();
  const deleteMutation = useDeleteMeasurement();

  const aiExtract = useAiExtractMeasurements();
  const { data: suggestedTemplate } = useSuggestTemplate(studyId);

  const [showForm, setShowForm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  // Form state
  const [formType, setFormType] = useState("");
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formBodySite, setFormBodySite] = useState("");
  const [formLaterality, setFormLaterality] = useState("");
  const [formIsTarget, setFormIsTarget] = useState(false);
  const [formTargetNum, setFormTargetNum] = useState("");

  const resetForm = () => {
    setFormType("");
    setFormName("");
    setFormValue("");
    setFormUnit("");
    setFormBodySite("");
    setFormLaterality("");
    setFormIsTarget(false);
    setFormTargetNum("");
  };

  const applyPresetField = (field: (typeof MEASUREMENT_PRESETS)[number]["fields"][number]) => {
    setFormType(field.type);
    setFormName(field.name);
    setFormUnit(field.unit);
    setFormIsTarget(field.isTarget ?? false);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const value = parseFloat(formValue);
    if (isNaN(value) || !formType || !formName || !formUnit) return;

    createMutation.mutate({
      studyId,
      measurement_type: formType,
      measurement_name: formName,
      value_as_number: value,
      unit: formUnit,
      body_site: formBodySite || undefined,
      laterality: formLaterality as "LEFT" | "RIGHT" | "BILATERAL" | undefined || undefined,
      is_target_lesion: formIsTarget,
      target_lesion_number: formTargetNum ? parseInt(formTargetNum) : undefined,
    }, {
      onSuccess: () => {
        resetForm();
        setShowForm(false);
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* AI Extraction */}
      <div className="rounded-lg border border-[var(--domain-observation)]/30 bg-[var(--domain-observation)]/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[var(--domain-observation)]" />
            <h3 className="text-sm font-semibold text-text-primary">AI Measurement Extraction</h3>
          </div>
          <button
            type="button"
            onClick={() => aiExtract.mutate(studyId)}
            disabled={aiExtract.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--domain-observation)] px-4 py-2 text-sm font-medium text-white hover:bg-[#8B5CF6] disabled:opacity-50 transition-colors"
          >
            {aiExtract.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {aiExtract.isPending ? "Extracting…" : "Auto-Extract"}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Uses MedGemma to extract quantitative measurements from radiology reports and DICOM metadata.
          {suggestedTemplate ? ` Suggested template: ${suggestedTemplate.template}` : ""}
        </p>
        {aiExtract.isSuccess && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            Extracted {(aiExtract.data as { extracted: number }).extracted} measurements
            {(aiExtract.data as { measurement_types: string[] }).measurement_types.length > 0 &&
              ` (${(aiExtract.data as { measurement_types: string[] }).measurement_types.join(", ")})`}
          </div>
        )}
        {aiExtract.isError && (
          <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
            Extraction failed: {(aiExtract.error as Error)?.message ?? "Unknown error"}
          </div>
        )}
      </div>

      {/* Measurement presets */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Target size={14} className="text-accent" />
          Measurement Templates
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {MEASUREMENT_PRESETS.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedPreset(selectedPreset === i ? null : i)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                selectedPreset === i
                  ? "border-success/50 bg-success/5"
                  : "border-border-default hover:border-surface-highlight"
              }`}
            >
              <p className="text-xs font-medium text-text-primary">{preset.label}</p>
              <p className="text-[10px] text-text-ghost mt-0.5">{preset.description}</p>
            </button>
          ))}
        </div>

        {selectedPreset !== null && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border-default">
            {MEASUREMENT_PRESETS[selectedPreset].fields.map((field, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyPresetField(field)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs text-text-secondary hover:border-success hover:text-success transition-colors"
              >
                <Plus size={10} />
                {field.name} ({field.unit})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual entry form */}
      {showForm && (
        <div className="rounded-lg border border-success/30 bg-surface-raised p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Record Measurement</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Type</label>
              <input
                className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success transition-colors"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                placeholder="e.g. tumor_volume"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Name</label>
              <input
                className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success transition-colors"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Right upper lobe lesion"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Value</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  className="flex-1 rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success transition-colors font-mono"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="0.0"
                />
                <input
                  className="w-16 rounded-lg bg-surface-base border border-border-default px-2 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success transition-colors"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="mm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Body Site</label>
              <select
                className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success transition-colors"
                value={formBodySite}
                onChange={(e) => setFormBodySite(e.target.value)}
              >
                <option value="">— Optional —</option>
                {BODY_SITES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Laterality</label>
              <select
                className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success transition-colors"
                value={formLaterality}
                onChange={(e) => setFormLaterality(e.target.value)}
              >
                <option value="">— N/A —</option>
                <option value="LEFT">Left</option>
                <option value="RIGHT">Right</option>
                <option value="BILATERAL">Bilateral</option>
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsTarget}
                  onChange={(e) => setFormIsTarget(e.target.checked)}
                  className="rounded"
                />
                RECIST target
              </label>
              {formIsTarget && (
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="w-14 rounded-lg bg-surface-base border border-border-default px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-success transition-colors"
                  value={formTargetNum}
                  onChange={(e) => setFormTargetNum(e.target.value)}
                  placeholder="#"
                />
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formType || !formName || !formValue || !formUnit}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Save Measurement
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(false); }}
              className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border-default px-4 py-2 text-sm text-text-muted hover:text-success hover:border-success transition-colors w-full justify-center"
        >
          <Plus size={14} />
          Add Measurement
        </button>
      )}

      {/* Existing measurements table */}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 size={16} className="animate-spin text-success" />
        </div>
      )}

      {measurements && measurements.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised">
          <div className="px-4 py-3 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Ruler size={14} className="text-success" />
              Measurements ({measurements.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  {["Type", "Name", "Value", "Body Site", "Target", "Date", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-text-ghost uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {measurements.map((m: ImagingMeasurement) => (
                  <tr key={m.id} className="hover:bg-surface-overlay transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-surface-elevated text-text-muted">
                        {m.measurement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-primary text-xs font-medium">{m.measurement_name}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs font-mono">
                      {m.value_as_number.toFixed(2)} {m.unit}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {[m.body_site, m.laterality].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {m.is_target_lesion ? (
                        <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
                          T{m.target_lesion_number ?? ""}
                        </span>
                      ) : (
                        <span className="text-text-ghost">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {m.measured_at ? new Date(m.measured_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(m.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded text-text-ghost hover:text-critical hover:bg-critical/10 disabled:opacity-40 transition-colors"
                        title="Delete measurement"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!personId && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          This study is not linked to an OMOP patient. Measurements will be saved but won't appear in patient timelines until a person_id is linked.
        </div>
      )}
    </div>
  );
}
