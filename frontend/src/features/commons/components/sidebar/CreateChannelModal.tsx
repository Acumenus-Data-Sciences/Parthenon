import { useState, type FormEvent } from "react";
import { useCreateChannel } from "../../api";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";

interface CreateChannelModalProps {
  onClose: () => void;
}

export function CreateChannelModal({ onClose }: CreateChannelModalProps) {
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
            err instanceof Error ? err.message : "Failed to create channel";
          setError(message);
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create Channel"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-channel-form"
            className="btn btn-primary"
            disabled={!slug || createChannel.isPending}
          >
            {createChannel.isPending ? "Creating…" : "Create Channel"}
          </button>
        </>
      }
    >
      <form id="create-channel-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Channel Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. data-quality"
            autoFocus
            className="form-input"
          />
          {slug && (
            <p className="form-helper">
              Slug: <span className="font-mono">#{slug}</span>
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Description <span style={{ color: "var(--text-ghost)" }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this channel about?"
            rows={2}
            className="form-input form-textarea"
          />
        </div>

        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "topic" | "custom")}
              className="form-input form-select"
            >
              <option value="topic">Topic</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "private")}
              className="form-input form-select"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
