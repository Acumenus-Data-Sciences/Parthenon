import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useCreateChannel } from "../../api";
import { useNavigate } from "react-router-dom";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Create Channel</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. data-quality"
              autoFocus
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {slug && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Slug: <span className="font-mono">#{slug}</span>
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-foreground">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "topic" | "custom")}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="topic">Topic</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-foreground">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!slug || createChannel.isPending}
              className="rounded bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createChannel.isPending ? "Creating..." : "Create Channel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
