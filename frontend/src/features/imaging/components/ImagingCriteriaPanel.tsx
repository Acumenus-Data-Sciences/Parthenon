/**
 * ImagingCriteriaPanel — adds imaging filter criteria to a cohort definition.
 *
 * Supports 5 imaging criteria types following MI-CDM / OMOP imaging extension:
 * - modality: imaging modality (CT, MR, PT, US, etc.)
 * - anatomy: body part / anatomical region
 * - quantitative: measured radiomic / AI feature with numeric threshold
 * - ai_classification: AI-derived classification label with confidence threshold
 * - dose: radiation dose constraint (max Gy)
 */
import { useState } from "react";
import { ScanLine, MapPin, BarChart2, Brain, Zap, X, Check, type LucideIcon } from "lucide-react";
import type { ImagingCriterion, ImagingCriteriaType } from "../../cohort-definitions/types/cohortExpression";

const CRITERIA_TYPES: {
  value: ImagingCriteriaType;
  label: string;
  icon: LucideIcon;
  color: string;
  desc: string;
}[] = [
  { value: "modality", label: "Modality", icon: ScanLine, color: "#60A5FA", desc: "CT, MR, PT, US, CR…" },
  { value: "anatomy", label: "Anatomy / Body Part", icon: MapPin, color: "#2DD4BF", desc: "Chest, Abdomen, Brain…" },
  { value: "quantitative", label: "Quantitative Feature", icon: BarChart2, color: "#A78BFA", desc: "Radiomic or AI numeric measurement" },
  { value: "ai_classification", label: "AI Classification", icon: Brain, color: "#F59E0B", desc: "AI-derived label with confidence" },
  { value: "dose", label: "Radiation Dose", icon: Zap, color: "#E85A6B", desc: "Maximum cumulative dose (Gy)" },
];

const COMMON_MODALITIES = ["CT", "MR", "PT", "US", "CR", "DX", "MG", "XA", "NM", "RF"];

const COMMON_BODY_PARTS = [
  "CHEST", "ABDOMEN", "BRAIN", "PELVIS", "SPINE", "HEAD", "NECK",
  "EXTREMITY", "BREAST", "HEART", "LUNG", "LIVER", "KIDNEY",
];

const NUMERIC_OPS: { value: ImagingCriterion["operator"]; label: string }[] = [
  { value: "gte", label: "≥" },
  { value: "gt", label: ">" },
  { value: "lte", label: "≤" },
  { value: "lt", label: "<" },
  { value: "eq", label: "=" },
];

interface Props {
  onAdd: (criterion: ImagingCriterion) => void;
  onCancel: () => void;
}

export function ImagingCriteriaPanel({ onAdd, onCancel }: Props) {
  const [type, setType] = useState<ImagingCriteriaType | null>(null);
  const [exclude, setExclude] = useState(false);

  const [modality, setModality] = useState("CT");
  const [bodyPart, setBodyPart] = useState("CHEST");
  const [featureName, setFeatureName] = useState("");
  const [operator, setOperator] = useState<ImagingCriterion["operator"]>("gte");
  const [value, setValue] = useState<number>(0);
  const [unit, setUnit] = useState("HU");
  const [classLabel, setClassLabel] = useState("");
  const [minConfidence, setMinConfidence] = useState(0.8);
  const [maxDoseGy, setMaxDoseGy] = useState(50);

  const canAdd = () => {
    switch (type) {
      case "modality": return modality !== "";
      case "anatomy": return bodyPart !== "";
      case "quantitative": return featureName.trim() !== "";
      case "ai_classification": return classLabel.trim() !== "";
      case "dose": return maxDoseGy > 0;
      default: return false;
    }
  };

  const buildLabel = (): string => {
    const opLabel = NUMERIC_OPS.find((o) => o.value === operator)?.label ?? "≥";
    switch (type) {
      case "modality": return `Modality: ${modality}`;
      case "anatomy": return `Body part: ${bodyPart}`;
      case "quantitative": return `${featureName} ${opLabel} ${value} ${unit}`;
      case "ai_classification": return `AI: ${classLabel} (≥${Math.round(minConfidence * 100)}% confidence)`;
      case "dose": return `Dose ≤ ${maxDoseGy} Gy`;
      default: return "";
    }
  };

  const handleAdd = () => {
    if (!type || !canAdd()) return;
    const criterion: ImagingCriterion = {
      type,
      label: (exclude ? "Exclude: " : "") + buildLabel(),
      exclude,
      ...(type === "modality" && { modality }),
      ...(type === "anatomy" && { bodyPart }),
      ...(type === "quantitative" && { featureName, operator, value, unit }),
      ...(type === "ai_classification" && { classificationLabel: classLabel, minConfidence }),
      ...(type === "dose" && { maxDoseGy }),
    };
    onAdd(criterion);
  };

  const inputCls =
    "w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-2 py-1.5 text-xs text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors";
  const selectCls =
    "rounded-lg bg-[#0E0E11] border border-[#232328] px-2 py-1.5 text-xs text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF] transition-colors";

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-1.5">
          <ScanLine size={14} className="text-[#60A5FA]" />
          Add Imaging Criterion
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-[#5A5650] hover:text-[#8A857D] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Type selection */}
      <div className="grid grid-cols-2 gap-2">
        {CRITERIA_TYPES.map((ct) => {
          const Icon = ct.icon;
          return (
            <button
              key={ct.value}
              type="button"
              onClick={() => setType(ct.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-colors ${
                type === ct.value
                  ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#2A2A30]"
              }`}
            >
              <Icon size={13} style={{ color: ct.color }} />
              <div>
                <div className="font-medium">{ct.label}</div>
                <div className="text-[#5A5650] text-[10px] mt-0.5">{ct.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modality */}
      {type === "modality" && (
        <div>
          <label className="block text-[10px] text-[#8A857D] mb-1.5 uppercase tracking-wider">
            Modality *
          </label>
          <div className="flex flex-wrap gap-1 mb-2">
            {COMMON_MODALITIES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModality(m)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  modality === m
                    ? "bg-[#2DD4BF]/20 border border-[#2DD4BF]/40 text-[#2DD4BF]"
                    : "bg-[#0E0E11] border border-[#232328] text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#2A2A30]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            className={inputCls}
            placeholder="Or type custom modality…"
            value={COMMON_MODALITIES.includes(modality) ? "" : modality}
            onChange={(e) => setModality(e.target.value.toUpperCase())}
          />
        </div>
      )}

      {/* Anatomy */}
      {type === "anatomy" && (
        <div>
          <label className="block text-[10px] text-[#8A857D] mb-1.5 uppercase tracking-wider">
            Body Part *
          </label>
          <div className="flex flex-wrap gap-1 mb-2">
            {COMMON_BODY_PARTS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBodyPart(b)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  bodyPart === b
                    ? "bg-[#2DD4BF]/20 border border-[#2DD4BF]/40 text-[#2DD4BF]"
                    : "bg-[#0E0E11] border border-[#232328] text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#2A2A30]"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <input
            className={inputCls}
            placeholder="Or type custom body part…"
            value={COMMON_BODY_PARTS.includes(bodyPart) ? "" : bodyPart}
            onChange={(e) => setBodyPart(e.target.value.toUpperCase())}
          />
        </div>
      )}

      {/* Quantitative */}
      {type === "quantitative" && (
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-[#8A857D] mb-1.5 uppercase tracking-wider">
              Feature name *
            </label>
            <input
              className={inputCls}
              placeholder="e.g. mean_HU, nodule_diameter, SUVmax"
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className={selectCls}
              value={operator}
              onChange={(e) => setOperator(e.target.value as ImagingCriterion["operator"])}
            >
              {NUMERIC_OPS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              className="w-24 rounded-lg bg-[#0E0E11] border border-[#232328] px-2 py-1.5 text-xs text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF] transition-colors"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
            <input
              className="w-20 rounded-lg bg-[#0E0E11] border border-[#232328] px-2 py-1.5 text-xs text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] transition-colors"
              placeholder="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* AI Classification */}
      {type === "ai_classification" && (
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-[#8A857D] mb-1.5 uppercase tracking-wider">
              Classification label *
            </label>
            <input
              className={inputCls}
              placeholder="e.g. pulmonary nodule, malignant, suspicious"
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#8A857D]">Min confidence</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="flex-1 accent-[#2DD4BF]"
            />
            <span className="text-xs text-[#C5C0B8] w-10 text-right font-mono">
              {Math.round(minConfidence * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Dose */}
      {type === "dose" && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8A857D]">Max cumulative dose</span>
          <input
            type="number"
            className="w-24 rounded-lg bg-[#0E0E11] border border-[#232328] px-2 py-1.5 text-xs text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF] transition-colors"
            value={maxDoseGy}
            onChange={(e) => setMaxDoseGy(Number(e.target.value))}
          />
          <span className="text-xs text-[#5A5650]">Gy</span>
        </div>
      )}

      {/* Exclude toggle + add */}
      {type && (
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={exclude}
              onChange={(e) => setExclude(e.target.checked)}
              className="rounded border-[#232328] bg-[#0E0E11] text-[#E85A6B] focus:ring-[#E85A6B]/40"
            />
            <span className="text-xs text-[#8A857D]">Exclude patients with this feature</span>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2DD4BF] text-[#0E0E11] text-xs font-medium hover:bg-[#26B8A5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={12} />
            Add Criterion
          </button>
        </div>
      )}
    </div>
  );
}
