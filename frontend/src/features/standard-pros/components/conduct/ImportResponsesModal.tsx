import { useState } from "react";
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
      title={`Import Responses${campaign ? `: ${campaign.name}` : ""}`}
      size="xl"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={csv.trim() === "" || isSubmitting}
            onClick={() => onSubmit(csv)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Import CSV
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[#2A2A2F] bg-[#141418] px-4 py-3">
          <p className="text-xs text-[#C5C0B8]">
            Paste CSV with a required <code>person_id</code> column and item columns matching
            <code>item_#</code>, raw item ids, or exact item text.
          </p>
          <p className="mt-2 text-[11px] font-['IBM_Plex_Mono',monospace] text-[#5A5650]">
            Example header: {sampleHeader}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#8A857D]">
            CSV File
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
            className="block w-full rounded-lg border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#C5C0B8] file:mr-3 file:rounded-md file:border-0 file:bg-[#0E0E11] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#F0EDE8]"
          />
        </div>
        <textarea
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={16}
          placeholder={`${sampleHeader}\n101,1,2,3`}
          className="w-full rounded-lg border border-[#2A2A2F] bg-[#141418] px-3 py-3 font-['IBM_Plex_Mono',monospace] text-xs text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
        />
      </div>
    </Modal>
  );
}
