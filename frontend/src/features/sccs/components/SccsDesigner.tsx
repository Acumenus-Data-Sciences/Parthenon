import { useMemo, useState } from "react";
import { Loader2, Save, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import { CovariateSettingsPanel } from "@/components/analysis/CovariateSettingsPanel";
import type { SccsDesign, SccsAnalysis, RiskWindow } from "../types/sccs";
import { useCreateSccs, useUpdateSccs } from "../hooks/useSccs";

function createDefaultRiskWindow(
  t: (key: string, options?: Record<string, unknown>) => string,
  count: number,
): RiskWindow {
  return {
    start: 0,
    end: 30,
    startAnchor: "era_start",
    endAnchor: "era_start",
    label: t("analyses.auto.riskWindow_4cbfa4", { count }),
  };
}

function createDefaultDesign(
  t: (key: string, options?: Record<string, unknown>) => string,
): SccsDesign {
  return {
    exposureCohortId: 0,
    outcomeCohortId: 0,
    riskWindows: [createDefaultRiskWindow(t, 1)],
    model: { type: "simple" },
    studyPopulation: {
      naivePeriod: 365,
      firstOutcomeOnly: true,
    },
    covariateSettings: {
      useDemographics: false,
      useConditionOccurrence: true,
      useDrugExposure: true,
      useProcedureOccurrence: false,
      useMeasurement: false,
      timeWindows: [{ start: -365, end: 0 }],
    },
  };
}

interface SccsDesignerProps {
  sccs?: SccsAnalysis | null;
  isNew?: boolean;
  onSaved?: (s: SccsAnalysis) => void;
}

function getInitialSccsDesign(
  sccs: SccsAnalysis | null | undefined,
  defaultDesign: SccsDesign,
): SccsDesign {
  if (!sccs) return defaultDesign;
  const dj = (sccs.design_json ?? {}) as unknown as Record<string, unknown>;
  const studyPop = (
    dj.studyPopulation ??
    dj.studyPopulationSettings ??
    defaultDesign.studyPopulation
  ) as Record<string, unknown>;

  return {
    ...defaultDesign,
    ...(sccs.design_json ?? {}),
    studyPopulation: {
      naivePeriod: (studyPop?.naivePeriod ?? studyPop?.naive_period ?? 365) as number,
      firstOutcomeOnly: (studyPop?.firstOutcomeOnly ?? studyPop?.first_outcome_only ?? true) as boolean,
    },
    riskWindows: (
      dj.riskWindows ??
      dj.risk_windows ??
      defaultDesign.riskWindows
    ) as SccsDesign["riskWindows"],
  };
}

export function SccsDesigner({ sccs, isNew, onSaved }: SccsDesignerProps) {
  const { t } = useTranslation("app");
  const defaultDesign = useMemo(() => createDefaultDesign(t), [t]);
  const initialDesign = useMemo(
    () => getInitialSccsDesign(sccs, defaultDesign),
    [sccs, defaultDesign],
  );
  const [name, setName] = useState(() => sccs?.name ?? "");
  const [description, setDescription] = useState(
    () => sccs?.description ?? "",
  );
  const [design, setDesign] = useState<SccsDesign>(() => initialDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreateSccs();
  const updateMutation = useUpdateSccs();

  const cohorts = cohortData?.items ?? [];

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !sccs) {
      createMutation.mutate(
        { name: name.trim(), description: description.trim() || undefined, design_json: design },
        { onSuccess: (s) => onSaved?.(s) },
      );
    } else {
      updateMutation.mutate(
        { id: sccs.id, payload: { name: name.trim(), description: description.trim(), design_json: design } },
        { onSuccess: (s) => onSaved?.(s) },
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const addRiskWindow = () => {
    setDesign((d) => ({
        ...d,
        riskWindows: [
          ...d.riskWindows,
          createDefaultRiskWindow(t, d.riskWindows.length + 1),
        ],
      }));
  };

  const removeRiskWindow = (idx: number) => {
    setDesign((d) => ({
      ...d,
      riskWindows: d.riskWindows.filter((_, i) => i !== idx),
    }));
  };

  const updateRiskWindow = (idx: number, updates: Partial<RiskWindow>) => {
    setDesign((d) => ({
      ...d,
      riskWindows: d.riskWindows.map((w, i) => (i === idx ? { ...w, ...updates } : w)),
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
              placeholder={t("analyses.auto.sCCSAnalysisName_365367")}
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

      {/* Exposure Cohort */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.exposureCohort_1d913c")}</h3>
        <p className="text-xs text-text-muted">{t("analyses.auto.selectTheDrugExposureCohortEachPatientServesAsTheirOwnControl_ec7c52")}</p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <select
            value={design.exposureCohortId || ""}
            onChange={(e) => setDesign((d) => ({ ...d, exposureCohortId: Number(e.target.value) || 0 }))}
            className={inputCls}
          >
            <option value="">{t("analyses.auto.selectExposureCohort_1ed618")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Outcome Cohort */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.outcomeCohort_b279fb")}</h3>
        <p className="text-xs text-text-muted">{t("analyses.auto.selectTheAdverseEventOutcomeToStudy_1dcc09")}</p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <select
            value={design.outcomeCohortId || ""}
            onChange={(e) => setDesign((d) => ({ ...d, outcomeCohortId: Number(e.target.value) || 0 }))}
            className={inputCls}
          >
            <option value="">{t("analyses.auto.selectOutcomeCohort_9a111f")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Risk Windows */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.riskWindows_09ce14")}</h3>
          <button
            type="button"
            onClick={addRiskWindow}
            className="inline-flex items-center gap-1 text-xs text-success hover:text-success-dark transition-colors"
          >
            <Plus size={12} /> {t("analyses.auto.addWindow_6251f7")}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {t("analyses.auto.defineTimeWindowsRelativeToTheExposureEraWhereTheOutcomeRiskIsAssessed_1c5b18")}
        </p>
        {design.riskWindows.map((rw, idx) => (
          <div key={idx} className="rounded-lg border border-border-default bg-surface-base p-3 space-y-3">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={rw.label}
                onChange={(e) => updateRiskWindow(idx, { label: e.target.value })}
                className="bg-transparent text-sm text-text-primary font-medium focus:outline-none border-b border-transparent focus:border-accent transition-colors"
              />
              {design.riskWindows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRiskWindow(idx)}
                  className="text-text-muted hover:text-critical transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-text-ghost mb-1">{t("analyses.auto.startDay_3e588e")}</label>
                <input
                  type="number"
                  value={rw.start}
                  onChange={(e) => updateRiskWindow(idx, { start: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-ghost mb-1">{t("analyses.auto.startAnchor_084f3b")}</label>
                <select
                  value={rw.startAnchor}
                  onChange={(e) => updateRiskWindow(idx, { startAnchor: e.target.value as "era_start" | "era_end" })}
                  className={inputCls}
                >
                  <option value="era_start">{t("analyses.auto.eraStart_e33d7b")}</option>
                  <option value="era_end">{t("analyses.auto.eraEnd_3c1837")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-ghost mb-1">{t("analyses.auto.endDay_95f661")}</label>
                <input
                  type="number"
                  value={rw.end}
                  onChange={(e) => updateRiskWindow(idx, { end: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-ghost mb-1">{t("analyses.auto.endAnchor_cabfb2")}</label>
                <select
                  value={rw.endAnchor}
                  onChange={(e) => updateRiskWindow(idx, { endAnchor: e.target.value as "era_start" | "era_end" })}
                  className={inputCls}
                >
                  <option value="era_start">{t("analyses.auto.eraStart_e33d7b")}</option>
                  <option value="era_end">{t("analyses.auto.eraEnd_3c1837")}</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Model & Population Settings */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.modelPopulation_0ba724")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">{t("analyses.auto.modelType_e2716f")}</label>
            <select
              value={design.model.type}
              onChange={(e) => setDesign((d) => ({ ...d, model: { ...d.model, type: e.target.value as SccsDesign["model"]["type"] } }))}
              className={inputCls}
            >
              <option value="simple">{t("analyses.auto.simpleNoAdjustments_a92a57")}</option>
              <option value="age_adjusted">{t("analyses.auto.ageAdjusted_f91311")}</option>
              <option value="season_adjusted">{t("analyses.auto.seasonAdjusted_eda83a")}</option>
              <option value="age_season_adjusted">{t("analyses.auto.ageSeasonAdjusted_e098ef")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">{t("analyses.auto.naivePeriodDays_a1cb8f")}</label>
            <input
              type="number"
              min={0}
              value={design.studyPopulation?.naivePeriod ?? 365}
              onChange={(e) => setDesign((d) => ({
                ...d,
                studyPopulation: { ...(d.studyPopulation ?? defaultDesign.studyPopulation), naivePeriod: Number(e.target.value) },
              }))}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <button
              type="button"
              onClick={() => setDesign((d) => ({
                ...d,
                studyPopulation: { ...(d.studyPopulation ?? defaultDesign.studyPopulation), firstOutcomeOnly: !(d.studyPopulation?.firstOutcomeOnly ?? true) },
              }))}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors",
                (design.studyPopulation?.firstOutcomeOnly ?? true) ? "bg-success" : "bg-surface-highlight",
              )}
            >
              <span className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                (design.studyPopulation?.firstOutcomeOnly ?? true) && "translate-x-4",
              )} />
            </button>
            {t("analyses.auto.firstOutcomeOnly_970177")}
          </label>
        </div>
      </div>

      {/* Covariate Settings */}
      {design.covariateSettings && (
        <CovariateSettingsPanel
          settings={design.covariateSettings}
          onChange={(covariateSettings) => setDesign((d) => ({ ...d, covariateSettings }))}
          visibleKeys={[
            "useDemographics",
            "useConditionOccurrence",
            "useDrugExposure",
            "useProcedureOccurrence",
            "useMeasurement",
          ]}
        />
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isNew ? t("analyses.auto.create_686e69") : t("analyses.auto.saveChanges_f5d604")}
        </button>
      </div>
    </div>
  );
}
