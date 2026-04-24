import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreateCohortFromIntersection } from "../hooks";
import type { ConditionBundle, IntersectionMode } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceId: number;
  bundleIds: number[];
  bundles: Pick<ConditionBundle, "id" | "bundle_code" | "condition_name">[];
  mode: IntersectionMode;
  intersectionCount: number;
}

export function IntersectionCohortDialog({
  isOpen,
  onClose,
  sourceId,
  bundleIds,
  bundles,
  mode,
  intersectionCount,
}: Props) {
  const navigate = useNavigate();
  const mutation = useCreateCohortFromIntersection();

  const defaultName = buildDefaultName(bundles, bundleIds, mode);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cohort = await mutation.mutateAsync({
      source_id: sourceId,
      bundle_ids: bundleIds,
      mode,
      name: name.trim() || defaultName,
      description: description.trim() || null,
    });
    onClose();
    navigate(`/cohort-definitions/${cohort.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-xl border border-border-default bg-surface-raised p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Save intersection as cohort
            </h2>
            <p className="mt-1 text-xs text-text-ghost">
              {intersectionCount.toLocaleString()} qualified persons will be
              materialized into a new cohort definition.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-ghost hover:bg-surface-overlay"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
            Name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
          />
        </label>

        {mutation.isError && (
          <p className="rounded-lg border border-red-900 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {(mutation.error as Error).message}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-default px-3 py-2 text-sm text-text-muted hover:bg-surface-overlay"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Create cohort
          </button>
        </div>
      </form>
    </div>
  );
}

function buildDefaultName(
  bundles: Pick<ConditionBundle, "id" | "bundle_code" | "condition_name">[],
  bundleIds: number[],
  mode: IntersectionMode,
): string {
  const codes = bundles
    .filter((b) => bundleIds.includes(b.id))
    .map((b) => b.bundle_code);
  const joiner = mode === "any" ? " ∪ " : mode === "exactly" ? " = " : " ∩ ";
  return codes.join(joiner);
}
