import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { SurveyCampaignApi, SurveyConductRecordApi } from "../../api/campaignApi";
import type { SurveyInstrumentDetailApi } from "../../api/surveyApi";

interface ManualEntryModalProps {
  open: boolean;
  onClose: () => void;
  campaign: SurveyCampaignApi | null;
  instrument: SurveyInstrumentDetailApi | null;
  conductRecords: SurveyConductRecordApi[];
  isSubmitting: boolean;
  onSubmit: (
    conductId: number,
    responses: Array<{ survey_item_id: number; value: string | number | string[] }>,
  ) => void;
}

export function ManualEntryModal({
  open,
  onClose,
  campaign,
  instrument,
  conductRecords,
  isSubmitting,
  onSubmit,
}: ManualEntryModalProps) {
  const [conductId, setConductId] = useState("");
  const [recordQuery, setRecordQuery] = useState("");
  const [values, setValues] = useState<Record<number, string | string[]>>({});

  const pendingRecords = useMemo(
    () => conductRecords.filter((record) => {
      if (record.completion_status !== "pending" || record.person_id == null) {
        return false;
      }

      const query = recordQuery.trim();
      if (query === "") {
        return true;
      }

      return String(record.person_id).includes(query);
    }),
    [conductRecords, recordQuery],
  );

  const handleClose = () => {
    setConductId("");
    setRecordQuery("");
    setValues({});
    onClose();
  };

  const submitResponses = () => {
    if (!instrument || conductId === "") {
      return;
    }

    const responses = instrument.items.flatMap((item) => {
      const value = values[item.id];

      if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
        return [];
      }

      return [{ survey_item_id: item.id, value }];
    });

    onSubmit(Number(conductId), responses);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Manual Proxy Entry${campaign ? `: ${campaign.name}` : ""}`}
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
            disabled={conductId === "" || isSubmitting}
            onClick={submitResponses}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Save Responses
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#8A857D]">
            Pending Conduct Record
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
            <input
              value={recordQuery}
              onChange={(event) => setRecordQuery(event.target.value)}
              placeholder="Filter by person_id"
              inputMode="numeric"
              className="w-full rounded-lg border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
            />
            <select
              value={conductId}
              onChange={(event) => setConductId(event.target.value)}
              className="w-full rounded-lg border border-[#2A2A2F] bg-[#141418] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
            >
              <option value="">Select a person</option>
              {pendingRecords.map((record) => (
                <option key={record.id} value={record.id}>
                  Person {record.person_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {instrument?.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#2A2A2F] bg-[#141418] p-4">
              <label className="mb-2 block text-sm text-[#F0EDE8]">
                {item.item_number}. {item.item_text}
              </label>

              {(item.response_type === "likert" || item.response_type === "yes_no" || item.response_type === "multi_select") && item.answer_options.length > 0 && (
                item.response_type === "multi_select" ? (
                  <div className="space-y-2">
                    {item.answer_options.map((option) => {
                      const current = Array.isArray(values[item.id]) ? values[item.id] : [];
                      const checked = current.includes(option.option_text);

                      return (
                        <label key={option.id} className="flex items-center gap-2 text-xs text-[#C5C0B8]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const next = new Set(current);
                              if (event.target.checked) {
                                next.add(option.option_text);
                              } else {
                                next.delete(option.option_text);
                              }
                              setValues((existing) => ({ ...existing, [item.id]: Array.from(next) }));
                            }}
                          />
                          <span>{option.option_text}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={typeof values[item.id] === "string" ? values[item.id] : ""}
                    onChange={(event) => setValues((existing) => ({ ...existing, [item.id]: event.target.value }))}
                    className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
                  >
                    <option value="">Select a response</option>
                    {item.answer_options.map((option) => (
                      <option key={option.id} value={option.option_text}>
                        {option.option_text}
                      </option>
                    ))}
                  </select>
                )
              )}

              {(item.response_type === "numeric" || item.response_type === "nrs" || item.response_type === "vas" || item.response_type === "date") && (
                <input
                  type={item.response_type === "date" ? "date" : "number"}
                  value={typeof values[item.id] === "string" ? values[item.id] : ""}
                  onChange={(event) => setValues((existing) => ({ ...existing, [item.id]: event.target.value }))}
                  className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
                />
              )}

              {item.response_type === "free_text" && (
                <textarea
                  rows={3}
                  value={typeof values[item.id] === "string" ? values[item.id] : ""}
                  onChange={(event) => setValues((existing) => ({ ...existing, [item.id]: event.target.value }))}
                  className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
