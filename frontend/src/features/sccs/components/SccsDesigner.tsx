import { useState, useEffect } from "react";
import { Loader2, Save, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import { CovariateSettingsPanel } from "@/components/analysis/CovariateSettingsPanel";
import type { SccsDesign, SccsAnalysis, RiskWindow } from "../types/sccs";
import { useCreateSccs, useUpdateSccs } from "../hooks/useSccs";

const defaultRiskWindow: RiskWindow = {
  start: 0,
  end: 30,
  startAnchor: "era_start",
  endAnchor: "era_start",
  label: "Risk Window 1",
};

const defaultDesign: SccsDesign = {
  exposureCohortId: 0,
  outcomeCohortId: 0,
  riskWindows: [{ ...defaultRiskWindow }],
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

interface SccsDesignerProps {
  sccs?: SccsAnalysis | null;
  isNew?: boolean;
  onSaved?: (s: SccsAnalysis) => void;
}

export function SccsDesigner({ sccs, isNew, onSaved }: SccsDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<SccsDesign>(defaultDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreateSccs();
  const updateMutation = useUpdateSccs();

  const cohorts = cohortData?.items ?? [];

  useEffect(() => {
    if (sccs) {
      setName(sccs.name);
      setDescription(sccs.description ?? "");
      const dj = sccs.design_json;
      // Normalize: backend may use studyPopulationSettings instead of studyPopulation
      const studyPop = dj.studyPopulation ?? dj.studyPopulationSettings ?? defaultDesign.studyPopulation;
      setDesign({
        ...defaultDesign,
        ...dj,
        studyPopulation: {
          naivePeriod: studyPop.naivePeriod ?? studyPop.naive_period ?? 365,
          firstOutcomeOnly: studyPop.firstOutcomeOnly ?? studyPop.first_outcome_only ?? true,
        },
        riskWindows: dj.riskWindows ?? dj.risk_windows ?? defaultDesign.riskWindows,
      });
    }
  }, [sccs]);

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
        {
          ...defaultRiskWindow,
          label: `Risk Window ${d.riskWindows.length + 1}`,
        },
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
    "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
    "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
  );

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">Basic Information</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SCCS analysis name"
              className={cn(inputCls, "placeholder:text-[#5A5650]")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className={cn(inputCls, "placeholder:text-[#5A5650] resize-none")}
            />
          </div>
        </div>
      </div>

      {/* Exposure Cohort */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">Exposure Cohort</h3>
        <p className="text-xs text-[#8A857D]">Select the drug/exposure cohort. Each patient serves as their own control.</p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        ) : (
          <select
            value={design.exposureCohortId || ""}
            onChange={(e) => setDesign((d) => ({ ...d, exposureCohortId: Number(e.target.value) || 0 }))}
            className={inputCls}
          >
            <option value="">Select exposure cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Outcome Cohort */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">Outcome Cohort</h3>
        <p className="text-xs text-[#8A857D]">Select the adverse event/outcome to study.</p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        ) : (
          <select
            value={design.outcomeCohortId || ""}
            onChange={(e) => setDesign((d) => ({ ...d, outcomeCohortId: Number(e.target.value) || 0 }))}
            className={inputCls}
          >
            <option value="">Select outcome cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Risk Windows */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">Risk Windows</h3>
          <button
            type="button"
            onClick={addRiskWindow}
            className="inline-flex items-center gap-1 text-xs text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
          >
            <Plus size={12} /> Add Window
          </button>
        </div>
        <p className="text-xs text-[#8A857D]">
          Define time windows relative to the exposure era where the outcome risk is assessed.
        </p>
        {design.riskWindows.map((rw, idx) => (
          <div key={idx} className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={rw.label}
                onChange={(e) => updateRiskWindow(idx, { label: e.target.value })}
                className="bg-transparent text-sm text-[#F0EDE8] font-medium focus:outline-none border-b border-transparent focus:border-[#C9A227] transition-colors"
              />
              {design.riskWindows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRiskWindow(idx)}
                  className="text-[#8A857D] hover:text-[#E85A6B] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-[#5A5650] mb-1">Start Day</label>
                <input
                  type="number"
                  value={rw.start}
                  onChange={(e) => updateRiskWindow(idx, { start: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#5A5650] mb-1">Start Anchor</label>
                <select
                  value={rw.startAnchor}
                  onChange={(e) => updateRiskWindow(idx, { startAnchor: e.target.value as "era_start" | "era_end" })}
                  className={inputCls}
                >
                  <option value="era_start">Era Start</option>
                  <option value="era_end">Era End</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[#5A5650] mb-1">End Day</label>
                <input
                  type="number"
                  value={rw.end}
                  onChange={(e) => updateRiskWindow(idx, { end: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#5A5650] mb-1">End Anchor</label>
                <select
                  value={rw.endAnchor}
                  onChange={(e) => updateRiskWindow(idx, { endAnchor: e.target.value as "era_start" | "era_end" })}
                  className={inputCls}
                >
                  <option value="era_start">Era Start</option>
                  <option value="era_end">Era End</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Model & Population Settings */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">Model & Population</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">Model Type</label>
            <select
              value={design.model.type}
              onChange={(e) => setDesign((d) => ({ ...d, model: { ...d.model, type: e.target.value as SccsDesign["model"]["type"] } }))}
              className={inputCls}
            >
              <option value="simple">Simple (no adjustments)</option>
              <option value="age_adjusted">Age-adjusted</option>
              <option value="season_adjusted">Season-adjusted</option>
              <option value="age_season_adjusted">Age + Season adjusted</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">Naive Period (days)</label>
            <input
              type="number"
              min={0}
              value={design.studyPopulation.naivePeriod}
              onChange={(e) => setDesign((d) => ({
                ...d,
                studyPopulation: { ...d.studyPopulation, naivePeriod: Number(e.target.value) },
              }))}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-[#C5C0B8] cursor-pointer">
            <button
              type="button"
              onClick={() => setDesign((d) => ({
                ...d,
                studyPopulation: { ...d.studyPopulation, firstOutcomeOnly: !d.studyPopulation.firstOutcomeOnly },
              }))}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors",
                design.studyPopulation.firstOutcomeOnly ? "bg-[#2DD4BF]" : "bg-[#323238]",
              )}
            >
              <span className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                design.studyPopulation.firstOutcomeOnly && "translate-x-4",
              )} />
            </button>
            First Outcome Only
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
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isNew ? "Create" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
