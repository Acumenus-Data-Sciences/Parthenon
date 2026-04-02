import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { useCreateDirectMessage, useDirectMessageUserSearch } from "../../api";
import { UserAvatar } from "../UserAvatar";

interface CreateDirectMessageModalProps {
  onClose: () => void;
}

export function CreateDirectMessageModal({
  onClose,
}: CreateDirectMessageModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const createDm = useCreateDirectMessage();
  const { data: users = [], isLoading } = useDirectMessageUserSearch(query);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;

    createDm.mutate(selectedUserId, {
      onSuccess: (channel) => {
        navigate(`/commons/${channel.slug}`);
        onClose();
      },
      onError: () => {
        toast.error("Failed to start direct message");
      },
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Message"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-dm-form"
            className="btn btn-primary"
            disabled={!selectedUserId || createDm.isPending}
          >
            {createDm.isPending ? "Starting…" : "Message"}
          </button>
        </>
      }
    >
      <form id="create-dm-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="form-group">
          <label className="form-label">Find a teammate</label>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedUserId(null);
            }}
            placeholder="Search by name or email"
            className="form-input"
          />
        </div>

        {query.trim().length < 2 ? (
          <p className="text-xs text-muted-foreground">
            Type at least 2 characters to search users.
          </p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">Searching…</p>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground">No users found.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-muted/30">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                  selectedUserId === user.id
                    ? "bg-primary/15"
                    : "hover:bg-muted"
                }`}
              >
                <UserAvatar user={user} />
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <p className="text-xs text-muted-foreground">
            Starting a conversation with{" "}
            <span className="font-medium text-foreground">{selectedUser.name}</span>.
          </p>
        )}
      </form>
    </Modal>
  );
}
