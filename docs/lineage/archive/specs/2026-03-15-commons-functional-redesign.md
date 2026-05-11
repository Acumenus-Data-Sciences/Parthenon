# Commons Workspace — Functional Redesign Spec

**Date:** 2026-03-15
**Status:** Approved for implementation
**Scope:** 4 implementation areas + 1 verification area — seeder cleanup, header unification, Abby persistence, online presence verification. Wiki nav already implemented (see Area 2).

---

## Background

The Commons workspace is architecturally complete but has several UX problems:
- `CommonsChannelSeeder.php` seeds topic channels but no demo messages. The `CommonsLayout` also seeds `#general`, `#data-quality`, `#concept-sets` — this is fine. An `#announcements` channel should be added.
- The `ChannelHeader` (center column top bar) and `RightPanel` tab bar duplicate Pin, Search, Members, and Settings actions — two rows doing the same job
- Ask Abby conversations are lost on navigation: `AskAbbyChannel.tsx` uses local `useState` for `conversationId` which evaporates on unmount, even though the backend persists conversations correctly and the global `AbbyPanel` shares the same `useAbbyStore`
- Online user presence infrastructure exists and appears correctly wired — needs verification

---

## Area 1: Seeder Cleanup

**File:** `backend/database/seeders/CommonsChannelSeeder.php`

**Current state:** Seeds 3 channels — `general`, `data-quality`, `concept-sets` — with no fake messages. Idempotent via `firstOrCreate`.

**Change:** Add `#announcements` channel to the seed list. Keep the existing 3 channels.

**Channels after change:**
| slug | name | type | visibility | description |
|------|------|------|-----------|-------------|
| `general` | General | topic | public | General discussion for the team |
| `data-quality` | Data Quality | topic | public | Data quality discussions and DQD results |
| `concept-sets` | Concept Sets | topic | public | Concept set design and review |
| `announcements` | Announcements | topic | public | Platform announcements and updates |

**Implementation:** Add the `announcements` entry to the `$channels` array. The `firstOrCreate` pattern ensures this is safe on existing installs — existing channels and all their messages are untouched.

**Deployment:** `php artisan db:seed --class=CommonsChannelSeeder` (idempotent, safe to run on any install).

---

## Area 2: Wiki Navigation — Already Implemented ✓

`CommonsLayout.tsx` already contains both the Announcements and Knowledge Base (`BookOpen`) buttons in the left sidebar with correct active-state styling and `view` toggle behavior. **No code changes needed.** Implementation task: verify these links render correctly in production and the `WikiPage` and `AnnouncementBoard` components load data from real APIs.

---

## Area 3: Header Unification

**Problem:** `ChannelHeader` (center column top bar) shows `# channel-name`, description, and buttons for Pin, Search, Members count, Settings. `RightPanel` shows a tab bar with icons for Activity, Pinned, Search, Reviews, Members, Settings. Pin, Search, Members, and Settings are duplicated across both rows.

**Solution:** Delete `ChannelHeader`. Promote the channel name/description into the top of `RightPanel` as a unified header row that visually reads as a single bar spanning center + right panel.

### File Changes

**Delete:** `frontend/src/features/commons/components/chat/ChannelHeader.tsx`

**`CommonsLayout.tsx`:**
- Remove `ChannelHeader` import and the `{channel && <ChannelHeader ... />}` render block
- Remove `onToggleTab` prop threading (the `rightTab`/`setRightTab` wiring to the center column)
- The center `<div className="flex flex-1 flex-col">` now starts directly with `MessageList`
- Pass `channel` to `RightPanel` — **`channel?: Channel` prop already exists on `RightPanel`**

**`RightPanel.tsx`:**

Replace the current tab bar header (a row of 6 icon-only buttons) with a two-row header:

**Row 1 — unified identity bar:**
```
| # channel-name   short description          ⚡ 📌 🔍 📋 👥 ⚙ |
```
- Left: `# {channel.name}` (`text-[13px] font-semibold text-foreground`) + `{channel.description}` (`text-[11px] text-muted-foreground ml-2 truncate`)
- Right: the 6 tab icon buttons (same icons, same click handlers as current tab bar)
- When `channel` is undefined (loading or invalid slug): render a skeleton row — grey placeholder spans, no icons shown
- Clicking an icon activates that tab (same behavior as today's tab bar)
- Remove the separate tab bar row that currently sits below the header

**Undefined channel guard:**
```tsx
{channel ? (
  <>
    <span className="..."># {channel.name}</span>
    <span className="...">{channel.description}</span>
  </>
) : (
  <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
)}
```

**Visual result:**
- Center column gains ~38px of vertical space (the deleted header bar height)
- The right panel's top row IS the only channel identity + navigation row in the UI

---

## Area 4: Abby Conversation Persistence

### Current Architecture (before this change)

There are two Abby surfaces sharing `useAbbyStore`:
1. **`AbbyPanel.tsx`** — global sliding panel, opened from Header or keyboard shortcut (`Ctrl+Shift+A`). Fully wired to `useAbbyStore` for messages, conversationId, streaming, etc.
2. **`AskAbbyChannel.tsx`** — dedicated Commons channel view. Uses **local `useState`** for `conversationId: number | null` (line 186) and calls `listAbbyConversations()` / `fetchAbbyConversation()` directly — NOT through `useAbbyStore`. This local state is lost on navigation.

`useAbbyStore` consumers: `AbbyPanel.tsx`, `Header.tsx`, `CommandPalette.tsx`, `useGlobalKeyboard.ts`, `useAbbyContext.ts`.

### Backend (already complete, no changes)
- `abby_conversations` + `abby_messages` tables exist
- `GET /abby/conversations` → list, `GET /abby/conversations/{id}` → messages
- `POST /abby/chat` returns `conversation_id: number`
- `abbyService.ts` exports `listAbbyConversations()`, `fetchAbbyConversation(id: number)`, `queryAbby()`

### Change 1: Add persistence to `abbyStore.ts`

Add Zustand `persist` middleware. Persist **only** `conversationId` to `localStorage` (key: `parthenon-abby`). Do NOT persist `messages`, `conversationList`, `isStreaming`, or `streamingContent` — these are ephemeral session state.

**Type fix:** Change `conversationId: string | null` → `number | null` to align with the service layer (`fetchAbbyConversation(id: number)`). The following callsites in `AbbyPanel.tsx` must all be updated — a simple search for `setConversationId` will miss several:

| Line | Current code | Change to |
|------|-------------|-----------|
| 240 | `setConversationId(String(data.data.id))` | `setConversationId(data.data.id)` |
| 258 | `conversationId === String(conv.id)` | `conversationId === conv.id` |
| 357 | `setConversationId(parsed.conversation_id)` | ensure `parsed.conversation_id` is `number` (cast if needed) |
| 392 | `setConversationId(data.conversation_id)` | ensure `data.conversation_id` is `number` |
| 425 | `setConversationId(data.conversation_id)` | ensure `data.conversation_id` is `number` |
| 586 | `conversationId === String(conv.id)` | `conversationId === conv.id` |
| 593 | `conversationId === String(conv.id)` | `conversationId === conv.id` |

Also update `clearMessages` in the store (which calls `setConversationId(null)` internally — no type change needed there since `null` is valid for both).

The `POST /abby/chat` API response type for `conversation_id` must also be `number` (not `string`) in any TypeScript interface — update accordingly.

**Persistence config:**
```ts
persist(
  (set, get) => ({ ...storeDefinition }),
  {
    name: 'parthenon-abby',
    partialize: (state) => ({ conversationId: state.conversationId }),
  }
)
```

### Change 2: Wire `AskAbbyChannel.tsx` to the store

Replace local `conversationId` state with `useAbbyStore`:

**Remove:**
```ts
const [conversationId, setConversationId] = useState<number | null>(null);
```

**Add:**
```ts
const conversationId = useAbbyStore((s) => s.conversationId);
const setConversationId = useAbbyStore((s) => s.setConversationId);
```

**Behavioral change — explicit:** The existing mount effect (lines 202–247) auto-restores by calling `listAbbyConversations()` to find the most recent `commons_ask_abby` conversation, then fetches it — even when no ID is stored. The new mount effect below **deliberately removes this auto-discover logic**. After this change, the only restore mechanism is the persisted store ID. On a fresh browser (no `localStorage` entry), the user sees the empty/welcome state and suggested prompts. This is intentional — the `localStorage`-backed store is the single source of truth.

**Mount effect (replace existing):**
```ts
useEffect(() => {
  if (!conversationId) return; // no stored conversation — show empty state + prompts
  let cancelled = false;
  fetchAbbyConversation(conversationId)
    .then((conv) => {
      if (cancelled) return;
      // map AbbyConversationMessage[] → local Message[]
      const mapped = conv.messages.map((m) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
      setLocalMessages(mapped);
    })
    .catch(() => {
      // Stale/deleted conversation ID — clear store and show empty state
      if (!cancelled) {
        setConversationId(null);
        setLocalMessages([WELCOME_MESSAGE]);
      }
    });
  return () => { cancelled = true; };
}, []); // only on mount — conversationId comes from store (persisted)
```

**On send (existing `queryAbby` call):** after response, call `setConversationId(response.conversation_id)` (already done in current code on lines 307+, just now targets the store instead of local state).

**Note on message state:** `AskAbbyChannel` maintains its own local `conversation` array (`ConversationEntry[]`, declared at line 185) for the current session's chat display — this is correct and separate from `AbbyPanel`'s `messages` array in the store. The store's `messages` array is owned by `AbbyPanel`. Do NOT merge them — keep `AskAbbyChannel`'s messages as local state, using the store only for `conversationId` persistence.

### Change 3: Add conversation history panel to `AskAbbyChannel`

**New TanStack Query hook** in `frontend/src/features/commons/api.ts`:
```ts
export function useAbbyConversations() {
  return useQuery({
    queryKey: ['abby', 'conversations'],
    queryFn: listAbbyConversations,
    staleTime: 60_000,
  });
}
```

**History panel** — collapsible left sidebar inside `AskAbbyChannel`:
- Toggled by a `Clock` / `History` icon button in the Abby view header bar
- Width: `220px`, `bg-[#101014]`, `border-r border-white/[0.04]`
- Content: list of `ConversationSummary` items ordered by `created_at DESC`
- Each item: title (or `"Conversation — {date}"` if no title), relative timestamp
- Click: call `fetchAbbyConversation(id)`, map to local messages, call `setConversationId(id)`
- "New chat" button at top: `setConversationId(null)`, reset local `conversation` array to `[WELCOME_MESSAGE]`. **Shared state note:** `setConversationId(null)` writes to the shared store slot used by both `AskAbbyChannel` and `AbbyPanel`. If `AbbyPanel` is open simultaneously, it will also lose its active conversation context. This is intentional — one shared `conversationId` means both surfaces stay in sync. Acceptable trade-off given the surfaces are rarely open at the same time.
- State: `const [historyOpen, setHistoryOpen] = useState(false)` — local component state, not stored
- **Deprecated endpoint:** `fetchAbbyHistory()` in `abbyService.ts` (calls `/commons/abby/history`) — do not use this for the history panel; use `listAbbyConversations()` (`/abby/conversations`). Leave `fetchAbbyHistory` in place but unused.
- **Import note:** `useAbbyConversations()` in `api.ts` must import `listAbbyConversations` from `./services/abbyService` (the function already exists there). Add this import — `api.ts` does not currently import from `abbyService.ts`.

**Layout with history open:**
```
┌──────────────────────────────────────────────┐
│  Ask Abby                    [🕐] [+ New]    │  ← Abby header bar
├────────────┬─────────────────────────────────┤
│ Today      │  You: What cohort patterns...   │
│ › T2DM Q   │                                 │
│ › Washout  │  Abby: Based on the dataset...  │
│            │                                 │
│ This week  │  [Type a message...]            │
│ › CKD      │                                 │
└────────────┴─────────────────────────────────┘
```

---

## Area 5: Online Presence Verification

**Infrastructure:** `usePresence()` hook subscribes to `presence-commons.online` via Echo `.join()`, `OnlineUsers` component renders avatar strip at the bottom of the left sidebar, `CommonsLayout` passes `onlineUsers` down.

**Verification checklist (no code changes expected):**
1. `routes/channels.php` — confirm `Broadcast::channel('commons.online', ...)` returns `['id' => $user->id, 'name' => $user->name]` ✓ (confirmed present)
2. `usePresence.ts` — confirm `echo.join("commons.online")` (Echo adds `presence-` prefix automatically) ✓ (confirmed correct)
3. Functional test: log in as two different users in two browser tabs — both should appear in the online strip within ~2s

**If avatars show empty in production:** debug path is Reverb connectivity, not code — run `docker compose logs reverb` and check WebSocket handshake. Not a code bug.

---

## Out of Scope

- Real-time activity feed push (activities continue polling every 30s)
- Auto-generating Abby conversation titles from first message
- Mobile/responsive layout changes
- Notification push improvements
- `fetchAbbyHistory()` removal (leave in service file, simply unused)

---

## Files Changed

| File | Change |
|------|--------|
| `backend/database/seeders/CommonsChannelSeeder.php` | Add `announcements` channel |
| `frontend/src/features/commons/components/CommonsLayout.tsx` | Remove ChannelHeader render + import |
| `frontend/src/features/commons/components/chat/ChannelHeader.tsx` | **Delete** |
| `frontend/src/features/commons/components/rightpanel/RightPanel.tsx` | Replace tab bar header with unified channel name + icons row |
| `frontend/src/stores/abbyStore.ts` | Add `persist` middleware (localStorage, `conversationId` only); fix type `string → number` |
| `frontend/src/components/layout/AbbyPanel.tsx` | Update `conversationId` type callsites: `string → number` |
| `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx` | Replace local `conversationId` state with store; add history panel |
| `frontend/src/features/commons/api.ts` | Add `useAbbyConversations()` TanStack Query hook |

---

## Success Criteria

- [ ] `#general`, `#data-quality`, `#concept-sets`, `#announcements` all exist after running `CommonsChannelSeeder` — no fake messages in any channel
- [ ] Seeder is idempotent: running it twice on an install with real messages does not modify or delete any existing data
- [ ] Wiki ("Knowledge Base") and Announcements links are visible and functional in the left sidebar
- [ ] No duplicate header/tab row — channel name appears exactly once, tab icons appear exactly once
- [ ] Center message column has ~38px more vertical space (ChannelHeader row removed)
- [ ] Undefined channel during load shows skeleton placeholder in unified header, not a crash
- [ ] Asking Abby a question, navigating away (e.g., to Analyses), returning to Commons → Ask Abby shows the same conversation with the same messages
- [ ] Browser refresh on the Ask Abby view restores the last conversation
- [ ] If stored `conversationId` no longer exists (e.g., after a DB reset), Ask Abby silently resets to empty state — no error shown to user
- [ ] History panel lists past conversations; clicking one loads it
- [ ] "New chat" starts a fresh session and clears the persisted ID
- [ ] `AbbyPanel` (global header slide-out) continues to function unchanged
- [ ] Two logged-in users both appear in the online users avatar strip in the left sidebar
