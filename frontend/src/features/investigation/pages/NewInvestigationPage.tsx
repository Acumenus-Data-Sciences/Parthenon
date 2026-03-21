import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCreateInvestigation } from "../hooks/useInvestigation";
import { saveDomainState } from "../api";
import { splitIntent } from "@/features/study-agent/api";
import type { IntentSplitResult } from "@/features/study-agent/api";

type StatusPhase = "idle" | "creating" | "analyzing" | "done";

export default function NewInvestigationPage() {
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
      setError("Failed to create investigation. Please try again.");
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
    if (phase === "creating") return "Creating...";
    if (phase === "analyzing") return "AI is analyzing your question...";
    return "Create Investigation";
  };

  return (
    <div
      className="min-h-screen flex flex-col px-4"
      style={{ backgroundColor: "#0E0E11" }}
    >
      {/* Back link */}
      <div className="pt-6 pb-2 max-w-lg w-full mx-auto">
        <Link
          to="/workbench/investigation"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Evidence Investigation
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center">
      <div className="max-w-lg w-full mx-auto bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
        <h1 className="text-xl font-bold text-zinc-100 mb-1">
          New Evidence Investigation
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Start a structured dossier for your research question.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Title <span className="text-[#9B1B30]">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Cardiovascular risk in T2DM patients"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {/* Research Question */}
          <div>
            <label
              htmlFor="research_question"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Research Question{" "}
              <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <textarea
              id="research_question"
              rows={4}
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              placeholder="What is the comparative effectiveness of..."
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors resize-none"
            />
            {isLongEnough && (
              <p className="mt-1 text-xs text-[#2DD4BF]">
                AI will analyze your research question to suggest phenotype
                concepts.
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || !title.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#9B1B30" }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {buttonLabel()}
              </>
            ) : (
              "Create Investigation"
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
