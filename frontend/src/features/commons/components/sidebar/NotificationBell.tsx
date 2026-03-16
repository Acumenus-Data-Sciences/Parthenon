import { useState, useRef, useEffect } from "react";
import { Bell, MessageSquare, AtSign, ClipboardCheck, Reply } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications, useUnreadNotificationCount, useMarkNotificationsRead } from "../../api";
import { avatarColor } from "../../utils/avatarColor";
import type { CommonsNotification } from "../../types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data: count = 0 } = useUnreadNotificationCount();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleOpen() {
    setOpen(!open);
    if (!open && count > 0) {
      markRead.mutate(undefined);
    }
  }

  function handleClick(n: CommonsNotification) {
    // Mark just this notification as read
    if (!n.read_at) {
      markRead.mutate([n.id]);
    }
    if (n.channel) {
      const url = `/commons/${n.channel.slug}${n.message_id ? `?highlight=${n.message_id}` : ""}`;
      navigate(url);
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded-md border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            {notifications.some((n) => !n.read_at) && (
              <button
                onClick={() => markRead.mutate(undefined)}
                className="text-[10px] text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleClick(n)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  dm: MessageSquare,
  review_assigned: ClipboardCheck,
  review_resolved: ClipboardCheck,
  thread_reply: Reply,
};

function NotificationItem({
  notification: n,
  onClick,
}: {
  notification: CommonsNotification;
  onClick: () => void;
}) {
  const Icon = TYPE_ICON[n.type] ?? Bell;
  const isUnread = !n.read_at;
  const time = new Date(n.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
        isUnread ? "bg-primary/5" : ""
      }`}
    >
      {n.actor ? (
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ backgroundColor: avatarColor(n.actor.id) }}
        >
          {n.actor.name[0]?.toUpperCase()}
        </div>
      ) : (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs ${isUnread ? "font-semibold text-foreground" : "text-foreground/80"}`}>
            {n.title}
          </span>
        </div>
        {n.body && (
          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
            {n.body}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Icon className="h-2.5 w-2.5" />
          {n.channel && <span>#{n.channel.slug}</span>}
          <span>{time}</span>
        </div>
      </div>
      {isUnread && (
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
