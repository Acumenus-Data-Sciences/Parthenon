import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { SurveyCampaignApi } from "../../api/campaignApi";
import type { SurveyInstrumentDetailApi } from "../../api/surveyApi";

interface ImportResponsesModalProps {
  open: boolean;
  onClose: () => void;
  campaign: SurveyCampaignApi | null;
  instrument: SurveyInstrumentDetailApi | null;
  isSubmitting: boolean;
  onSubmit: (csv: string) => void;
}

export function ImportResponsesModal({
  open,
  onClose,
  campaign,
  instrument,
  isSubmitting,
  onSubmit,
}: ImportResponsesModalProps) {
  const { t } = useTranslation("app");
  const [csv, setCsv] = useState("");

  const handleClose = () => {
    setCsv("");
    onClose();
  };

  const sampleHeader = instrument
    ? ["person_id", ...instrument.items.slice(0, 3).map((item) => `item_${item.item_number}`)].join(",")
    : "person_id,item_1,item_2,item_3";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`${t("standardPros.conduct.importResponses.title")}${campaign ? `: ${campaign.name}` : ""}`}
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
            disabled={csv.trim() === "" || isSubmitting}
            onClick={() => onSubmit(csv)}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {t("standardPros.conduct.importResponses.importCsv")}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <p className="text-xs text-text-secondary">
            {t("standardPros.conduct.importResponses.help")}
          </p>
          <p className="mt-2 text-[11px] font-['IBM_Plex_Mono',monospace] text-text-ghost">
            {t("standardPros.conduct.importResponses.exampleHeader", {
              header: sampleHeader,
            })}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
            {t("standardPros.common.csvFile")}
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              setCsv(await file.text());
            }}
            className="block w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-base file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary"
          />
        </div>
        <textarea
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={16}
          placeholder={`${sampleHeader}\n101,1,2,3`}
          className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-3 font-['IBM_Plex_Mono',monospace] text-xs text-text-primary outline-none focus:border-success"
        />
      </div>
    </Modal>
  );
}
