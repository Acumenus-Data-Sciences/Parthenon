import { useState, useCallback } from "react";
import type { AbbyFeedbackProps, FeedbackRating, FeedbackCategory } from "../../types/abby";

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "inaccurate_recall", label: "Inaccurate recall" },
  { value: "wrong_source", label: "Wrong source cited" },
  { value: "missing_context", label: "Missing context" },
  { value: "too_verbose", label: "Too verbose" },
  { value: "hallucination", label: "Made something up" },
  { value: "other", label: "Other" },
];

export default function AbbyFeedback({
  messageId,
  existingFeedback,
  onSubmit,
}: AbbyFeedbackProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(
    existingFeedback?.rating ?? null
  );
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategory[]>(
    existingFeedback?.categories ?? []
  );
  const [comment, setComment] = useState(existingFeedback?.comment ?? "");
  const [showNegativeForm, setShowNegativeForm] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingFeedback);

  const handlePositive = useCallback(() => {
    setRating("helpful");
    setShowNegativeForm(false);
    setSubmitted(true);
    onSubmit({ message_id: messageId, rating: "helpful" });
  }, [messageId, onSubmit]);

  const handleNegative = useCallback(() => {
    setRating("not_helpful");
    setShowNegativeForm(true);
  }, []);

  const toggleCategory = useCallback((cat: FeedbackCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const handleNegativeSubmit = useCallback(() => {
    setSubmitted(true);
    setShowNegativeForm(false);
    onSubmit({
      message_id: messageId,
      rating: "not_helpful",
      categories: selectedCategories.length ? selectedCategories : undefined,
      comment: comment.trim() || undefined,
    });
  }, [messageId, selectedCategories, comment, onSubmit]);

  return (
    <div className="mt-2.5 pt-2.5 border-t border-border">
      <div className="flex items-center gap-2">
        <button
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border transition-all duration-150 cursor-pointer ${
            rating === "helpful"
              ? "bg-emerald-500/15 text-emerald-400 border-transparent"
              : "bg-transparent text-muted-foreground border-border hover:bg-muted"
          }`}
          onClick={handlePositive}
          disabled={submitted && rating === "helpful"}
        >
          ▲ Helpful
        </button>

        <button
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border transition-all duration-150 cursor-pointer ${
            rating === "not_helpful"
              ? "bg-red-500/15 text-red-400 border-transparent"
              : "bg-transparent text-muted-foreground border-border hover:bg-muted"
          }`}
          onClick={handleNegative}
          disabled={submitted}
        >
          ▼ Not helpful
        </button>

        {submitted && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            Thank you for your feedback
          </span>
        )}
      </div>

      {showNegativeForm && !submitted && (
        <div className="mt-2.5 p-3 bg-muted/50 rounded-lg">
          <p className="text-[11px] text-muted-foreground mb-2">
            What could be improved?
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {FEEDBACK_CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                className={`px-2 py-0.5 rounded text-[10px] border transition-all duration-150 cursor-pointer ${
                  selectedCategories.includes(value)
                    ? "bg-red-500/15 text-red-400 border-transparent"
                    : "bg-card text-muted-foreground border-border"
                }`}
                onClick={() => toggleCategory(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional: add a note..."
              className="flex-1 h-8 px-2.5 text-[11px] bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              onKeyDown={(e) => e.key === "Enter" && handleNegativeSubmit()}
            />
            <button
              className="h-8 px-3 text-[11px] font-medium bg-foreground text-background rounded hover:bg-foreground/80 transition-colors duration-150 cursor-pointer"
              onClick={handleNegativeSubmit}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
