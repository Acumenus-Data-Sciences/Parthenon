const RECENT_WINDOW_MS = 8000;

const recentlyToastedMessageIds = new Map<number, number>();

function prune(now: number): void {
  for (const [messageId, timestamp] of recentlyToastedMessageIds.entries()) {
    if (now - timestamp > RECENT_WINDOW_MS) {
      recentlyToastedMessageIds.delete(messageId);
    }
  }
}

export function markCommonsMessageToast(messageId: number | null | undefined): void {
  if (!messageId) return;
  const now = Date.now();
  prune(now);
  recentlyToastedMessageIds.set(messageId, now);
}

export function hasRecentCommonsMessageToast(messageId: number | null | undefined): boolean {
  if (!messageId) return false;
  const now = Date.now();
  prune(now);
  const timestamp = recentlyToastedMessageIds.get(messageId);
  return timestamp !== undefined && now - timestamp <= RECENT_WINDOW_MS;
}
