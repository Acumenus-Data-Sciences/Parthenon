import { useState, useEffect } from "react";
import {
  Plus,
  X,
  Save,
  Loader2,
  Trash2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBundle,
  useUpdateBundle,
  useCreateBundle,
  useBundleMeasures,
  useRemoveBundleMeasure,
} from "../hooks/useCareGaps";
import type { QualityMeasure } from "../types/careGap";

const DISEASE_CATEGORIES = [
  "",
  "Endocrine",
  "Cardiovascular",
  "Respiratory",
  "Mental Health",
  "Rheumatologic",
  "Neurological",
  "Oncology",
];

interface BundleDesignerProps {
  bundleId: number | null;
}

export function BundleDesigner({ bundleId }: BundleDesignerProps) {
  const { data: bundle } = useBundle(bundleId);
  const { data: measures } = useBundleMeasures(bundleId);
  const updateMutation = useUpdateBundle();
  const createMutation = useCreateBundle();
  const removeMeasureMutation = useRemoveBundleMeasure();

  const [bundleCode, setBundleCode] = useState("");
  const [conditionName, setConditionName] = useState("");
  const [description, setDescription] = useState("");
  const [diseaseCategory, setDiseaseCategory] = useState("");
  const [icd10Patterns, setIcd10Patterns] = useState<string[]>([]);
  const [omopConceptIds, setOmopConceptIds] = useState<number[]>([]);
  const [ecqmReferences, setEcqmReferences] = useState<string[]>([]);
  const [newIcd10, setNewIcd10] = useState("");
  const [newOmopId, setNewOmopId] = useState("");
  const [newEcqm, setNewEcqm] = useState("");

  useEffect(() => {
    if (bundle) {
      setBundleCode(bundle.bundle_code);
      setConditionName(bundle.condition_name);
      setDescription(bundle.description ?? "");
      setDiseaseCategory(bundle.disease_category ?? "");
      setIcd10Patterns(bundle.icd10_patterns ?? []);
      setOmopConceptIds(bundle.omop_concept_ids ?? []);
      setEcqmReferences(bundle.ecqm_references ?? []);
    }
  }, [bundle]);

  const handleSave = () => {
    const payload = {
      bundle_code: bundleCode,
      condition_name: conditionName,
      description: description || undefined,
      disease_category: diseaseCategory || undefined,
      icd10_patterns: icd10Patterns,
      omop_concept_ids: omopConceptIds,
      ecqm_references: ecqmReferences.length > 0 ? ecqmReferences : undefined,
    };

    if (bundleId && bundleId > 0) {
      updateMutation.mutate({ id: bundleId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = updateMutation.isPending || createMutation.isPending;

  const addIcd10 = () => {
    const trimmed = newIcd10.trim();
    if (trimmed && !icd10Patterns.includes(trimmed)) {
      setIcd10Patterns((prev) => [...prev, trimmed]);
      setNewIcd10("");
    }
  };

  const removeIcd10 = (pattern: string) => {
    setIcd10Patterns((prev) => prev.filter((p) => p !== pattern));
  };

  const addOmopId = () => {
    const id = Number(newOmopId.trim());
    if (id > 0 && !omopConceptIds.includes(id)) {
      setOmopConceptIds((prev) => [...prev, id]);
      setNewOmopId("");
    }
  };

  const removeOmopId = (id: number) => {
    setOmopConceptIds((prev) => prev.filter((c) => c !== id));
  };

  const addEcqm = () => {
    const trimmed = newEcqm.trim();
    if (trimmed && !ecqmReferences.includes(trimmed)) {
      setEcqmReferences((prev) => [...prev, trimmed]);
      setNewEcqm("");
    }
  };

  const removeEcqm = (ref: string) => {
    setEcqmReferences((prev) => prev.filter((r) => r !== ref));
  };

  const handleRemoveMeasure = (measureId: number) => {
    if (!bundleId) return;
    removeMeasureMutation.mutate({ bundleId, measureId });
  };

  return (
    <div className="space-y-6">
      {/* Core fields */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Bundle Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bundle code */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted">
              Bundle Code
            </label>
            <input
              type="text"
              value={bundleCode}
              onChange={(e) => setBundleCode(e.target.value)}
              placeholder="e.g., DM2-BUNDLE"
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary placeholder:text-text-ghost",
                "focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>

          {/* Condition name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted">
              Condition Name
            </label>
            <input
              type="text"
              value={conditionName}
              onChange={(e) => setConditionName(e.target.value)}
              placeholder="e.g., Type 2 Diabetes Mellitus"
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary placeholder:text-text-ghost",
                "focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-muted">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the bundle..."
            rows={3}
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm resize-y",
              "text-text-primary placeholder:text-text-ghost",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          />
        </div>

        {/* Disease category */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-text-muted">
            Disease Category
          </label>
          <select
            value={diseaseCategory}
            onChange={(e) => setDiseaseCategory(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              "cursor-pointer",
            )}
          >
            <option value="">Select category...</option>
            {DISEASE_CATEGORIES.filter(Boolean).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ICD-10 patterns */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          ICD-10 Patterns
        </h3>

        <div className="flex flex-wrap gap-2">
          {icd10Patterns.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-critical/10 text-critical"
            >
              {p}
              <button
                type="button"
                onClick={() => removeIcd10(p)}
                className="hover:text-text-primary transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newIcd10}
            onChange={(e) => setNewIcd10(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIcd10();
              }
            }}
            placeholder="e.g., E11%"
            className={cn(
              "flex-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary placeholder:text-text-ghost",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          />
          <button
            type="button"
            onClick={addIcd10}
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* OMOP Concept IDs */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          OMOP Concept IDs
        </h3>

        <div className="flex flex-wrap gap-2">
          {omopConceptIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium font-['IBM_Plex_Mono',monospace] bg-success/10 text-success"
            >
              {id}
              <button
                type="button"
                onClick={() => removeOmopId(id)}
                className="hover:text-text-primary transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newOmopId}
            onChange={(e) => setNewOmopId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOmopId();
              }
            }}
            placeholder="Enter concept ID"
            className={cn(
              "flex-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary placeholder:text-text-ghost",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          />
          <button
            type="button"
            onClick={addOmopId}
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* eCQM References */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          eCQM References
        </h3>

        <div className="flex flex-wrap gap-2">
          {ecqmReferences.map((ref) => (
            <span
              key={ref}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-accent/10 text-accent"
            >
              {ref}
              <button
                type="button"
                onClick={() => removeEcqm(ref)}
                className="hover:text-text-primary transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newEcqm}
            onChange={(e) => setNewEcqm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEcqm();
              }
            }}
            placeholder="e.g., CMS122v11"
            className={cn(
              "flex-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary placeholder:text-text-ghost",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          />
          <button
            type="button"
            onClick={addEcqm}
            className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Attached measures */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Attached Measures
          </h3>
        </div>

        {(!measures || measures.length === 0) ? (
          <p className="text-xs text-text-ghost">
            No measures attached to this bundle.
          </p>
        ) : (
          <div className="space-y-1">
            {measures.map((m: QualityMeasure) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-base px-3 py-2"
              >
                <GripVertical size={14} className="text-text-ghost" />
                <span className="text-[10px] font-medium text-text-muted w-6">
                  #{m.pivot?.ordinal ?? "?"}
                </span>
                <span className="text-xs font-medium font-['IBM_Plex_Mono',monospace] text-success">
                  {m.measure_code}
                </span>
                <span className="flex-1 text-sm text-text-primary truncate">
                  {m.measure_name}
                </span>
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${getDomainColor(m.domain)}15`,
                    color: getDomainColor(m.domain),
                  }}
                >
                  {m.domain}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveMeasure(m.id)}
                  disabled={removeMeasureMutation.isPending}
                  className="text-text-muted hover:text-critical transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !bundleCode.trim() || !conditionName.trim()}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
            "bg-success text-surface-base hover:bg-success-dark",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {bundleId ? "Save Changes" : "Create Bundle"}
        </button>
      </div>
    </div>
  );
}

function getDomainColor(domain: string): string {
  const colors: Record<string, string> = {
    condition: "var(--critical)",
    drug: "var(--success)",
    procedure: "var(--accent)",
    measurement: "var(--info)",
    observation: "var(--text-muted)",
  };
  return colors[domain] ?? "var(--text-muted)";
}
