import type { RequiresPromotionPayload } from "../types";

interface Props {
  payload: RequiresPromotionPayload;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function AutoPromoteModal({
  payload,
  onConfirm,
  onCancel,
  isPending,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60"
    >
      <div className="w-full max-w-md rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">
          Promote draft to Active?
        </h2>
        <p className="mt-3 text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">
            "{payload.item_name}"
          </span>{" "}
          is a draft. Promoting it will make it visible to your Study
          collaborators.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded bg-rose-700 px-3 py-1.5 text-sm text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {isPending ? "Promoting…" : "Promote & Attach"}
          </button>
        </div>
      </div>
    </div>
  );
}
