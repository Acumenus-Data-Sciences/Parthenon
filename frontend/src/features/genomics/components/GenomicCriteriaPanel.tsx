/**
 * GenomicCriteriaPanel — adds molecular filter criteria to a cohort definition.
 *
 * Supports 6 genomic criteria types following OMOP Oncology Extension conventions:
 * - gene_mutation: specific variant (gene + optional HGVS)
 * - tmb: Tumor Mutational Burden threshold
 * - msi: Microsatellite Instability status
 * - fusion: gene fusion (gene1::gene2)
 * - pathogenicity: ClinVar classification filter
 * - treatment_episode: HemOnc chemotherapy regimen (maps to EPISODE table)
 */
import { useState } from "react";
import { Dna, FlaskConical, Zap, Blend, ShieldAlert, Pill, X, Check, type LucideIcon } from "lucide-react";
import type { GenomicCriterion, GenomicCriteriaType } from "../../cohort-definitions/types/cohortExpression";

const CRITERIA_TYPES: { value: GenomicCriteriaType; label: string; icon: LucideIcon; color: string; desc: string }[] = [
  { value: "gene_mutation", label: "Gene Mutation", icon: Dna, color: "var(--domain-observation)", desc: "e.g. EGFR L858R, KRAS G12D" },
  { value: "tmb", label: "Tumor Mutational Burden", icon: FlaskConical, color: "var(--success)", desc: "TMB-High / TMB-Low threshold" },
  { value: "msi", label: "Microsatellite Instability", icon: Zap, color: "#F59E0B", desc: "MSI-H, MSI-L, or MSS" },
  { value: "fusion", label: "Gene Fusion", icon: Blend, color: "var(--info)", desc: "e.g. ALK rearrangement, BCR-ABL1" },
  { value: "pathogenicity", label: "Pathogenicity Class", icon: ShieldAlert, color: "var(--critical)", desc: "ClinVar classification" },
  { value: "treatment_episode", label: "Treatment Episode", icon: Pill, color: "#FB923C", desc: "HemOnc chemotherapy regimen" },
];

const MSI_OPTIONS = [
  { value: "MSI-H", label: "MSI-High" },
  { value: "any_unstable", label: "MSI-High or MSI-Low (any unstable)" },
  { value: "MSI-L", label: "MSI-Low" },
  { value: "MSS", label: "Microsatellite Stable (MSS)" },
] as const;

const CLINVAR_CLASSES = ["Pathogenic", "Likely pathogenic", "Uncertain significance"] as const;

interface Props {
  onAdd: (criterion: GenomicCriterion) => void;
  onCancel: () => void;
}

export function GenomicCriteriaPanel({ onAdd, onCancel }: Props) {
  const [type, setType] = useState<GenomicCriteriaType | null>(null);
  const [exclude, setExclude] = useState(false);

  // gene_mutation fields
  const [gene, setGene] = useState("");
  const [hgvs, setHgvs] = useState("");

  // tmb fields
  const [tmbOp, setTmbOp] = useState<"gt" | "gte" | "lt" | "lte">("gte");
  const [tmbValue, setTmbValue] = useState(10);

  // msi fields
  const [msiStatus, setMsiStatus] = useState<typeof MSI_OPTIONS[number]["value"]>("MSI-H");

  // fusion fields
  const [gene1, setGene1] = useState("");
  const [gene2, setGene2] = useState("");

  // pathogenicity fields
  const [clinvarClasses, setClinvarClasses] = useState<string[]>(["Pathogenic", "Likely pathogenic"]);

  // treatment_episode fields
  const [regimenName, setRegimenName] = useState("");

  const canAdd = () => {
    switch (type) {
      case "gene_mutation": return gene.trim() !== "";
      case "tmb": return tmbValue > 0;
      case "msi": return true;
      case "fusion": return gene1.trim() !== "";
      case "pathogenicity": return clinvarClasses.length > 0;
      case "treatment_episode": return regimenName.trim() !== "";
      default: return false;
    }
  };

  const buildLabel = (): string => {
    switch (type) {
      case "gene_mutation":
        return hgvs ? `${gene} ${hgvs}` : `${gene} mutation`;
      case "tmb":
        return `TMB ${tmbOp === "gte" ? "≥" : tmbOp === "gt" ? ">" : tmbOp === "lte" ? "≤" : "<"} ${tmbValue} mut/Mb`;
      case "msi":
        return MSI_OPTIONS.find((o) => o.value === msiStatus)?.label ?? msiStatus;
      case "fusion":
        return gene2 ? `${gene1}::${gene2} fusion` : `${gene1} rearrangement`;
      case "pathogenicity":
        return clinvarClasses.join(" / ");
      case "treatment_episode":
        return `${regimenName} regimen`;
      default:
        return "";
    }
  };

  const handleAdd = () => {
    if (!type || !canAdd()) return;
    const criterion: GenomicCriterion = {
      type,
      label: (exclude ? "Exclude: " : "") + buildLabel(),
      exclude,
      ...(type === "gene_mutation" && { gene, hgvs: hgvs || undefined }),
      ...(type === "tmb" && { tmbOperator: tmbOp, tmbValue, tmbUnit: "mut/Mb" }),
      ...(type === "msi" && { msiStatus }),
      ...(type === "fusion" && { gene1, gene2: gene2 || undefined }),
      ...(type === "pathogenicity" && { clinvarClasses: clinvarClasses as GenomicCriterion["clinvarClasses"] }),
    };
    onAdd(criterion);
  };

  return (
    <div className="rounded-lg border border-purple-700/40 bg-surface-overlay p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-1.5">
          <Dna size={14} />
          Add Genomic Criterion
        </h4>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300">
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
                  ? "border-purple-500/40 bg-purple-900/20 text-purple-200"
                  : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary"
              }`}
            >
              <Icon size={13} style={{ color: ct.color }} />
              <div>
                <div className="font-medium">{ct.label}</div>
                <div className="text-gray-600 text-[10px]">{ct.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Type-specific fields */}
      {type === "gene_mutation" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Gene *</label>
            <input
              value={gene}
              onChange={(e) => setGene(e.target.value.toUpperCase())}
              placeholder="EGFR"
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">HGVS (optional)</label>
            <input
              value={hgvs}
              onChange={(e) => setHgvs(e.target.value)}
              placeholder="p.Leu858Arg"
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {type === "tmb" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">TMB</span>
          <select
            value={tmbOp}
            onChange={(e) => setTmbOp(e.target.value as typeof tmbOp)}
            className="bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
          >
            <option value="gte">≥</option>
            <option value="gt">&gt;</option>
            <option value="lte">≤</option>
            <option value="lt">&lt;</option>
          </select>
          <input
            type="number"
            value={tmbValue}
            onChange={(e) => setTmbValue(Number(e.target.value))}
            className="w-20 bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
          />
          <span className="text-xs text-gray-500">mut/Mb</span>
        </div>
      )}

      {type === "msi" && (
        <div className="grid grid-cols-2 gap-2">
          {MSI_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMsiStatus(opt.value)}
              className={`px-3 py-2 rounded-lg border text-xs transition-colors ${
                msiStatus === opt.value
                  ? "border-yellow-600/40 bg-yellow-900/20 text-yellow-200"
                  : "border-border-default text-gray-500 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {type === "fusion" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Gene 1 *</label>
            <input
              value={gene1}
              onChange={(e) => setGene1(e.target.value.toUpperCase())}
              placeholder="ALK"
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Gene 2 (optional)</label>
            <input
              value={gene2}
              onChange={(e) => setGene2(e.target.value.toUpperCase())}
              placeholder="EML4"
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {type === "pathogenicity" && (
        <div className="space-y-1">
          {CLINVAR_CLASSES.map((cls) => (
            <label key={cls} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={clinvarClasses.includes(cls)}
                onChange={(e) =>
                  setClinvarClasses((prev) =>
                    e.target.checked ? [...prev, cls] : prev.filter((c) => c !== cls)
                  )
                }
                className="rounded border-border-default bg-surface-base text-purple-500 focus:ring-purple-500/40"
              />
              <span className="text-xs text-gray-400">{cls}</span>
            </label>
          ))}
        </div>
      )}

      {type === "treatment_episode" && (
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Regimen name *</label>
          <input
            value={regimenName}
            onChange={(e) => setRegimenName(e.target.value)}
            placeholder="osimertinib"
            className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
          />
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
              className="rounded border-border-default bg-surface-base text-red-500 focus:ring-red-500/40"
            />
            <span className="text-xs text-gray-400">Exclude patients with this feature</span>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Check size={12} />
            Add Criterion
          </button>
        </div>
      )}
    </div>
  );
}
