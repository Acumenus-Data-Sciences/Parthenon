import { useDeleteMessage } from "../../api";

interface DeleteConfirmationProps {
  messageId: number;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteConfirmation({
  messageId,
  onCancel,
  onDeleted,
}: DeleteConfirmationProps) {
  const deleteMessage = useDeleteMessage();

  function handleDelete() {
    deleteMessage.mutate(messageId, {
      onSuccess: () => onDeleted(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
        <h3 className="text-base font-semibold text-foreground">
          Delete this message?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This message will be removed from the conversation.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMessage.isPending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
