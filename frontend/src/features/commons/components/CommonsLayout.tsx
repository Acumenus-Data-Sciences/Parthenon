import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Megaphone, BookOpen, Sparkles, Hash, Users, Phone, Video } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { useChannels, useChannel, useMessages, useSendMessage, useMarkRead, useMembers, useUploadAttachment, useActiveCall, useStartCall, useEndCall } from "../api";
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
import { CallBanner } from "./calls/CallBanner";
import { CommonsCallModal } from "./calls/CommonsCallModal";
import { WhatsNewModal } from "@/features/help";

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
  const { data: activeCall } = useActiveCall(channelSlug);
  const sendMessage = useSendMessage();
  const uploadAttachment = useUploadAttachment();
  const markRead = useMarkRead();
  const startCall = useStartCall();
  const endCall = useEndCall();
  const onlineUsers = usePresence();
  const { isTyping, sendTypingWhisper } = useTypingIndicator(channel?.id);
  const [rightTab, setRightTab] = useState<"search" | "settings" | "members" | "activity" | "pinned" | "reviews">("activity");
  const [view, setView] = useState<"chat" | "announcements" | "wiki">("chat");
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);

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
  const activePresenceCount = onlineUsers.filter((presenceUser) => presenceUser.status === "active").length;

  useEffect(() => {
    if (!activeCall && callModalOpen) {
      setCallModalOpen(false);
    }
  }, [activeCall, callModalOpen]);

  function handleStartCall() {
    startCall.mutate(
      { slug: activeSlug, callType: "video" },
      {
        onSuccess: () => {
          setCallModalOpen(true);
        },
        onError: () => {
          toast.error("Unable to start LiveKit call");
        },
      },
    );
  }

  function handleJoinCall() {
    if (!activeCall) return;
    setCallModalOpen(true);
  }

  function handleEndCall() {
    endCall.mutate(
      { slug: activeSlug },
      {
        onSuccess: () => {
          setCallModalOpen(false);
        },
        onError: () => {
          toast.error("Unable to end LiveKit call");
        },
      },
    );
  }

  return (
    <div className="layout-full-bleed flex h-full gap-3 bg-[#0b0b0e] p-3">
      {/* Left sidebar */}
      <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
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
            onClick={() => setWhatsNewOpen(true)}
            className="mx-2 mt-2 flex w-[calc(100%-16px)] items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.03] hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5" />
            What's New
          </button>
          <button
            onClick={() => setView(view === "announcements" ? "chat" : "announcements")}
            className={`mx-2 mt-1 flex w-[calc(100%-16px)] items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              view === "announcements"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Announcements
          </button>
          <button
            onClick={() => setView(view === "wiki" ? "chat" : "wiki")}
            className={`mx-2 mt-1 flex w-[calc(100%-16px)] items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              view === "wiki"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Knowledge Base
          </button>
        </div>
        <OnlineUsers users={onlineUsers} />
      </div>

      {/* Center content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-default bg-[#121216] shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
        {isAskAbby ? (
          <AskAbbyChannel />
        ) : view === "announcements" ? (
          <AnnouncementBoard channelSlug={activeSlug} />
        ) : view === "wiki" ? (
          <WikiPage />
        ) : (
          <>
            <div className="border-b border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_42%),#15151a] px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#2a2a31] bg-[#1a1a20] text-primary">
                      <Hash className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                        Commons Channel
                      </p>
                      <h2 className="truncate text-[18px] font-semibold tracking-tight text-foreground">
                        # {channel?.name ?? activeSlug}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-2 max-w-3xl text-[12px] leading-6 text-muted-foreground">
                    {channel?.description || "Discuss ideas, share files, and collaborate with the rest of the Commons."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-3 rounded-xl border border-[#2a2a31] bg-[#111115] px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Members</span>
                      <span className="text-sm font-semibold text-foreground">{members.length}</span>
                    </div>
                    <div className="h-4 w-px bg-white/[0.08]" />
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Active</span>
                      <span className="text-sm font-semibold text-foreground">{activePresenceCount}</span>
                    </div>
                  </div>
                  {!activeCall ? (
                    <button
                      type="button"
                      onClick={handleStartCall}
                      disabled={startCall.isPending}
                      className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Video className="h-4 w-4" />
                      {startCall.isPending ? "Starting..." : "Start call"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleJoinCall}
                        className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-400"
                      >
                        <Phone className="h-4 w-4" />
                        Join call
                      </button>
                      <button
                        type="button"
                        onClick={handleEndCall}
                        disabled={endCall.isPending}
                        className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:opacity-50"
                      >
                        {endCall.isPending ? "Ending..." : "End"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {activeCall && (
              <CallBanner
                call={activeCall}
                onJoin={handleJoinCall}
                onEnd={handleEndCall}
                ending={endCall.isPending}
              />
            )}
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

      {/* Right panel — hidden when Ask Abby or Wiki is active */}
      {!isAskAbby && view !== "wiki" && (
        <RightPanel
          slug={activeSlug}
          activeTab={rightTab}
          onTabChange={setRightTab}
          members={members}
          presenceUsers={onlineUsers}
          channel={channel}
          currentMember={currentMember}
        />
      )}

      <WhatsNewModal
        externalOpen={whatsNewOpen}
        onExternalClose={() => setWhatsNewOpen(false)}
      />
      <CommonsCallModal
        open={callModalOpen}
        slug={activeSlug}
        call={activeCall ?? null}
        onClose={() => setCallModalOpen(false)}
      />
    </div>
  );
}
