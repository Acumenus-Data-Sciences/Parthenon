import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Megaphone, BookOpen } from "lucide-react";
import { useChannels, useChannel, useMessages, useSendMessage, useMarkRead, useMembers, useUploadAttachment } from "../api";
import { usePresence } from "../hooks/usePresence";
import { useChannelSubscription } from "../hooks/useEcho";
import { useTypingIndicator } from "../hooks/useTypingIndicator";
import { useAuthStore } from "@/stores/authStore";
import { ChannelList } from "./sidebar/ChannelList";
import { OnlineUsers } from "./sidebar/OnlineUsers";
import { MessageList } from "./chat/MessageList";
import { MessageComposer } from "./chat/MessageComposer";
import { RightPanel } from "./rightpanel/RightPanel";
import { NotificationBell } from "./sidebar/NotificationBell";
import { AnnouncementBoard } from "./announcements/AnnouncementBoard";
import { WikiPage } from "./wiki/WikiPage";
import AskAbbyChannel from "./abby/AskAbbyChannel";
import AbbyMentionHandler from "./abby/AbbyMentionHandler";

export function CommonsLayout() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const activeSlug = slug ?? "general";
  const isAskAbby = activeSlug === "ask-abby";
  const channelSlug = isAskAbby ? "" : activeSlug;
  const user = useAuthStore((s) => s.user);

  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const { data: channel } = useChannel(channelSlug);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(channelSlug);
  const { data: members = [] } = useMembers(channelSlug);
  const sendMessage = useSendMessage();
  const uploadAttachment = useUploadAttachment();
  const markRead = useMarkRead();
  const onlineUsers = usePresence();
  const { isTyping, sendTypingWhisper } = useTypingIndicator(channel?.id);
  const [rightTab, setRightTab] = useState<"search" | "settings" | "members" | "activity" | "pinned" | "reviews">("activity");
  const [view, setView] = useState<"chat" | "announcements" | "wiki">("chat");

  // Subscribe to real-time events for the active channel
  useChannelSubscription(channel?.id, channelSlug);

  // Mark channel as read when viewed
  useEffect(() => {
    if (channelSlug) {
      markRead.mutate(activeSlug);
    }
  }, [activeSlug, channelSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /commons/general if no slug
  useEffect(() => {
    if (!slug && channels.length > 0) {
      navigate(`/commons/general`, { replace: true });
    }
  }, [slug, channels, navigate]);

  function handleSend(body: string, references?: { type: string; id: number; name: string }[], files?: File[]) {
    sendMessage.mutate(
      { slug: activeSlug, body, references },
      {
        onSuccess: (message) => {
          if (files && files.length > 0) {
            for (const file of files) {
              uploadAttachment.mutate({
                slug: activeSlug,
                messageId: message.id,
                file,
              });
            }
          }
        },
      },
    );
  }

  // Check if current user is admin/owner in this channel
  const currentMember = members.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  return (
    <div className="layout-full-bleed flex h-full">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r border-white/[0.04] bg-[#101014]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Commons</h1>
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-y-auto">
          {channelsLoading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <ChannelList channels={channels} activeSlug={activeSlug} />
          )}
          <button
            onClick={() => setView(view === "announcements" ? "chat" : "announcements")}
            className={`mx-2 mt-2 flex w-[calc(100%-16px)] items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors ${
              view === "announcements"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Announcements
          </button>
          <button
            onClick={() => setView(view === "wiki" ? "chat" : "wiki")}
            className={`mx-2 mt-1 flex w-[calc(100%-16px)] items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors ${
              view === "wiki"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Knowledge Base
          </button>
        </div>
        <OnlineUsers users={onlineUsers} />
      </div>

      {/* Center content area */}
      <div className="flex flex-1 flex-col">
        {isAskAbby ? (
          <AskAbbyChannel />
        ) : view === "announcements" ? (
          <AnnouncementBoard channelSlug={activeSlug} />
        ) : view === "wiki" ? (
          <WikiPage />
        ) : (
          <>
            <MessageList
              messages={messages}
              isLoading={messagesLoading}
              slug={activeSlug}
              currentUserId={user?.id ?? 0}
              isAdmin={isAdmin}
              isTyping={isTyping}
              lastReadAt={currentMember?.last_read_at}
            />
            {channel && (
              <AbbyMentionHandler
                channelId={String(channel.id)}
                channelName={channel.name}
              />
            )}
            {channel && (
              <MessageComposer
                channelName={channel.slug}
                onSend={handleSend}
                disabled={sendMessage.isPending}
                onKeyDown={sendTypingWhisper}
                members={members}
              />
            )}
          </>
        )}
      </div>

      {/* Right panel — hidden when Ask Abby is active */}
      {!isAskAbby && (
        <RightPanel
          slug={activeSlug}
          activeTab={rightTab}
          onTabChange={setRightTab}
          members={members}
          channel={channel}
          currentMember={currentMember}
        />
      )}
    </div>
  );
}
