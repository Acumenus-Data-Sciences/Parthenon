import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCreateInvestigation } from "../hooks/useInvestigation";

export default function NewInvestigationPage() {
  const navigate = useNavigate();
  const createInvestigation = useCreateInvestigation();

  const [title, setTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createInvestigation.mutate(
      {
        title: title.trim(),
        research_question: researchQuestion.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          void navigate(`/workbench/investigation/${result.id}`);
        },
      },
    );
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#0E0E11" }}
    >
      <div className="max-w-lg w-full mx-auto bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
        <h1 className="text-xl font-bold text-zinc-100 mb-1">
          New Evidence Investigation
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Start a structured dossier for your research question.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
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
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={createInvestigation.isPending || !title.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#9B1B30" }}
          >
            {createInvestigation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Investigation"
            )}
          </button>

          {createInvestigation.isError && (
            <p className="text-xs text-red-400 text-center">
              Failed to create investigation. Please try again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
