import { X } from "lucide-react";
import { usePins, useUnpinMessage } from "../../api";
import { avatarColor } from "../../utils/avatarColor";

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
      {pins.map((pin) => (
        <div
          key={pin.id}
          className="group border-b border-border px-4 py-3 hover:bg-muted/30"
        >
          <div className="flex items-start gap-2">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(pin.message.user.id) }}
            >
              {pin.message.user.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  {pin.message.user.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(pin.message.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
                {pin.message.body}
              </p>
            </div>
            <button
              onClick={() => unpin.mutate({ slug, pinId: pin.id })}
              title="Unpin"
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
