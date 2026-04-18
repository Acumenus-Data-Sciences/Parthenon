import { useMemo, useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
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
  const { t } = useTranslation("commons");
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
        toast.error(t("creation.directMessage.failed"));
      },
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("creation.directMessage.title")}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("creation.directMessage.cancel")}
          </button>
          <button
            type="submit"
            form="create-dm-form"
            className="btn btn-primary"
            disabled={!selectedUserId || createDm.isPending}
          >
            {createDm.isPending
              ? t("creation.directMessage.starting")
              : t("creation.directMessage.message")}
          </button>
        </>
      }
    >
      <form id="create-dm-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="form-group">
          <label className="form-label">
            {t("creation.directMessage.teammate")}
          </label>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedUserId(null);
            }}
            placeholder={t("creation.directMessage.searchPlaceholder")}
            className="form-input"
          />
        </div>

        {query.trim().length < 2 ? (
          <p className="text-xs text-muted-foreground">
            {t("creation.directMessage.minChars")}
          </p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">
            {t("creation.directMessage.searching")}
          </p>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("creation.directMessage.noUsers")}
          </p>
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
                  <div className="truncate text-sm text-foreground">
                    {user.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <p className="text-xs text-muted-foreground">
            <Trans
              i18nKey="creation.directMessage.startingWith"
              ns="commons"
              values={{ name: selectedUser.name }}
              components={{
                name: <span className="font-medium text-foreground" />,
              }}
            />
          </p>
        )}
      </form>
    </Modal>
  );
}
