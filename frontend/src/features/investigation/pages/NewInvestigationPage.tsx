import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCreateInvestigation } from "../hooks/useInvestigation";
import { saveDomainState } from "../api";
import { splitIntent } from "@/features/study-agent/api";
import type { IntentSplitResult } from "@/features/study-agent/api";

type StatusPhase = "idle" | "creating" | "analyzing" | "done";

export default function NewInvestigationPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const createInvestigation = useCreateInvestigation();
  const [searchParams] = useSearchParams();

  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [researchQuestion, setResearchQuestion] = useState(searchParams.get("question") ?? "");
  const [phase, setPhase] = useState<StatusPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLongEnough = researchQuestion.trim().length > 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    setPhase("creating");

    let investigationId: number;

    try {
      const result = await createInvestigation.mutateAsync({
        title: title.trim(),
        research_question: researchQuestion.trim() || undefined,
      });
      investigationId = result.id;
    } catch {
      setError(t("investigation.common.messages.createInvestigationFailed"));
      setPhase("idle");
      return;
    }

    // Guided mode: if the research question is long enough, attempt intent split
    if (isLongEnough) {
      setPhase("analyzing");

      try {
        const intent: IntentSplitResult = await splitIntent(
          researchQuestion.trim(),
        );

        // Seed phenotype_state with concept set suggestions from the split
        await saveDomainState(investigationId, "phenotype", {
          concept_sets: [
            { id: crypto.randomUUID(), name: intent.target },
            { id: crypto.randomUUID(), name: intent.outcome },
          ],
          ai_seeded: true,
          ai_rationale: intent.rationale ?? null,
        });
      } catch {
        // Guided mode is best-effort — silently proceed if StudyAgent is unavailable
      }
    }

    setPhase("done");
    void navigate(`/workbench/investigation/${investigationId}`);
  };

  const isPending = phase === "creating" || phase === "analyzing";

  const buttonLabel = () => {
    if (phase === "analyzing") {
      return t("investigation.common.messages.aiWillAnalyze");
    }
    return t("investigation.common.actions.createInvestigation");
  };

  return (
    <div
      className="min-h-screen flex flex-col px-4"
      style={{ backgroundColor: "var(--surface-base)" }}
    >
      {/* Back link */}
      <div className="pt-6 pb-2 max-w-lg w-full mx-auto">
        <Link
          to="/workbench/investigation"
          className="inline-flex items-center gap-1.5 text-xs text-text-ghost hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("investigation.newPage.back")}
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center">
      <div className="max-w-lg w-full mx-auto bg-surface-base/50 border border-border-default rounded-2xl p-8">
        <h1 className="text-xl font-bold text-text-primary mb-1">
          {t("investigation.newPage.title")}
        </h1>
        <p className="text-sm text-text-ghost mb-6">
          {t("investigation.newPage.subtitle")}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              {t("investigation.common.labels.title")}{" "}
              <span className="text-primary">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("investigation.common.placeholders.investigationTitle")}
              className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-text-primary placeholder-text-ghost text-sm focus:outline-none focus:border-border-hover transition-colors"
            />
          </div>

          {/* Research Question */}
          <div>
            <label
              htmlFor="research_question"
              className="block text-sm font-medium text-text-secondary mb-1.5"
            >
              {t("investigation.common.sections.researchQuestion")}{" "}
              <span className="text-text-ghost font-normal">
                ({t("investigation.common.labels.optional")})
              </span>
            </label>
            <textarea
              id="research_question"
              rows={4}
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              placeholder={t("investigation.common.placeholders.researchQuestion")}
              className="w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-text-primary placeholder-text-ghost text-sm focus:outline-none focus:border-border-hover transition-colors resize-none"
            />
            {isLongEnough && (
              <p className="mt-1 text-xs text-success">
                {t("investigation.common.messages.aiWillAnalyze")}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || !title.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {buttonLabel()}
              </>
            ) : (
              t("investigation.common.actions.createInvestigation")
            )}
          </button>

          {error !== null && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </form>
      </div>
      </div>
    </div>
  );
}
