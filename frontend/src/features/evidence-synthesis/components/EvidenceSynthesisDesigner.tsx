import { useMemo, useState } from "react";
import { Loader2, Save, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type {
  EvidenceSynthesisDesign,
  EvidenceSynthesisAnalysis,
  SiteEstimate,
} from "../types/evidenceSynthesis";
import {
  useCreateEvidenceSynthesis,
  useUpdateEvidenceSynthesis,
} from "../hooks/useEvidenceSynthesis";

function createDefaultEstimate(): SiteEstimate {
  return {
    logRr: 0,
    seLogRr: 0.1,
    siteName: "",
  };
}

function createDefaultDesign(
  t: (key: string, options?: Record<string, unknown>) => string,
): EvidenceSynthesisDesign {
  return {
    estimates: [
      {
        logRr: -0.3,
        seLogRr: 0.15,
        siteName: t("analyses.auto.siteLabel_d9e964", { index: 1 }),
      },
      {
        logRr: -0.1,
        seLogRr: 0.2,
        siteName: t("analyses.auto.siteLabel_d9e964", { index: 2 }),
      },
    ],
    method: "bayesian",
  };
}

interface EvidenceSynthesisDesignerProps {
  analysis?: EvidenceSynthesisAnalysis | null;
  isNew?: boolean;
  onSaved?: (a: EvidenceSynthesisAnalysis) => void;
}

function getInitialEvidenceSynthesisDesign(
  analysis: EvidenceSynthesisAnalysis | null | undefined,
  defaultDesign: EvidenceSynthesisDesign,
): EvidenceSynthesisDesign {
  return analysis?.design_json ?? defaultDesign;
}

export function EvidenceSynthesisDesigner({
  analysis,
  isNew,
  onSaved,
}: EvidenceSynthesisDesignerProps) {
  const { t } = useTranslation("app");
  const defaultDesign = useMemo(() => createDefaultDesign(t), [t]);
  const initialDesign = useMemo(
    () => getInitialEvidenceSynthesisDesign(analysis, defaultDesign),
    [analysis, defaultDesign],
  );
  const [name, setName] = useState(() => analysis?.name ?? "");
  const [description, setDescription] = useState(
    () => analysis?.description ?? "",
  );
  const [design, setDesign] = useState<EvidenceSynthesisDesign>(
    () => initialDesign,
  );

  const createMutation = useCreateEvidenceSynthesis();
  const updateMutation = useUpdateEvidenceSynthesis();

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !analysis) {
      createMutation.mutate(
        { name: name.trim(), description: description.trim() || undefined, design_json: design },
        { onSuccess: (a) => onSaved?.(a) },
      );
    } else {
      updateMutation.mutate(
        { id: analysis.id, payload: { name: name.trim(), description: description.trim(), design_json: design } },
        { onSuccess: (a) => onSaved?.(a) },
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const addEstimate = () => {
      setDesign((d) => ({
        ...d,
        estimates: [
          ...d.estimates,
          {
            ...createDefaultEstimate(),
            siteName: t("analyses.auto.siteLabel_d9e964", {
              index: d.estimates.length + 1,
            }),
          },
        ],
    }));
  };

  const removeEstimate = (idx: number) => {
    setDesign((d) => ({
      ...d,
      estimates: d.estimates.filter((_, i) => i !== idx),
    }));
  };

  const updateEstimate = (idx: number, updates: Partial<SiteEstimate>) => {
    setDesign((d) => ({
      ...d,
      estimates: d.estimates.map((e, i) => (i === idx ? { ...e, ...updates } : e)),
    }));
  };

  const inputCls = cn(
    "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
    "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
  );

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.basicInformation_87cabb")}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">{t("analyses.auto.name_49ee30")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("analyses.auto.evidenceSynthesisName_a137dc")}
              className={cn(inputCls, "placeholder:text-text-ghost")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">{t("analyses.auto.description_b5a7ad")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("analyses.auto.optionalDescription_d196d2")}
              rows={2}
              className={cn(inputCls, "placeholder:text-text-ghost resize-none")}
            />
          </div>
        </div>
      </div>

      {/* Method */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.metaAnalysisMethod_c7ddd9")}</h3>
        <select
          value={design?.method ?? "bayesian"}
          onChange={(e) => setDesign((d) => ({ ...d, method: e.target.value as "bayesian" | "fixed" }))}
          className={inputCls}
        >
          <option value="bayesian">{t("analyses.auto.bayesianRandomEffects_8a5277")}</option>
          <option value="fixed">{t("analyses.auto.fixedEffectInverseVariance_0b01ce")}</option>
        </select>

        {(design?.method ?? "bayesian") === "bayesian" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-[10px] text-text-ghost mb-1">{t("analyses.auto.chainLength_53facb")}</label>
              <input
                type="number"
                value={design.chainLength ?? 1100000}
                onChange={(e) => setDesign((d) => ({ ...d, chainLength: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-ghost mb-1">{t("analyses.auto.burnIn_0127e6")}</label>
              <input
                type="number"
                value={design.burnIn ?? 100000}
                onChange={(e) => setDesign((d) => ({ ...d, burnIn: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-ghost mb-1">{t("analyses.auto.subSample_0e7748")}</label>
              <input
                type="number"
                value={design.subSample ?? 100}
                onChange={(e) => setDesign((d) => ({ ...d, subSample: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      {/* Site Estimates */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.siteEstimates_be62dd")}</h3>
          <button
            type="button"
            onClick={addEstimate}
            className="inline-flex items-center gap-1 text-xs text-success hover:text-success-dark transition-colors"
          >
            <Plus size={12} /> {t("analyses.auto.addSite_6f8bb1")}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {t("analyses.auto.enterLogRRAndSELogRRFromEachSiteDatabaseMinimum2Sites_58d262")}
        </p>

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_120px_32px] gap-2 px-1">
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">{t("analyses.auto.siteName_668445")}</span>
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">{t("analyses.auto.logRR_53d74d")}</span>
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">{t("analyses.auto.sELogRR_0e2ef8")}</span>
            <span />
          </div>

          {(design?.estimates ?? []).map((est, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_120px_120px_32px] gap-2 items-center">
              <input
                type="text"
                value={est.siteName}
                onChange={(e) => updateEstimate(idx, { siteName: e.target.value })}
                placeholder={t("analyses.auto.siteLabel_d9e964", {
                  index: idx + 1,
                })}
                className={cn(inputCls, "placeholder:text-text-ghost")}
              />
              <input
                type="number"
                step="0.01"
                value={est.logRr}
                onChange={(e) => updateEstimate(idx, { logRr: Number(e.target.value) })}
                className={inputCls}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={est.seLogRr}
                onChange={(e) => updateEstimate(idx, { seLogRr: Number(e.target.value) })}
                className={inputCls}
              />
              {(design?.estimates?.length ?? 0) > 2 ? (
                <button
                  type="button"
                  onClick={() => removeEstimate(idx)}
                  className="text-text-muted hover:text-critical transition-colors flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>

        {/* Preview HRs */}
        <div className="mt-3 pt-3 border-t border-border-default">
          <p className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mb-2">
            {t("analyses.auto.hRPreviewExpLogRR_05d373")}
          </p>
          <div className="flex flex-wrap gap-2">
            {(design?.estimates ?? []).map((est, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-text-secondary"
              >
                {est.siteName ||
                  t("analyses.auto.siteLabel_d9e964", { index: idx + 1 })}
                : {Math.exp(est.logRr).toFixed(3)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !(name ?? "").trim() || (design?.estimates?.length ?? 0) < 2}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isNew ? t("analyses.auto.create_686e69") : t("analyses.auto.saveChanges_f5d604")}
        </button>
      </div>
    </div>
  );
}
