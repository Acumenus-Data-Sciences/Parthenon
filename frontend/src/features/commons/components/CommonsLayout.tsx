import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useChannels, useChannel, useMessages, useSendMessage, useMarkRead, useMembers } from "../api";
import { usePresence } from "../hooks/usePresence";
import { useChannelSubscription } from "../hooks/useEcho";
import { useTypingIndicator } from "../hooks/useTypingIndicator";
import { useAuthStore } from "@/stores/authStore";
import { ChannelList } from "./sidebar/ChannelList";
import { OnlineUsers } from "./sidebar/OnlineUsers";
import { ChannelHeader } from "./chat/ChannelHeader";
import { MessageList } from "./chat/MessageList";
import { MessageComposer } from "./chat/MessageComposer";
import { RightPanel } from "./rightpanel/RightPanel";

export function CommonsLayout() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const activeSlug = slug ?? "general";
  const user = useAuthStore((s) => s.user);

  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const { data: channel } = useChannel(activeSlug);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeSlug);
  const { data: members = [] } = useMembers(activeSlug);
  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const onlineUsers = usePresence();
  const { isTyping, sendTypingWhisper } = useTypingIndicator(channel?.id);
  const [rightTab, setRightTab] = useState("pinned");

  // Subscribe to real-time events for the active channel
  useChannelSubscription(channel?.id, activeSlug);

  // Mark channel as read when viewed
  useEffect(() => {
    if (activeSlug) {
      markRead.mutate(activeSlug);
    }
  }, [activeSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /commons/general if no slug
  useEffect(() => {
    if (!slug && channels.length > 0) {
      navigate(`/commons/general`, { replace: true });
    }
  }, [slug, channels, navigate]);

  function handleSend(body: string, references?: { type: string; id: number; name: string }[]) {
    sendMessage.mutate({ slug: activeSlug, body, references });
  }

  // Check if current user is admin/owner in this channel
  const currentMember = members.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  return (
    <div className="layout-full-bleed flex h-full">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="shrink-0 border-b border-border px-4 py-4">
          <h1 className="text-base font-bold text-foreground">Commons</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {channelsLoading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <ChannelList channels={channels} activeSlug={activeSlug} />
          )}
        </div>
        <OnlineUsers users={onlineUsers} />
      </div>

      {/* Center chat area */}
      <div className="flex flex-1 flex-col">
        {channel && (
          <ChannelHeader
            channel={channel}
            onToggleTab={(tab) => setRightTab(rightTab === tab ? tab : tab)}
          />
        )}
        <MessageList
          messages={messages}
          isLoading={messagesLoading}
          slug={activeSlug}
          currentUserId={user?.id ?? 0}
          isAdmin={isAdmin}
          isTyping={isTyping}
        />
        {channel && (
          <MessageComposer
            channelName={channel.slug}
            onSend={handleSend}
            disabled={sendMessage.isPending}
            onKeyDown={sendTypingWhisper}
            members={members}
          />
        )}
      </div>

      {/* Right panel */}
      <RightPanel
        slug={activeSlug}
        activeTab={rightTab}
        onTabChange={setRightTab}
        members={members}
        channel={channel}
        currentMember={currentMember}
      />
    </div>
  );
}
