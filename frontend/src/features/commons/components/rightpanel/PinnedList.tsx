import { X } from "lucide-react";
import { usePins, useUnpinMessage } from "../../api";

interface PinnedListProps {
  slug: string;
}

export function PinnedList({ slug }: PinnedListProps) {
  const { data: pins = [], isLoading } = usePins(slug);
  const unpin = useUnpinMessage();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading pins...</p>
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-[13px] font-medium text-muted-foreground">No pinned messages</p>
        <p className="text-xs text-muted-foreground/60">
          Pin important messages from the action menu
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 space-y-2">
        {pins.map((pin) => (
          <div
            key={pin.id}
            className="group relative rounded-md border border-border bg-card p-2.5"
          >
            <div className="text-xs font-medium text-foreground line-clamp-2">
              {pin.message.body}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {pin.message.user.name} · Pinned{" "}
              {new Date(pin.pinned_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
            <button
              onClick={() => unpin.mutate({ slug, pinId: pin.id })}
              title="Unpin"
              className="absolute top-1.5 right-1.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
