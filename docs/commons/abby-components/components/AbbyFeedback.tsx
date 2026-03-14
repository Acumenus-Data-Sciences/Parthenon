/**
 * AbbyFeedback
 *
 * Two-state feedback widget for Abby responses:
 * - Positive: single click "Helpful" → done
 * - Negative: expands to show category tags + optional comment
 *
 * Feedback is stored in commons_abby_feedback and used for
 * response quality analytics and continuous improvement.
 */

import { useState, useCallback } from 'react';
import type {
  AbbyFeedbackProps,
  FeedbackRating,
  FeedbackCategory,
} from '../types/abby';

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'inaccurate_recall', label: 'Inaccurate recall' },
  { value: 'wrong_source', label: 'Wrong source cited' },
  { value: 'missing_context', label: 'Missing context' },
  { value: 'too_verbose', label: 'Too verbose' },
  { value: 'hallucination', label: 'Made something up' },
  { value: 'other', label: 'Other' },
];

export default function AbbyFeedback({
  messageId,
  existingFeedback,
  onSubmit,
}: AbbyFeedbackProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(
    existingFeedback?.rating ?? null
  );
  const [selectedCategories, setSelectedCategories] = useState<
    FeedbackCategory[]
  >(existingFeedback?.categories ?? []);
  const [comment, setComment] = useState(existingFeedback?.comment ?? '');
  const [showNegativeForm, setShowNegativeForm] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingFeedback);

  const handlePositive = useCallback(() => {
    setRating('helpful');
    setShowNegativeForm(false);
    setSubmitted(true);
    onSubmit({ message_id: messageId, rating: 'helpful' });
  }, [messageId, onSubmit]);

  const handleNegative = useCallback(() => {
    setRating('not_helpful');
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
      rating: 'not_helpful',
      categories: selectedCategories.length ? selectedCategories : undefined,
      comment: comment.trim() || undefined,
    });
  }, [messageId, selectedCategories, comment, onSubmit]);

  return (
    <div className="mt-2.5 pt-2.5 border-t border-zinc-200/60 dark:border-zinc-700/60">
      {/* Rating buttons */}
      <div className="flex items-center gap-2">
        <button
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px]
            border transition-all duration-150 cursor-pointer
            ${
              rating === 'helpful'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-transparent'
                : 'bg-transparent text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }
          `}
          onClick={handlePositive}
          disabled={submitted && rating === 'helpful'}
        >
          ▲ Helpful
        </button>

        <button
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px]
            border transition-all duration-150 cursor-pointer
            ${
              rating === 'not_helpful'
                ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-transparent'
                : 'bg-transparent text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }
          `}
          onClick={handleNegative}
          disabled={submitted}
        >
          ▼ Not helpful
        </button>

        {submitted && (
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-auto">
            Thank you for your feedback
          </span>
        )}
      </div>

      {/* Negative feedback expansion */}
      {showNegativeForm && !submitted && (
        <div className="mt-2.5 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-2">
            What could be improved?
          </p>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {FEEDBACK_CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                className={`
                  px-2 py-0.5 rounded text-[10px]
                  border transition-all duration-150 cursor-pointer
                  ${
                    selectedCategories.includes(value)
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-transparent'
                      : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  }
                `}
                onClick={() => toggleCategory(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Optional comment */}
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional: add a note..."
              className="
                flex-1 h-8 px-2.5 text-[11px]
                bg-white dark:bg-zinc-900
                border border-zinc-200 dark:border-zinc-700
                rounded
                text-zinc-700 dark:text-zinc-300
                placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                focus:outline-none focus:ring-1 focus:ring-blue-500/40
              "
              onKeyDown={(e) => e.key === 'Enter' && handleNegativeSubmit()}
            />
            <button
              className="
                h-8 px-3 text-[11px] font-medium
                bg-zinc-800 dark:bg-zinc-200
                text-white dark:text-zinc-800
                rounded
                hover:bg-zinc-700 dark:hover:bg-zinc-300
                transition-colors duration-150 cursor-pointer
              "
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
