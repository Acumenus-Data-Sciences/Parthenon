import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  fetchPublicSurvey,
  submitPublicSurvey,
  type PublicSurveyCampaignApi,
  type PublicSurveyItemApi,
} from "../api/publicSurveyApi";
import { standardProsResponseTypeLabel } from "../lib/i18n";

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
  const { t } = useTranslation("app");

  if (item.response_type === "multi_select" && item.answer_options.length > 0) {
    const current = Array.isArray(value) ? value : [];

    return (
      <div className="space-y-2">
        {item.answer_options.map((option) => {
          const checked = current.includes(option.option_text);

          return (
            <label
              key={option.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-white px-3 py-2 text-sm text-text-primary"
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
        className="w-full rounded-xl border border-border-default bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-warning"
      >
        <option value="">{t("standardPros.common.selectResponse")}</option>
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
        className="w-full rounded-xl border border-border-default bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-warning"
      />
    );
  }

  if (isTextItem(item)) {
    return (
      <textarea
        rows={4}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border-default bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-warning"
      />
    );
  }

  return null;
}

function SurveyHeader({ campaign }: { campaign: PublicSurveyCampaignApi }) {
  const { t } = useTranslation("app");

  return (
    <div className="rounded-[28px] border border-border-default bg-surface-raised p-6 shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-warning-dark">
        {t("standardPros.publicSurvey.headerEyebrow")}
      </div>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            {campaign.name}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {campaign.description ??
              campaign.instrument.description ??
              t("standardPros.publicSurvey.defaultDescription")}
          </p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-[0_16px_40px_rgba(83,58,33,0.08)]">
          <div className="text-[10px] uppercase tracking-[0.24em] text-text-muted">
            {t("standardPros.publicSurvey.instrumentLabel")}
          </div>
          <div className="mt-1 text-sm font-medium text-text-primary">
            {campaign.instrument.abbreviation} v{campaign.instrument.version}
          </div>
          <div className="mt-1 text-xs text-text-muted">
            {t("standardPros.publicSurvey.questionsCount", {
              count: campaign.instrument.items.length,
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicSurveyPage() {
  const { t } = useTranslation("app");
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
      <div className="flex min-h-screen items-center justify-center bg-surface-overlay">
        <Loader2 size={28} className="animate-spin text-warning-dark" />
      </div>
    );
  }

  if (surveyQuery.isError || !surveyQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-overlay px-6">
        <div className="max-w-md rounded-[28px] border border-border-default bg-surface-base p-8 text-center shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
          <AlertTriangle size={36} className="mx-auto text-warning-dark" />
          <h1 className="mt-4 text-xl font-semibold text-text-primary">
            {t("standardPros.publicSurvey.unavailableTitle")}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {t("standardPros.publicSurvey.unavailableMessage")}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-overlay px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-border-default bg-surface-base p-8 text-center shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
          <CheckCircle2 size={40} className="mx-auto text-success-dark" />
          <h1 className="mt-4 text-2xl font-semibold text-text-primary">
            {t("standardPros.publicSurvey.responseSubmitted")}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {t("standardPros.publicSurvey.thankYou")}
          </p>
          {submitted.totalScore !== null && (
            <p className="mt-4 inline-flex rounded-full bg-surface-raised px-4 py-2 text-sm font-medium text-warning-dark">
              {t("standardPros.publicSurvey.totalScore", {
                score: submitted.totalScore,
              })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#FFF8F2_0%,_#F4E8D8_48%,_#EBD8C2_100%)] px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-4xl space-y-6">
        <SurveyHeader campaign={surveyQuery.data} />

        <div className="rounded-[28px] border border-border-default bg-surface-base p-6 shadow-[0_24px_80px_rgba(83,58,33,0.08)]">
          {surveyQuery.data.requires_respondent_identifier === false ? (
            <div className="rounded-2xl border border-border-default bg-white px-4 py-4">
              <div className="text-sm font-medium text-text-primary">
                {t("standardPros.publicSurvey.secureBrokerInvitation")}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {t("standardPros.publicSurvey.secureBrokerDescription")}
                {surveyQuery.data.blinded_participant_id
                  ? ` ${t("standardPros.publicSurvey.reference", {
                    reference: surveyQuery.data.blinded_participant_id,
                  })}`
                  : ""}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {surveyQuery.data.requires_respondent_identifier
                    ? t("standardPros.publicSurvey.identifierRequired")
                    : t("standardPros.publicSurvey.identifierOptional")}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  {surveyQuery.data.requires_respondent_identifier
                    ? t("standardPros.publicSurvey.identifierRequiredHelp")
                    : t("standardPros.publicSurvey.identifierOptionalHelp")}
                </p>
              </div>
              <input
                type="text"
                value={respondentIdentifier}
                onChange={(event) => setRespondentIdentifier(event.target.value)}
                placeholder={t("standardPros.publicSurvey.identifierPlaceholder")}
                className="w-full rounded-xl border border-border-default bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-warning"
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {orderedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-[28px] border border-border-default bg-surface-base p-6 shadow-[0_24px_80px_rgba(83,58,33,0.06)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning-dark text-sm font-semibold text-text-primary">
                  {item.item_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium leading-relaxed text-text-primary">
                    {item.item_text}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-text-muted">
                    {standardProsResponseTypeLabel(t, item.response_type)}
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
            className="inline-flex items-center gap-2 rounded-full bg-surface-accent px-6 py-3 text-sm font-medium text-text-primary shadow-[0_20px_40px_rgba(47,42,36,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {t("standardPros.publicSurvey.submitResponse")}
          </button>
        </div>
      </div>
    </div>
  );
}
