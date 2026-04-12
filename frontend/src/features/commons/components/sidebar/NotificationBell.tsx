import { useState, useRef, useEffect } from "react";
import { Bell, MessageSquare, AtSign, ClipboardCheck, Reply } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { useNotifications, useUnreadNotificationCount, useMarkNotificationsRead } from "../../api";
import { UserAvatar } from "../UserAvatar";
import type { CommonsNotification } from "../../types";

const PANEL_WIDTH = 384;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data: count = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      if (!panelRef.current || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.max(12, rect.right - PANEL_WIDTH);
      const top = rect.bottom + 10;
      panelRef.current.style.left = `${left}px`;
      panelRef.current.style.top = `${top}px`;
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  function handleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void refetch();
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
    <div ref={triggerRef} className="relative">
      <Button
        onClick={handleOpen}
        variant="ghost"
        size="sm"
        icon
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[220] w-96 overflow-hidden rounded-2xl border border-white/10 bg-surface-overlay shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-black/35 backdrop-blur-xl"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/90">
              Notifications
            </span>
            {notifications.some((n) => !n.read_at) && (
              <button
                onClick={() => markRead.mutate(undefined)}
                className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[28rem] overflow-y-auto bg-surface-overlay">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
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
        </div>,
        document.body,
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
      className={`flex w-full items-start gap-2.5 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
        isUnread ? "bg-primary/8" : "bg-transparent"
      }`}
    >
      {n.actor ? (
        <UserAvatar user={n.actor} size="sm" />
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
