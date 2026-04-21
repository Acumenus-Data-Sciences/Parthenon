import { useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import type { PathwayDesign, PathwayAnalysis } from "../types/pathway";
import { useUpdatePathway, useCreatePathway } from "../hooks/usePathways";

const defaultDesign: PathwayDesign = {
  targetCohortId: 0,
  eventCohortIds: [],
  maxDepth: 5,
  minCellCount: 5,
  combinationWindow: 1,
  maxPathLength: 5,
};

interface PathwayDesignerProps {
  pathway?: PathwayAnalysis | null;
  isNew?: boolean;
  onSaved?: (p: PathwayAnalysis) => void;
}

export function PathwayDesigner({
  pathway,
  isNew,
  onSaved,
}: PathwayDesignerProps) {
  const { t } = useTranslation("app");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<PathwayDesign>(defaultDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreatePathway();
  const updateMutation = useUpdatePathway();

  const cohorts = cohortData?.items ?? [];

  // Sync form from pathway prop — legitimate external-source sync
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (pathway) {
      setName(pathway.name);
      setDescription(pathway.description ?? "");
      setDesign(pathway.design_json);
    }
  }, [pathway]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleEventCohort = (cohortId: number) => {
    setDesign((prev) => ({
      ...prev,
      eventCohortIds: prev.eventCohortIds.includes(cohortId)
        ? prev.eventCohortIds.filter((id) => id !== cohortId)
        : [...prev.eventCohortIds, cohortId],
    }));
  };

  const removeEventCohort = (cohortId: number) => {
    setDesign((prev) => ({
      ...prev,
      eventCohortIds: prev.eventCohortIds.filter((id) => id !== cohortId),
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !pathway) {
      createMutation.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          design_json: design,
        },
        {
          onSuccess: (p) => onSaved?.(p),
        },
      );
    } else {
      updateMutation.mutate(
        {
          id: pathway.id,
          payload: {
            name: name.trim(),
            description: description.trim(),
            design_json: design,
          },
        },
        {
          onSuccess: (p) => onSaved?.(p),
        },
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const cohortFallback = (cohortId: number) =>
    t("analyses.auto.cohortNumber_6a7a5a", { id: cohortId });

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.basicInformation_87cabb")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.name_49ee30")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("analyses.auto.pathwayAnalysisName_dc0c6e")}
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary placeholder:text-text-ghost",
                "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.description_b5a7ad")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("analyses.auto.optionalDescription_d196d2")}
              rows={2}
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary placeholder:text-text-ghost resize-none",
                "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
        </div>
      </div>

      {/* Target Cohort */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.targetCohort_4d7f0b")}
        </h3>
        <p className="text-xs text-text-muted">
          {t("analyses.auto.selectTheTargetCohortWhoseTreatmentPathwaysWillBeAnalyzed_485929")}
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <select
            value={design.targetCohortId || ""}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                targetCohortId: Number(e.target.value) || 0,
              }))
            }
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          >
            <option value="">{t("analyses.auto.selectATargetCohort_9be701")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {design.targetCohortId > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
              {cohorts.find((c) => c.id === design.targetCohortId)?.name ??
                cohortFallback(design.targetCohortId)}
            </span>
          </div>
        )}
      </div>

      {/* Event Cohorts */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.eventCohorts_1c1758")}
        </h3>
        <p className="text-xs text-text-muted">
          {t(
            "analyses.auto.selectTheEventCohortsWhoseSequencesWillBeAnalyzedWithinTheTargetCohortTheseRepresentTreatmentsProceduresOrConditionsToTrack_c12c1b",
          )}
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <>
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleEventCohort(val);
                e.target.value = "";
              }}
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
              defaultValue=""
            >
              <option value="">{t("analyses.auto.addAnEventCohort_0bd069")}</option>
              {cohorts
                .filter((c) => !design.eventCohortIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {design.eventCohortIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {design.eventCohortIds.map((id) => {
                  const cohort = cohorts.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent"
                    >
                      {cohort?.name ?? cohortFallback(id)}
                      <button
                        type="button"
                        onClick={() => removeEventCohort(id)}
                        className="hover:text-text-primary transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Parameters */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.parameters_3225a1")}
        </h3>

        {/* Max Depth */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {t("analyses.auto.maxDepth_262e9f")} {design.maxDepth}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={design.maxDepth}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                maxDepth: Number(e.target.value),
              }))
            }
            className="w-full accent-success"
          />
          <div className="flex items-center justify-between text-[10px] text-text-ghost">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Max Path Length */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {t("analyses.auto.maxPathLength_468b45")} {design.maxPathLength}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={design.maxPathLength}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                maxPathLength: Number(e.target.value),
              }))
            }
            className="w-full accent-success"
          />
          <div className="flex items-center justify-between text-[10px] text-text-ghost">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Combination Window */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {t("analyses.auto.combinationWindowDays_bd975e")}
          </label>
          <input
            type="number"
            min={0}
            max={365}
            value={design.combinationWindow}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                combinationWindow: Number(e.target.value) || 1,
              }))
            }
            className={cn(
              "w-32 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          />
          <p className="mt-1 text-[10px] text-text-ghost">
            {t("analyses.auto.eventsWithinThisWindowAreTreatedAsOccurringSimultaneously_0157e9")}
          </p>
        </div>

        {/* Min Cell Count */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {t("analyses.auto.minimumCellCount_2438c8")}
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={design.minCellCount}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                minCellCount: Number(e.target.value) || 5,
              }))
            }
            className={cn(
              "w-32 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {isNew ? t("analyses.auto.create_686e69") : t("analyses.auto.saveChanges_f5d604")}
        </button>
      </div>
    </div>
  );
}
