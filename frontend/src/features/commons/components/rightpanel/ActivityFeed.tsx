import {
  Activity,
  UserPlus,
  Pin,
  ClipboardCheck,
  FileUp,
  Hash,
  Zap,
} from "lucide-react";
import { useActivities } from "../../api";
import { avatarColor } from "../../utils/avatarColor";

interface ActivityFeedProps {
  slug: string;
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  member_joined: UserPlus,
  message_pinned: Pin,
  review_created: ClipboardCheck,
  review_resolved: ClipboardCheck,
  channel_created: Hash,
  file_shared: FileUp,
};

const EVENT_COLORS: Record<string, string> = {
  member_joined: "text-green-400 bg-green-400/10",
  message_pinned: "text-amber-400 bg-amber-400/10",
  review_created: "text-blue-400 bg-blue-400/10",
  review_resolved: "text-teal-400 bg-teal-400/10",
  channel_created: "text-purple-400 bg-purple-400/10",
  file_shared: "text-orange-400 bg-orange-400/10",
};

export function ActivityFeed({ slug }: ActivityFeedProps) {
  const { data: activities = [], isLoading } = useActivities(slug);

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-full bg-white/[0.03] p-4">
          <Zap className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <div>
          <p className="text-[13px] text-muted-foreground/70">No activity yet</p>
          <p className="text-[11px] text-muted-foreground/40 mt-1">
            Channel events will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {activities.map((item) => {
        const Icon = EVENT_ICONS[item.event_type] ?? Activity;
        const colorClass = EVENT_COLORS[item.event_type] ?? "text-muted-foreground bg-muted";
        const time = new Date(item.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
            <div className={`mt-0.5 rounded-full p-1.5 ${colorClass}`}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {item.user && (
                  <div
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold text-white"
                    style={{ backgroundColor: avatarColor(item.user.id) }}
                  >
                    {item.user.name[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-foreground">{item.title}</span>
              </div>
              {item.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              )}
              <span className="text-[10px] text-muted-foreground">{time}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
