import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useChannels, useChannel, useMessages, useSendMessage, useMarkRead } from "../api";
import { usePresence } from "../hooks/usePresence";
import { useChannelSubscription } from "../hooks/useEcho";
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

  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const { data: channel } = useChannel(activeSlug);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeSlug);
  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const onlineUsers = usePresence();

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

  function handleSend(body: string) {
    sendMessage.mutate({ slug: activeSlug, body });
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="p-4">
          <h1 className="text-lg font-bold text-foreground">Commons</h1>
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
        {channel && <ChannelHeader channel={channel} />}
        <MessageList messages={messages} isLoading={messagesLoading} />
        {channel && (
          <MessageComposer
            channelName={channel.slug}
            onSend={handleSend}
            disabled={sendMessage.isPending}
          />
        )}
      </div>

      {/* Right panel */}
      <RightPanel />
    </div>
  );
}
