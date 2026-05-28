import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { LifecycleAction } from "./LifecycleActionMenu";

interface Props {
  open: boolean;
  action: LifecycleAction;
  /** Single item OR plural batch — controls copy. */
  count?: number;
  /** Item name when count === 1. Optional. */
  itemName?: string | null;
  /** Domain noun for plural copy. Defaults to "items". */
  itemNoun?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const COPY: Record<
  LifecycleAction,
  {
    title: string;
    bodyOne: (name: string) => string;
    bodyMany: (n: number, noun: string) => string;
    cta: string;
    variant: "primary" | "danger";
    helper: string;
  }
> = {
  promote: {
    title: "Promote to Active",
    bodyOne: (n) =>
      `Promoting "${n}" makes it broadly visible and reusable across studies. Drafts are private; active items are not.`,
    bodyMany: (n, noun) =>
      `Promote ${n} ${noun} to Active. They become broadly visible and reusable across studies.`,
    cta: "Promote",
    variant: "primary",
    helper: "You can archive an active item later if needed.",
  },
  archive: {
    title: "Archive",
    bodyOne: (n) =>
      `Archiving "${n}" hides it from the active library. It remains accessible to admins and can be restored.`,
    bodyMany: (n, noun) =>
      `Archive ${n} ${noun}. They will be hidden from the active library but can be restored.`,
    cta: "Archive",
    variant: "danger",
    helper:
      "Archiving does not delete the item. Use the Admin Library to hard-delete archived items.",
  },
  restore: {
    title: "Restore to Active",
    bodyOne: (n) =>
      `Restoring "${n}" returns it to the active library. It becomes broadly visible again.`,
    bodyMany: (n, noun) =>
      `Restore ${n} ${noun} to Active. They will return to the active library.`,
    cta: "Restore",
    variant: "primary",
    helper:
      "Studies that referenced this item before archival are not automatically re-linked.",
  },
};

export function LifecycleConfirmModal({
  open,
  action,
  count = 1,
  itemName,
  itemNoun = "items",
  isPending = false,
  onConfirm,
  onClose,
}: Props) {
  const copy = COPY[action];
  const isBatch = count > 1;
  const body = isBatch
    ? copy.bodyMany(count, itemNoun)
    : copy.bodyOne(itemName ?? "this item");

  return (
    <Modal
      open={open}
      onClose={isPending ? () => undefined : onClose}
      title={isBatch ? `${copy.title} ${count} ${itemNoun}` : copy.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={copy.variant}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Working…
              </>
            ) : (
              copy.cta
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-text-secondary">
        <p>{body}</p>
        <p className="text-xs text-text-muted">{copy.helper}</p>
      </div>
    </Modal>
  );
}
