import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { useTranslation } from "react-i18next";

export function ObservationWindowStep() {
  const { t } = useTranslation("app");
  const { observationWindow, setObservationWindow } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.step2Of3ObservationWindow_b94abd")}
        </div>
        <p className="text-[13px] text-text-muted">
          {t("cohortDefinitions.auto.howMuchMedicalHistoryMustAPatientHave_9051a5")}
        </p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-base p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="min-w-[240px] text-[13px] text-text-secondary">
              {t("cohortDefinitions.auto.daysOfHistoryRequiredBeforeEntry_df5f37")}
            </label>
            <input
              type="number"
              min={0}
              value={observationWindow.priorDays}
              onChange={(e) =>
                setObservationWindow(
                  Math.max(0, parseInt(e.target.value) || 0),
                  observationWindow.postDays,
                )
              }
              className="w-[100px] rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-center text-[13px] text-accent outline-none focus:border-accent"
            />
            <span className="text-[13px] text-text-muted">days</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="min-w-[240px] text-[13px] text-text-secondary">
              {t("cohortDefinitions.auto.daysOfFollowUpRequiredAfterEntry_2ef509")}
            </label>
            <input
              type="number"
              min={0}
              value={observationWindow.postDays}
              onChange={(e) =>
                setObservationWindow(
                  observationWindow.priorDays,
                  Math.max(0, parseInt(e.target.value) || 0),
                )
              }
              className="w-[100px] rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-center text-[13px] text-accent outline-none focus:border-accent"
            />
            <span className="text-[13px] text-text-muted">days</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
        <span className="text-accent">💡</span>{" "}
        <span className="text-[13px] text-text-muted">
          <strong className="text-accent">{t("cohortDefinitions.auto.tip_342a40")}</strong> {t("cohortDefinitions.auto.thisEnsuresPatientsHaveEnoughDataForYour_5428c0")}
        </span>
      </div>
    </div>
  );
}
