import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useCreateChannel } from "../../api";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";

interface CreateChannelModalProps {
  onClose: () => void;
}

export function CreateChannelModal({ onClose }: CreateChannelModalProps) {
  const { t } = useTranslation("commons");
  const navigate = useNavigate();
  const createChannel = useCreateChannel();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"topic" | "custom">("topic");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [error, setError] = useState<string | null>(null);

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError(null);

    createChannel.mutate(
      { name, slug, description: description || undefined, type, visibility },
      {
        onSuccess: (channel) => {
          navigate(`/commons/${channel.slug}`);
          onClose();
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : t("creation.channel.failed");
          setError(message);
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("creation.channel.title")}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("creation.channel.cancel")}
          </button>
          <button
            type="submit"
            form="create-channel-form"
            className="btn btn-primary"
            disabled={!slug || createChannel.isPending}
          >
            {createChannel.isPending
              ? t("creation.channel.creating")
              : t("creation.channel.create")}
          </button>
        </>
      }
    >
      <form id="create-channel-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{t("creation.channel.name")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("creation.channel.namePlaceholder")}
            autoFocus
            className="form-input"
          />
          {slug && (
            <p className="form-helper">
              {t("creation.channel.slug")}{" "}
              <span className="font-mono">#{slug}</span>
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            {t("creation.channel.description")}{" "}
            <span style={{ color: "var(--text-ghost)" }}>
              {t("creation.channel.optional")}
            </span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("creation.channel.descriptionPlaceholder")}
            rows={2}
            className="form-input form-textarea"
          />
        </div>

        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">{t("creation.channel.type")}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "topic" | "custom")}
              className="form-input form-select"
            >
              <option value="topic">{t("creation.channel.types.topic")}</option>
              <option value="custom">
                {t("creation.channel.types.custom")}
              </option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">
              {t("creation.channel.visibility")}
            </label>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as "public" | "private")
              }
              className="form-input form-select"
            >
              <option value="public">
                {t("creation.channel.visibilityValues.public")}
              </option>
              <option value="private">
                {t("creation.channel.visibilityValues.private")}
              </option>
            </select>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
