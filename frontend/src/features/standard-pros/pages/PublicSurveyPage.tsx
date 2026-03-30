import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  fetchPublicSurvey,
  submitPublicSurvey,
  type PublicSurveyCampaignApi,
  type PublicSurveyItemApi,
} from "../api/publicSurveyApi";

function isChoiceItem(item: PublicSurveyItemApi) {
  return (
    (item.response_type === "likert" ||
      item.response_type === "yes_no" ||
      item.response_type === "multi_select") &&
    item.answer_options.length > 0
  );
}

function isNumericItem(item: PublicSurveyItemApi) {
  return (
    item.response_type === "numeric" ||
    item.response_type === "nrs" ||
    item.response_type === "vas"
  );
}

function isDateItem(item: PublicSurveyItemApi) {
  return item.response_type === "date";
}

function isTextItem(item: PublicSurveyItemApi) {
  return !isChoiceItem(item) && !isNumericItem(item) && !isDateItem(item);
}

function SurveyField({
  item,
  value,
  onChange,
}: {
  item: PublicSurveyItemApi;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  if (item.response_type === "multi_select" && item.answer_options.length > 0) {
    const current = Array.isArray(value) ? value : [];

    return (
      <div className="space-y-2">
        {item.answer_options.map((option) => {
          const checked = current.includes(option.option_text);

          return (
            <label
              key={option.id}
              className="flex items-center gap-3 rounded-lg border border-[#D8D3C8] bg-white px-3 py-2 text-sm text-[#2F2A24]"
            >
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
                  onChange(Array.from(next));
                }}
              />
              <span>{option.option_text}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (isChoiceItem(item)) {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#D8D3C8] bg-white px-4 py-3 text-sm text-[#2F2A24] outline-none focus:border-[#C66B3D]"
      >
        <option value="">Select a response</option>
        {item.answer_options.map((option) => (
          <option key={option.id} value={option.option_text}>
            {option.option_text}
          </option>
        ))}
      </select>
    );
  }

  if (isNumericItem(item) || isDateItem(item)) {
    return (
      <input
        type={isDateItem(item) ? "date" : "number"}
        min={item.min_value ?? undefined}
        max={item.max_value ?? undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#D8D3C8] bg-white px-4 py-3 text-sm text-[#2F2A24] outline-none focus:border-[#C66B3D]"
      />
    );
  }

  if (isTextItem(item)) {
    return (
      <textarea
        rows={4}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#D8D3C8] bg-white px-4 py-3 text-sm text-[#2F2A24] outline-none focus:border-[#C66B3D]"
      />
    );
  }

  return null;
}

function SurveyHeader({ campaign }: { campaign: PublicSurveyCampaignApi }) {
  return (
    <div className="rounded-[28px] border border-[#D8D3C8] bg-[#F7F1E8] p-6 shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9A6B47]">
        Parthenon Standard PROs
      </div>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-[#2F2A24]">
            {campaign.name}
          </h1>
          <p className="mt-2 text-sm text-[#6D6256]">
            {campaign.description ??
              campaign.instrument.description ??
              "Please complete the survey below. Your responses will be recorded anonymously unless your study team instructed otherwise."}
          </p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-[0_16px_40px_rgba(83,58,33,0.08)]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[#9B9488]">
            Instrument
          </div>
          <div className="mt-1 text-sm font-medium text-[#2F2A24]">
            {campaign.instrument.abbreviation} v{campaign.instrument.version}
          </div>
          <div className="mt-1 text-xs text-[#6D6256]">
            {campaign.instrument.items.length} questions
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicSurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [respondentIdentifier, setRespondentIdentifier] = useState("");
  const [values, setValues] = useState<Record<number, string | string[]>>({});
  const [submitted, setSubmitted] = useState<{
    totalScore: number | null;
  } | null>(null);

  const surveyQuery = useQuery({
    queryKey: ["public-survey", token],
    queryFn: () => fetchPublicSurvey(token ?? ""),
    enabled: Boolean(token),
  });

  const orderedItems = useMemo(
    () =>
      [...(surveyQuery.data?.instrument.items ?? [])].sort(
        (left, right) => left.display_order - right.display_order,
      ),
    [surveyQuery.data],
  );

  const submitMutation = useMutation({
    mutationFn: (payload: {
      responses: Array<{ survey_item_id: number; value: string | number | string[] }>;
      respondent_identifier?: string;
    }) => submitPublicSurvey(token ?? "", payload),
    onSuccess: (result) => {
      setSubmitted({ totalScore: result.total_score });
    },
  });

  const canSubmit = orderedItems.some((item) => {
    const value = values[item.id];
    return value != null && value !== "" && (!Array.isArray(value) || value.length > 0);
  });

  const handleSubmit = () => {
    const responses = orderedItems.flatMap((item) => {
      const value = values[item.id];
      if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
        return [];
      }

      return [
        {
          survey_item_id: item.id,
          value,
        },
      ];
    });

    if (responses.length === 0 || !token) {
      return;
    }

    submitMutation.mutate({
      responses,
      respondent_identifier: respondentIdentifier.trim() || undefined,
    });
  };

  if (surveyQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4E8D8]">
        <Loader2 size={28} className="animate-spin text-[#9A6B47]" />
      </div>
    );
  }

  if (surveyQuery.isError || !surveyQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4E8D8] px-6">
        <div className="max-w-md rounded-[28px] border border-[#E5CFC3] bg-[#FFF8F2] p-8 text-center shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
          <AlertTriangle size={36} className="mx-auto text-[#C35B47]" />
          <h1 className="mt-4 text-xl font-semibold text-[#2F2A24]">
            Survey unavailable
          </h1>
          <p className="mt-2 text-sm text-[#6D6256]">
            This survey link is invalid, expired, or no longer accepting responses.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F4E8D8] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-[#D8D3C8] bg-[#FFF8F2] p-8 text-center shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
          <CheckCircle2 size={40} className="mx-auto text-[#3C8D69]" />
          <h1 className="mt-4 text-2xl font-semibold text-[#2F2A24]">
            Response submitted
          </h1>
          <p className="mt-2 text-sm text-[#6D6256]">
            Thank you. Your survey response has been recorded.
          </p>
          {submitted.totalScore !== null && (
            <p className="mt-4 inline-flex rounded-full bg-[#F7F1E8] px-4 py-2 text-sm font-medium text-[#7A5A42]">
              Calculated total score: {submitted.totalScore}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#FFF8F2_0%,_#F4E8D8_48%,_#EBD8C2_100%)] px-4 py-8 text-[#2F2A24]">
      <div className="mx-auto max-w-4xl space-y-6">
        <SurveyHeader campaign={surveyQuery.data} />

        <div className="rounded-[28px] border border-[#D8D3C8] bg-[#FFF8F2] p-6 shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="text-sm font-medium text-[#2F2A24]">
                Optional participant identifier
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#6D6256]">
                Leave this blank for anonymous submission, or enter the code provided by your study team.
              </p>
            </div>
            <input
              type="text"
              value={respondentIdentifier}
              onChange={(event) => setRespondentIdentifier(event.target.value)}
              placeholder="Study ID or external reference"
              className="w-full rounded-xl border border-[#D8D3C8] bg-white px-4 py-3 text-sm text-[#2F2A24] outline-none focus:border-[#C66B3D]"
            />
          </div>
        </div>

        <div className="space-y-4">
          {orderedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-[28px] border border-[#D8D3C8] bg-[#FFF8F2] p-6 shadow-[0_24px_80px_rgba(83,58,33,0.06)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#C66B3D] text-sm font-semibold text-white">
                  {item.item_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium leading-relaxed text-[#2F2A24]">
                    {item.item_text}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#9B9488]">
                    {item.response_type.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <SurveyField
                  item={item}
                  value={values[item.id] ?? ""}
                  onChange={(next) =>
                    setValues((existing) => ({ ...existing, [item.id]: next }))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-4 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitMutation.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-[#2F2A24] px-6 py-3 text-sm font-medium text-[#FFF8F2] shadow-[0_20px_40px_rgba(47,42,36,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Submit Response
          </button>
        </div>
      </div>
    </div>
  );
}
