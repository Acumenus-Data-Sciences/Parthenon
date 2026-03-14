import { useEffect, useRef, useState, useCallback } from "react";
import { getEcho } from "@/lib/echo";

/**
 * Manages typing indicator whispers on the private channel.
 * Returns { isTyping, sendTypingWhisper }.
 * - isTyping: true when any remote user is typing
 * - sendTypingWhisper: call on keydown in the composer (debounced internally)
 */
export function useTypingIndicator(channelId: number | undefined) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWhisperRef = useRef(0);

  useEffect(() => {
    if (!channelId) return;
    const echo = getEcho();
    if (!echo) return;

    const channelName = `commons.channel.${channelId}`;
    const channel = echo.private(channelName);

    channel.listenForWhisper("typing", () => {
      setIsTyping(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    });

    return () => {
      // Only detach the whisper listener — do NOT call echo.leave()
      // because useChannelSubscription manages the channel lifecycle
      channel.stopListeningForWhisper("typing");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsTyping(false);
    };
  }, [channelId]);

  const sendTypingWhisper = useCallback(() => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastWhisperRef.current < 3000) return; // debounce 3s
    lastWhisperRef.current = now;

    const echo = getEcho();
    if (!echo) return;

    echo.private(`commons.channel.${channelId}`).whisper("typing", {});
  }, [channelId]);

  return { isTyping, sendTypingWhisper };
}
