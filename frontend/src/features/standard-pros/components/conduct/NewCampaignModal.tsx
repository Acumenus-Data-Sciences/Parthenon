import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { SurveyInstrumentApi } from "../../api/surveyApi";
import type { StoreCampaignPayload, SurveyCampaignDetailApi } from "../../api/campaignApi";
import type { CohortDefinition } from "@/features/cohort-definitions/types/cohortExpression";

interface NewCampaignModalProps {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  instruments: SurveyInstrumentApi[];
  cohorts: CohortDefinition[];
  initialCampaign?: SurveyCampaignDetailApi | null;
  isSaving: boolean;
  onSubmit: (payload: StoreCampaignPayload) => void;
}

const baseForm = {
  name: "",
  survey_instrument_id: "",
  cohort_generation_id: "",
  description: "",
  requires_honest_broker: false,
  cohortQuery: "",
};

export function NewCampaignModal({
  open,
  mode,
  onClose,
  instruments,
  cohorts,
  initialCampaign,
  isSaving,
  onSubmit,
}: NewCampaignModalProps) {
  const { t } = useTranslation("app");
  const [form, setForm] = useState(baseForm);

  // Sync form with prop when opening in edit mode — legitimate external-source sync
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && initialCampaign) {
      setForm({
        name: initialCampaign.name,
        survey_instrument_id: String(initialCampaign.survey_instrument_id),
        cohort_generation_id: initialCampaign.cohort_generation_id != null ? String(initialCampaign.cohort_generation_id) : "",
        description: initialCampaign.description ?? "",
        requires_honest_broker: initialCampaign.requires_honest_broker ?? false,
        cohortQuery: "",
      });
      return;
    }

    setForm(baseForm);
  }, [open, mode, initialCampaign]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredCohorts = useMemo(() => {
    const query = form.cohortQuery.trim().toLowerCase();

    return cohorts.filter((cohort) => {
      if (query === "") {
        return true;
      }

      return cohort.name.toLowerCase().includes(query) || (cohort.description ?? "").toLowerCase().includes(query);
    });
  }, [cohorts, form.cohortQuery]);

  const selectedGeneration = (() => {
    const generationId = Number(form.cohort_generation_id);

    if (!Number.isFinite(generationId) || generationId <= 0) {
      return null;
    }

    for (const cohort of cohorts) {
      const match = (cohort.generations ?? []).find((generation) => generation.id === generationId);
      if (match) {
        return { cohort, generation: match };
      }
    }

    return null;
  })();

  const canSubmit = form.name.trim() !== "" && form.survey_instrument_id !== "";

  const handleClose = () => {
    setForm(baseForm);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={mode === "create"
        ? t("standardPros.conduct.newCampaign.createTitle")
        : t("standardPros.conduct.newCampaign.editTitle")}
      size="xl"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-muted hover:text-text-primary"
          >
            {t("standardPros.common.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit || isSaving}
            onClick={() => {
              onSubmit({
                name: form.name.trim(),
                survey_instrument_id: Number(form.survey_instrument_id),
                cohort_generation_id:
                  form.cohort_generation_id.trim() === ""
                    ? null
                    : Number(form.cohort_generation_id),
                description: form.description.trim() || null,
                requires_honest_broker: form.requires_honest_broker,
              });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {mode === "create"
              ? t("standardPros.conduct.newCampaign.createButton")
              : t("standardPros.common.saveCampaign")}
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
              {t("standardPros.conduct.newCampaign.campaignName")}
            </label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("standardPros.conduct.newCampaign.campaignNamePlaceholder")}
              className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-success"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
              {t("standardPros.common.instrument")}
            </label>
            <select
              value={form.survey_instrument_id}
              onChange={(event) => setForm((current) => ({ ...current, survey_instrument_id: event.target.value }))}
              className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-success"
            >
              <option value="">{t("standardPros.conduct.newCampaign.selectInstrument")}</option>
              {instruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.abbreviation} - {instrument.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("standardPros.common.description")}
          </label>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            placeholder={t("standardPros.conduct.newCampaign.descriptionPlaceholder")}
            className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-success"
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border-default bg-surface-raised p-4">
          <input
            type="checkbox"
            checked={form.requires_honest_broker}
            onChange={(event) => setForm((current) => ({ ...current, requires_honest_broker: event.target.checked }))}
            className="mt-1 h-4 w-4 rounded border-border-default bg-surface-base text-success focus:ring-success"
          />
          <div>
            <div className="text-sm font-medium text-text-primary">
              {t("standardPros.conduct.newCampaign.honestBrokerTitle")}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              {t("standardPros.conduct.newCampaign.honestBrokerDescription")}
            </p>
          </div>
        </label>

        <div className="rounded-xl border border-border-default bg-surface-raised p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
                {t("standardPros.conduct.newCampaign.cohortGeneration")}
              </div>
              <p className="mt-1 text-[11px] text-text-ghost">
                {t("standardPros.conduct.newCampaign.cohortGenerationHelp")}
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
              <input
                value={form.cohortQuery}
                onChange={(event) => setForm((current) => ({ ...current, cohortQuery: event.target.value }))}
                placeholder={t("standardPros.common.searchCohorts")}
                className="w-full rounded-lg border border-border-default bg-surface-base py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-success"
              />
            </div>
          </div>

          <div className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, cohort_generation_id: "" }))}
              className={`w-full rounded-lg border px-3 py-3 text-left ${
                form.cohort_generation_id === ""
                  ? "border-success bg-success/10"
                  : "border-border-default bg-surface-base"
              }`}
            >
              <div className="text-sm font-medium text-text-primary">
                {t("standardPros.conduct.newCampaign.noCohortSeeding")}
              </div>
              <div className="mt-1 text-[11px] text-text-ghost">
                {t("standardPros.conduct.newCampaign.noCohortSeedingHelp")}
              </div>
            </button>

            {filteredCohorts.map((cohort) => {
              const generations = (cohort.generations ?? []).filter((generation) => generation.status === "completed");

              if (generations.length === 0) {
                return null;
              }

              return (
                <div key={cohort.id} className="rounded-lg border border-border-default bg-surface-base p-3">
                  <div className="text-sm font-medium text-text-primary">{cohort.name}</div>
                  {cohort.description && (
                    <div className="mt-1 text-[11px] text-text-ghost">{cohort.description}</div>
                  )}
                  <div className="mt-3 space-y-2">
                    {generations
                      .sort((left, right) => right.id - left.id)
                      .map((generation) => {
                        const selected = form.cohort_generation_id === String(generation.id);
                        return (
                          <button
                            key={generation.id}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, cohort_generation_id: String(generation.id) }))}
                            className={`w-full rounded-lg border px-3 py-2 text-left ${
                              selected
                                ? "border-accent bg-accent/10"
                                : "border-border-default bg-surface-raised"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-text-primary">
                                {t("standardPros.conduct.newCampaign.generationLabel", {
                                  id: generation.id,
                                })}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-text-ghost">
                                {t("standardPros.conduct.newCampaign.persons", {
                                  count: generation.person_count ?? 0,
                                })}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-text-muted">
                              {generation.completed_at
                                ? t("standardPros.conduct.newCampaign.completedAt", {
                                  date: new Date(generation.completed_at).toLocaleString(),
                                })
                                : t("standardPros.conduct.newCampaign.completedUnknown")}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedGeneration && (
            <div className="mt-4 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
              <div className="text-xs font-medium text-success">
                {t("standardPros.conduct.newCampaign.selectedDenominatorSource")}
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {t("standardPros.conduct.newCampaign.selectedSeed", {
                  cohortName: selectedGeneration.cohort.name,
                  generationId: selectedGeneration.generation.id,
                })}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                {t("standardPros.conduct.newCampaign.denominatorSeeded", {
                  count: selectedGeneration.generation.person_count ?? 0,
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
