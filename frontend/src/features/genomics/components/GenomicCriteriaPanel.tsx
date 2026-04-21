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
import { useTranslation } from "react-i18next";
import { Dna, FlaskConical, Zap, Blend, ShieldAlert, Pill, X, Check, type LucideIcon } from "lucide-react";
import type { GenomicCriterion, GenomicCriteriaType } from "../../cohort-definitions/types/cohortExpression";

const CRITERIA_TYPES: { value: GenomicCriteriaType; icon: LucideIcon; color: string }[] = [
  { value: "gene_mutation", icon: Dna, color: "var(--domain-observation)" },
  { value: "tmb", icon: FlaskConical, color: "var(--success)" },
  { value: "msi", icon: Zap, color: "var(--warning)" },
  { value: "fusion", icon: Blend, color: "var(--info)" },
  { value: "pathogenicity", icon: ShieldAlert, color: "var(--critical)" },
  { value: "treatment_episode", icon: Pill, color: "var(--domain-device)" },
];

const MSI_OPTIONS = [
  { value: "MSI-H", labelKey: "high" },
  { value: "any_unstable", labelKey: "anyUnstable" },
  { value: "MSI-L", labelKey: "low" },
  { value: "MSS", labelKey: "stable" },
] as const;

const CLINVAR_CLASSES = ["Pathogenic", "Likely pathogenic", "Uncertain significance"] as const;

interface Props {
  onAdd: (criterion: GenomicCriterion) => void;
  onCancel: () => void;
}

export function GenomicCriteriaPanel({ onAdd, onCancel }: Props) {
  const { t } = useTranslation("app");
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
        return hgvs ? `${gene} ${hgvs}` : t("genomics.criteriaPanel.labelTemplates.mutation", { gene });
      case "tmb":
        return t("genomics.criteriaPanel.labelTemplates.tmb", {
          operator: tmbOp === "gte" ? "≥" : tmbOp === "gt" ? ">" : tmbOp === "lte" ? "≤" : "<",
          value: tmbValue,
        });
      case "msi":
        return t(
          `genomics.criteriaPanel.msiOptions.${MSI_OPTIONS.find((o) => o.value === msiStatus)?.labelKey ?? "high"}`,
        );
      case "fusion":
        return gene2
          ? t("genomics.criteriaPanel.labelTemplates.fusion", { gene1, gene2 })
          : t("genomics.criteriaPanel.labelTemplates.rearrangement", { gene: gene1 });
      case "pathogenicity":
        return clinvarClasses.join(" / ");
      case "treatment_episode":
        return t("genomics.criteriaPanel.labelTemplates.regimen", { name: regimenName });
      default:
        return "";
    }
  };

  const handleAdd = () => {
    if (!type || !canAdd()) return;
    const criterion: GenomicCriterion = {
      type,
      label: `${exclude ? t("genomics.criteriaPanel.labelTemplates.excludePrefix") : ""}${buildLabel()}`,
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
          {t("genomics.criteriaPanel.title")}
        </h4>
        <button onClick={onCancel} className="text-text-ghost hover:text-text-secondary">
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
                <div className="font-medium">
                  {t(
                    `genomics.criteriaPanel.typeLabels.${
                      ct.value === "gene_mutation"
                        ? "geneMutation"
                        : ct.value === "treatment_episode"
                          ? "treatmentEpisode"
                          : ct.value
                    }`,
                  )}
                </div>
                <div className="text-text-ghost text-[10px]">
                  {t(
                    `genomics.criteriaPanel.typeDescriptions.${
                      ct.value === "gene_mutation"
                        ? "geneMutation"
                        : ct.value === "treatment_episode"
                          ? "treatmentEpisode"
                          : ct.value
                    }`,
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Type-specific fields */}
      {type === "gene_mutation" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-text-ghost mb-1 uppercase tracking-wider">{t("genomics.criteriaPanel.gene")}</label>
            <input
              value={gene}
              onChange={(e) => setGene(e.target.value.toUpperCase())}
              placeholder="EGFR"
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-ghost focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-ghost mb-1 uppercase tracking-wider">{t("genomics.criteriaPanel.hgvsOptional")}</label>
            <input
              value={hgvs}
              onChange={(e) => setHgvs(e.target.value)}
              placeholder={t("genomics.criteriaPanel.hgvsPlaceholder")}
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-ghost focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {type === "tmb" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">TMB</span>
          <select
            value={tmbOp}
            onChange={(e) => setTmbOp(e.target.value as typeof tmbOp)}
            className="bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
          >
            <option value="gte">{"\u2265"}</option>
            <option value="gt">{"\u003E"}</option>
            <option value="lte">{"\u2264"}</option>
            <option value="lt">{"\u003C"}</option>
          </select>
          <input
            type="number"
            value={tmbValue}
            onChange={(e) => setTmbValue(Number(e.target.value))}
            className="w-20 bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
          />
          <span className="text-xs text-text-ghost">{t("genomics.criteriaPanel.tmbUnit")}</span>
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
                  : "border-border-default text-text-ghost hover:text-text-secondary"
              }`}
            >
              {t(`genomics.criteriaPanel.msiOptions.${opt.labelKey}`)}
            </button>
          ))}
        </div>
      )}

      {type === "fusion" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-text-ghost mb-1 uppercase tracking-wider">{t("genomics.criteriaPanel.gene1")}</label>
            <input
              value={gene1}
              onChange={(e) => setGene1(e.target.value.toUpperCase())}
              placeholder="ALK"
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-ghost focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-ghost mb-1 uppercase tracking-wider">{t("genomics.criteriaPanel.gene2Optional")}</label>
            <input
              value={gene2}
              onChange={(e) => setGene2(e.target.value.toUpperCase())}
              placeholder="EML4"
              className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-ghost focus:outline-none focus:border-purple-500"
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
              <span className="text-xs text-text-muted">
                {cls === "Pathogenic"
                  ? t("genomics.common.pathogenic")
                  : cls === "Likely pathogenic"
                    ? t("genomics.common.likelyPathogenic")
                    : t("genomics.common.uncertainSignificance")}
              </span>
            </label>
          ))}
        </div>
      )}

      {type === "treatment_episode" && (
        <div>
          <label className="block text-[10px] text-text-ghost mb-1 uppercase tracking-wider">{t("genomics.criteriaPanel.regimenName")}</label>
          <input
            value={regimenName}
            onChange={(e) => setRegimenName(e.target.value)}
            placeholder="osimertinib"
            className="w-full bg-surface-base border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-ghost focus:outline-none focus:border-purple-500"
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
            <span className="text-xs text-text-muted">{t("genomics.criteriaPanel.excludeFeature")}</span>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Check size={12} />
            {t("genomics.criteriaPanel.addCriterion")}
          </button>
        </div>
      )}
    </div>
  );
}
