# Commons Prototype Alignment — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every visual, structural, and UX gap between the current Commons implementation and the 4 HTML prototypes + 7 Abby component blueprints in `docs/commons/`.

**Architecture:** The current Commons is a functional 3-panel messaging workspace with channels, threads, reactions, pins, and search. The prototypes define a significantly richer UX with: (1) a right-panel Activity feed (not currently implemented), (2) an "Ask Abby" AI channel with conversational bubble UX, (3) in-channel @Abby mention handling with threaded AI responses, (4) object reference chips linking to platform entities, (5) message-level "Request for Review" badges, and (6) refined visual polish across all panels. This plan addresses each gap as an independent, committable chunk.

**Tech Stack:** React 19, TypeScript, TailwindCSS v4, TanStack Query, Lucide icons, existing Commons API + new Abby API endpoints.

---

## Gap Analysis Summary

| # | Gap | Prototype Source | Priority |
|---|-----|-----------------|----------|
| G1 | Right panel missing "Activity" tab with recent activity feed | `parthenon_commons_workspace_wireframe.html` lines 118-142 | HIGH |
| G2 | Right panel missing "Reviews" tab | wireframe line 121 | MEDIUM |
| G3 | Sidebar missing "AI assistant" section with `ask-abby` channel entry | `ask_abby_dedicated_channel.html` lines 65-66 | HIGH |
| G4 | No dedicated Ask Abby channel page (conversational bubble UX) | `ask_abby_dedicated_channel.html` full mockup | HIGH |
| G5 | No Abby component library (Avatar, ResponseCard, SourceAttribution, Feedback, TypingIndicator, MentionHandler) | all `docs/commons/Abby*.tsx` files | HIGH |
| G6 | No @Abby mention detection or in-channel AI response rendering | `abby_in_channel_response_mockup.html` | HIGH |
| G7 | No object reference chips on messages (linking to cohorts, studies, concept sets) | wireframe lines 91, 100; response card mockup lines 91-107 | MEDIUM |
| G8 | No "Request for Review" (RFR) badge on messages | wireframe line 101 | MEDIUM |
| G9 | Online users section missing user activity labels ("Cohort builder", "Results viewer") | wireframe lines 69-73 | LOW |
| G10 | Channel header description text not matching wireframe typography | wireframe lines 77-78 vs current `ChannelHeader.tsx` | LOW |
| G11 | Right panel Pinned section missing card-style display (currently list) | wireframe lines 144-157 | LOW |
| G12 | Sidebar DMs section showing online/offline dots per user (not just "Coming soon") | wireframe lines 65-67 | LOW |
| G13 | Thread container visual styling doesn't match mockup (indented card with header) | `abby_in_channel_response_mockup.html` lines 70-116 | MEDIUM |

---

## Chunk 1: Abby Component Library (Foundation)

These are the building blocks needed by both the Ask Abby channel and in-channel @Abby mentions. They are pure presentational components with no API dependencies, making them safe to build and test in isolation.

### File Structure

```
frontend/src/features/commons/
├── components/
│   └── abby/
│       ├── index.ts                        # Barrel exports
│       ├── AbbyAvatar.tsx                  # G5 — Gradient avatar
│       ├── AbbyResponseCard.tsx            # G5 — AI response renderer
│       ├── AbbySourceAttribution.tsx       # G5 — Expandable source panel
│       ├── AbbyFeedback.tsx                # G5 — Helpful/not-helpful widget
│       └── AbbyTypingIndicator.tsx         # G5 — RAG pipeline progress
├── types/
│   └── abby.ts                             # Abby-specific TypeScript interfaces
└── services/
    └── abbyService.ts                      # API client for Abby endpoints
```

### Task 1.1: Abby TypeScript Interfaces

**Files:**
- Create: `frontend/src/features/commons/types/abby.ts`

- [ ] **Step 1: Create the types file**

Port the type definitions from `docs/commons/abby-types.ts` into the project, adapting import paths. Include all interfaces: `AbbyUser`, `ObjectReference`, `AbbyQueryRequest`, `AbbyQueryResponse`, `AbbySource`, `AbbySourceMetadata`, `AbbyMessage`, `AbbyFeedback`, `AbbyFeedbackRequest`, `RagStage`, `RagPipelineState`, and all component prop interfaces.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/types/abby.ts
git commit -m "feat(commons): add Abby AI type definitions"
```

### Task 1.2: AbbyAvatar Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/AbbyAvatar.tsx`

- [ ] **Step 1: Create AbbyAvatar component**

Port from `docs/commons/AbbyAvatar.tsx`. This is a simple presentational component:
- Three sizes: `sm` (w-6 h-6), `md` (w-8 h-8), `lg` (w-9 h-9)
- Emerald gradient background: `bg-gradient-to-br from-emerald-500 to-emerald-700`
- "Ab" monogram in white
- Optional green status dot with ring

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/AbbyAvatar.tsx
git commit -m "feat(commons): add AbbyAvatar component"
```

### Task 1.3: AbbySourceAttribution Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/AbbySourceAttribution.tsx`

- [ ] **Step 1: Create AbbySourceAttribution component**

Port from `docs/commons/AbbySourceAttribution.tsx`. Key features:
- Collapsed by default (toggle with `▸`/`▾` arrow)
- Each source shows: rank badge (numbered circle), origin channel (blue link), author + date, snippet (italic, line-clamp-2), relevance bar (emerald fill)
- Collection label mapping from ChromaDB collection names to human labels
- Expandable with `animate-in fade-in slide-in-from-top-1` animation

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/AbbySourceAttribution.tsx
git commit -m "feat(commons): add AbbySourceAttribution component"
```

### Task 1.4: AbbyFeedback Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/AbbyFeedback.tsx`

- [ ] **Step 1: Create AbbyFeedback component**

Port from `docs/commons/AbbyFeedback.tsx`. Two-state widget:
- **Positive path**: click "Helpful" → emerald highlight → "Thank you for your feedback"
- **Negative path**: click "Not helpful" → red highlight → expand categorized tags panel
  - Categories: Inaccurate recall, Wrong source cited, Missing context, Too verbose, Made something up, Other
  - Optional free-text comment input
  - Submit button
- Border-top separator from response body

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/AbbyFeedback.tsx
git commit -m "feat(commons): add AbbyFeedback component"
```

### Task 1.5: AbbyTypingIndicator Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/AbbyTypingIndicator.tsx`

- [ ] **Step 1: Create AbbyTypingIndicator component**

Port from `docs/commons/AbbyTypingIndicator.tsx`. Multi-stage RAG pipeline display:
- 4 stages: Analyzing → Searching N collections → Reading N sources → Composing
- Stage states: `done` (green checkmark), `active` (spinning border animation), `pending` (gray dot)
- Error state: red background with error message
- Uses `AbbyAvatar` at `md` size alongside stages column

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/AbbyTypingIndicator.tsx
git commit -m "feat(commons): add AbbyTypingIndicator component"
```

### Task 1.6: AbbyResponseCard Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/AbbyResponseCard.tsx`

- [ ] **Step 1: Create AbbyResponseCard component**

Port from `docs/commons/AbbyResponseCard.tsx`. This is the primary AI response renderer:
- Header: AbbyAvatar + "Abby" name + "AI assistant" badge (emerald) + model tag ("MedGemma 1.5 · 4B") + timestamp
- Body: prose-rendered HTML or plain text
- Object reference chips: `◆ {type} {name}` with blue text, border, hover effect
- Composes `<AbbySourceAttribution>` and `<AbbyFeedback>` below body
- Two modes: full (default) and compact (smaller avatar, "AI" badge, no model tag)
- Hover: subtle bg change on the entire card row

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/AbbyResponseCard.tsx
git commit -m "feat(commons): add AbbyResponseCard component"
```

### Task 1.7: Barrel Export Index

**Files:**
- Create: `frontend/src/features/commons/components/abby/index.ts`

- [ ] **Step 1: Create barrel export**

```typescript
export { default as AbbyAvatar } from './AbbyAvatar';
export { default as AbbyResponseCard } from './AbbyResponseCard';
export { default as AbbySourceAttribution } from './AbbySourceAttribution';
export { default as AbbyFeedback } from './AbbyFeedback';
export { default as AbbyTypingIndicator } from './AbbyTypingIndicator';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/index.ts
git commit -m "feat(commons): add Abby component barrel exports"
```

---

## Chunk 2: Abby Service Layer & Hooks

### Task 2.1: Abby API Service

**Files:**
- Create: `frontend/src/features/commons/services/abbyService.ts`

- [ ] **Step 1: Create the service file**

Port from `docs/commons/abby-service.ts`, adapting to use the project's `apiClient` (Axios instance from `@/lib/api`). Three endpoints:

```typescript
import apiClient from "@/lib/api";
import type { AbbyQueryRequest, AbbyQueryResponse, AbbyFeedbackRequest } from "../types/abby";

export async function queryAbby(request: AbbyQueryRequest): Promise<AbbyQueryResponse> {
  const { data } = await apiClient.post<{ data: AbbyQueryResponse }>("/commons/abby/query", request);
  return data.data;
}

export async function submitFeedback(feedback: AbbyFeedbackRequest): Promise<void> {
  await apiClient.post("/commons/abby/feedback", feedback);
}

export async function getAbbyHistory(channelId: string): Promise<AbbyQueryResponse[]> {
  const { data } = await apiClient.get<{ data: AbbyQueryResponse[] }>(`/commons/abby/history`, {
    params: { channel_id: channelId },
  });
  return data.data;
}
```

Note: These backend endpoints don't exist yet. The service layer is built first so the frontend can be developed with mock data. The backend Abby endpoints are a separate phase.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/services/abbyService.ts
git commit -m "feat(commons): add Abby API service layer"
```

### Task 2.2: Abby React Hooks

**Files:**
- Create: `frontend/src/features/commons/hooks/useAbby.ts`

- [ ] **Step 1: Create hooks file**

Port from `docs/commons/abby-hooks.ts`, adapting to project patterns. Three hooks:

1. **`useAbbyQuery()`** — manages the RAG query lifecycle
   - Returns: `{ response, pipelineState, isLoading, error, sendQuery }`
   - Simulates pipeline stages (analyzing → retrieving → reading → composing) with timers
   - Calls `queryAbby()` from service layer
   - Tracks `RagPipelineState` through stages

2. **`useAbbyFeedback()`** — wraps feedback submission
   - Returns: `{ submitFeedback, isSubmitting }`

3. **`useAbbyMention()`** — @Abby mention detection utilities
   - Returns: `{ containsMention, extractQuery }`
   - `containsMention(text)`: checks for `@abby` (case-insensitive)
   - `extractQuery(text)`: strips `@abby` and returns the query portion

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/hooks/useAbby.ts
git commit -m "feat(commons): add Abby React hooks"
```

---

## Chunk 3: Ask Abby Dedicated Channel

This implements the dedicated #ask-abby channel with the conversational bubble UX shown in `ask_abby_dedicated_channel.html`.

### Task 3.1: AskAbbyChannel Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx`

- [ ] **Step 1: Create AskAbbyChannel component**

Port from `docs/commons/AskAbbyChannel.tsx`, adapting to project patterns. Key elements:

1. **Channel header**: AbbyAvatar (lg, showStatus) + "Ask Abby" title + subtitle "AI research companion · MedGemma · Institutional memory" + green "Online" status
2. **Conversation area** (`flex-1 overflow-y-auto`):
   - **WelcomeCard** (shown when no conversation): emerald gradient card with greeting + 4 suggested prompt chips
   - **User bubbles**: right-aligned, blue tint, rounded-2xl with small br corner, user initials avatar
   - **Abby bubbles**: left-aligned, gray/zinc tint, rounded-2xl with small bl corner, AbbyAvatar, "AI" badge, sources panel, object refs, feedback buttons
   - **Typing indicator**: AbbyAvatar + AbbyTypingIndicator when loading
3. **Composer**: input + "Ask" button (emerald), Enter to send, disabled during loading
4. **State**: `conversation: ConversationEntry[]` managed locally, appends user + abby entries
5. **Auto-scroll**: `useEffect` scrolls to bottom on new entries

Use `useAbbyQuery()` hook for the RAG pipeline. Wire `useAuthStore` for real user name/initials instead of hardcoded values.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/AskAbbyChannel.tsx
git commit -m "feat(commons): add AskAbbyChannel dedicated AI channel"
```

### Task 3.2: Add Ask Abby to Sidebar

**Files:**
- Modify: `frontend/src/features/commons/components/sidebar/ChannelList.tsx`

- [ ] **Step 1: Add "AI Assistant" section to sidebar**

Between the "Channels" section and "Study Channels" section in `ChannelList.tsx`, add a new section:

```tsx
<SectionLabel>AI Assistant</SectionLabel>
<button
  onClick={() => navigate("/commons/ask-abby")}
  className={`flex items-center gap-2 py-1.5 px-4 text-[13px] transition-colors ${
    activeSlug === "ask-abby"
      ? "border-l-2 border-emerald-500 bg-emerald-500/15 text-foreground"
      : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  }`}
>
  <span className="text-emerald-500">✦</span>
  ask-abby
</button>
```

This uses an emerald accent (matching Abby's brand color) instead of crimson primary, and a `✦` symbol instead of `#` hash to visually distinguish it from regular channels.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/sidebar/ChannelList.tsx
git commit -m "feat(commons): add Ask Abby entry to sidebar"
```

### Task 3.3: Route the Ask Abby Channel

**Files:**
- Modify: `frontend/src/features/commons/components/CommonsLayout.tsx`

- [ ] **Step 1: Conditionally render AskAbbyChannel when slug is "ask-abby"**

In `CommonsLayout.tsx`, import `AskAbbyChannel` and render it instead of the normal chat area when `activeSlug === "ask-abby"`:

```tsx
import { AskAbbyChannel } from "./abby/AskAbbyChannel";

// In the center panel:
{activeSlug === "ask-abby" ? (
  <AskAbbyChannel />
) : (
  <>
    {channel && <ChannelHeader channel={channel} onToggleTab={...} />}
    <MessageList ... />
    {channel && <MessageComposer ... />}
  </>
)}
```

When on ask-abby, hide the right panel as well (the Ask Abby channel is a full-width conversational interface).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/CommonsLayout.tsx
git commit -m "feat(commons): route ask-abby slug to dedicated AI channel"
```

---

## Chunk 4: In-Channel @Abby Mentions

This implements the `abby_in_channel_response_mockup.html` — when a user types `@Abby` in any regular channel, Abby responds in a thread.

### Task 4.1: AbbyMentionHandler Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/AbbyMentionHandler.tsx`

- [ ] **Step 1: Create AbbyMentionHandler component**

Port from `docs/commons/AbbyMentionHandler.tsx`. This component:
1. Listens for `commons:message-sent` custom events on `window`
2. Uses `useAbbyMention().containsMention()` to detect @Abby
3. Extracts the query text
4. Fires `useAbbyQuery().sendQuery()` with channel context
5. Renders `<AbbyTypingIndicator>` during pipeline
6. Renders `<AbbyResponseCard>` on completion
7. Renders error state with retry button on failure

Also export the `dispatchAbbyMentionEvent()` utility function for the composer to call.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/AbbyMentionHandler.tsx
git commit -m "feat(commons): add AbbyMentionHandler for @Abby mentions"
```

### Task 4.2: Wire AbbyMentionHandler into CommonsLayout

**Files:**
- Modify: `frontend/src/features/commons/components/CommonsLayout.tsx`
- Modify: `frontend/src/features/commons/components/chat/MessageComposer.tsx`

- [ ] **Step 1: Add AbbyMentionHandler to the center chat area**

In `CommonsLayout.tsx`, add `<AbbyMentionHandler>` below `<MessageList>`:

```tsx
import { AbbyMentionHandler } from "./abby";

// After MessageList, before MessageComposer:
{channel && <AbbyMentionHandler channelId={String(channel.id)} channelName={channel.name} />}
```

- [ ] **Step 2: Dispatch @Abby events from MessageComposer**

In `MessageComposer.tsx`, import `dispatchAbbyMentionEvent` and call it in `handleSubmit()` after sending the message:

```typescript
import { dispatchAbbyMentionEvent } from "../abby/AbbyMentionHandler";

// In handleSubmit, after onSend(trimmed):
dispatchAbbyMentionEvent(trimmed, "current-user"); // TODO: pass real user name
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/CommonsLayout.tsx frontend/src/features/commons/components/chat/MessageComposer.tsx
git commit -m "feat(commons): wire @Abby mention handling into chat flow"
```

### Task 4.3: Update barrel exports

**Files:**
- Modify: `frontend/src/features/commons/components/abby/index.ts`

- [ ] **Step 1: Add AskAbbyChannel and AbbyMentionHandler to barrel**

```typescript
export { default as AskAbbyChannel } from './AskAbbyChannel';
export { default as AbbyMentionHandler } from './AbbyMentionHandler';
export { dispatchAbbyMentionEvent } from './AbbyMentionHandler';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/components/abby/index.ts
git commit -m "feat(commons): export AskAbbyChannel and AbbyMentionHandler"
```

---

## Chunk 5: Right Panel — Activity Tab

The prototype wireframe shows an "Activity" tab as the first (default) tab in the right panel, displaying recent activity items with typed icons (Cohort updated, Analysis complete, Review requested, IRB status). The current implementation has Pinned as the default.

### Task 5.1: ActivityFeed Component

**Files:**
- Create: `frontend/src/features/commons/components/rightpanel/ActivityFeed.tsx`

- [ ] **Step 1: Create ActivityFeed component**

Build the Activity feed as shown in wireframe lines 124-142:
- Section label: "Recent activity"
- Each activity item is a row: icon circle (24x24, colored by type) + text (bold title + description) + relative timestamp
- Activity types and their colors:
  - `cohort_updated` → success (green) → icon "C"
  - `analysis_complete` → info (blue) → icon "A"
  - `review_requested` → warning (amber) → icon "R"
  - `irb_status` → secondary (gray) → icon "I"
  - `message_pinned` → primary (crimson) → icon "P"
  - `member_joined` → info (blue) → icon "M"

For now, use mock data since there's no activity feed API yet. Structure the component to accept an `activities` prop so it can be wired to real data later:

```typescript
interface Activity {
  id: string;
  type: "cohort_updated" | "analysis_complete" | "review_requested" | "irb_status" | "message_pinned" | "member_joined";
  title: string;
  description: string;
  timestamp: string;
}
```

Styling per wireframe:
- Item layout: `flex gap-2 py-1.5 border-b border-border last:border-b-0`
- Icon: `w-6 h-6 rounded-full flex items-center justify-center text-[11px]`
- Text: `text-xs text-muted-foreground` with `<strong>` in foreground
- Timestamp: `text-[10px] text-muted-foreground`

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/rightpanel/ActivityFeed.tsx
git commit -m "feat(commons): add ActivityFeed right panel component"
```

### Task 5.2: Add Activity Tab to RightPanel

**Files:**
- Modify: `frontend/src/features/commons/components/rightpanel/RightPanel.tsx`
- Modify: `frontend/src/features/commons/components/CommonsLayout.tsx`

- [ ] **Step 1: Add Activity tab to TABS array**

In `RightPanel.tsx`, add Activity as the first tab (matching the wireframe where it's the default):

```typescript
import { Activity } from "lucide-react";
import { ActivityFeed } from "./ActivityFeed";

const TABS = [
  { key: "activity", label: "Activity", icon: Activity },
  { key: "pinned", label: "Pinned", icon: Pin },
  { key: "search", label: "Search", icon: Search },
  { key: "files", label: "Files", icon: FileText },
] as const;
```

Note: Members tab is removed from the tab bar per wireframe (member count is shown in the channel header instead). The Reviews tab from wireframe line 121 is deferred to Chunk 6.

Add the ActivityFeed render case:
```tsx
{activeTab === "activity" && <ActivityFeed />}
```

- [ ] **Step 2: Change default tab to "activity"**

In `CommonsLayout.tsx`, change the initial state:
```typescript
const [rightTab, setRightTab] = useState("activity");
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/rightpanel/RightPanel.tsx frontend/src/features/commons/components/CommonsLayout.tsx
git commit -m "feat(commons): add Activity tab to right panel (default)"
```

---

## Chunk 6: Visual Polish & Remaining Gaps

### Task 6.1: Object Reference Chips on Messages (G7)

**Files:**
- Modify: `frontend/src/features/commons/types.ts`
- Modify: `frontend/src/features/commons/components/chat/MessageItem.tsx`

- [ ] **Step 1: Add object_references to Message type**

In `types.ts`, add to the `Message` interface:

```typescript
object_references?: {
  id: string;
  type: string;
  display_name: string;
}[];
```

- [ ] **Step 2: Render object reference chips in MessageItem**

Below the message body (after the ReactMarkdown block), add:

```tsx
{/* Object references */}
{!isDeleted && message.object_references && message.object_references.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mt-1.5">
    {message.object_references.map((ref) => (
      <button
        key={ref.id}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-[11px] text-primary hover:bg-primary/20 transition-colors cursor-pointer"
      >
        <span className="text-[9px] opacity-60">◆</span>
        {ref.display_name}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/types.ts frontend/src/features/commons/components/chat/MessageItem.tsx
git commit -m "feat(commons): add object reference chips to messages"
```

### Task 6.2: Request for Review Badge (G8)

**Files:**
- Modify: `frontend/src/features/commons/types.ts`
- Modify: `frontend/src/features/commons/components/chat/MessageItem.tsx`

- [ ] **Step 1: Add review_status to Message type**

In `types.ts`, add to the `Message` interface:

```typescript
review_status?: "requested" | "approved" | "rejected" | null;
```

- [ ] **Step 2: Render RFR badge in MessageItem**

Below the object references (or body if no refs), render the review badge when present:

```tsx
{!isDeleted && message.review_status === "requested" && (
  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-[11px] font-medium text-amber-400">
    Review requested
  </span>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/types.ts frontend/src/features/commons/components/chat/MessageItem.tsx
git commit -m "feat(commons): add Request for Review badge to messages"
```

### Task 6.3: Channel Header Typography Polish (G10)

**Files:**
- Modify: `frontend/src/features/commons/components/chat/ChannelHeader.tsx`

- [ ] **Step 1: Match wireframe header styling**

Update the channel header to match wireframe lines 76-83:
- Channel name: `text-[15px] font-medium` (currently `font-semibold`, wireframe uses `font-weight: 500`)
- Description: `text-xs text-muted-foreground ml-2` (add slight more spacing)
- Header actions: style the icon buttons as 30x30 bordered squares per wireframe line 26

```tsx
function HeaderButton({ icon: Icon, label, onClick }: { ... }) {
  return (
    <button
      onClick={onClick}
      className="flex h-[30px] w-[30px] items-center justify-center rounded border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/chat/ChannelHeader.tsx
git commit -m "style(commons): refine ChannelHeader to match wireframe"
```

### Task 6.4: Thread Container Styling (G13)

**Files:**
- Modify: `frontend/src/features/commons/components/chat/ThreadView.tsx`

- [ ] **Step 1: Update ThreadView styling to match mockup**

The prototype (`abby_in_channel_response_mockup.html` lines 70-76) shows threads as:
- Container: bordered card with rounded corners, background secondary
- Thread header: "Thread · N replies" in small muted text with border-bottom
- Indented from the parent message avatar (left margin 58px = ml-[58px])

Update the `ThreadView` wrapper div:

```tsx
// Change from:
<div className="ml-12 border-l-2 border-border pl-4">

// To:
<div className="ml-[58px] mr-4 mb-3 rounded-md border border-border bg-card/50 overflow-hidden">
  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border text-[11px] text-muted-foreground">
    <span>Thread</span>
    <span className="opacity-50">·</span>
    <span>{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
  </div>
  <div className="divide-y divide-border">
    {/* reply items here */}
  </div>
  {/* reply composer */}
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/chat/ThreadView.tsx
git commit -m "style(commons): restyle ThreadView as card container per mockup"
```

### Task 6.5: Online Users Activity Labels (G9)

**Files:**
- Modify: `frontend/src/features/commons/components/sidebar/OnlineUsers.tsx`
- Modify: `frontend/src/features/commons/types.ts`

- [ ] **Step 1: Extend PresenceUser type with activity field**

In `types.ts`, add to `PresenceUser`:

```typescript
export interface PresenceUser {
  id: number;
  name: string;
  activity?: string; // e.g., "Cohort builder", "Results viewer", "Data quality"
}
```

- [ ] **Step 2: Switch from avatar grid to user list with activity labels**

Update `OnlineUsers.tsx` to match wireframe lines 68-73 — a list of users with online/offline dots and activity labels:

```tsx
export function OnlineUsers({ users }: OnlineUsersProps) {
  return (
    <div className="border-t border-border px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Online — {users.length}
      </p>
      <div className="flex flex-col gap-1">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-2 px-1 py-0.5 text-[13px]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-green-500" />
            <span className="truncate text-foreground">{user.name}</span>
            {user.activity && (
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                {user.activity}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/sidebar/OnlineUsers.tsx frontend/src/features/commons/types.ts
git commit -m "style(commons): show online users as list with activity labels"
```

### Task 6.6: Pinned Resources Card Styling (G11)

**Files:**
- Modify: `frontend/src/features/commons/components/rightpanel/PinnedList.tsx`

- [ ] **Step 1: Update pinned items to card style per wireframe**

The wireframe (lines 144-157) shows pinned items as mini cards with:
- Container: `bg-card border border-border rounded-md p-2.5 mb-2`
- Title: `text-xs font-medium text-foreground`
- Meta line: `text-[11px] text-muted-foreground mt-0.5`

Update the pin item rendering in PinnedList to use this card style instead of the current list style. Keep the hover-visible unpin (X) button.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/rightpanel/PinnedList.tsx
git commit -m "style(commons): restyle pinned items as cards per wireframe"
```

---

## Chunk 7: Final Verification & Build

### Task 7.1: Full TypeScript + Build Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run ESLint**

Run: `cd frontend && npx eslint src/features/commons/`
Expected: No new errors

- [ ] **Step 3: Run Vite build**

Run: `cd frontend && npx vite build --outDir /tmp/commons-build-test`
Expected: Build succeeds

- [ ] **Step 4: Manual visual verification checklist**

Navigate to `http://localhost:5175/commons` and verify:

- [ ] Left sidebar shows "AI Assistant" section with ✦ ask-abby entry
- [ ] Clicking ask-abby navigates to conversational bubble UI
- [ ] Welcome card shows with 4 suggested prompt chips
- [ ] Regular channels still work normally
- [ ] Right panel defaults to "Activity" tab
- [ ] Activity tab shows recent activity items (mock data)
- [ ] Pinned tab shows card-style pinned items
- [ ] Channel header buttons are 30x30 bordered squares
- [ ] Online users show as list with activity labels
- [ ] Thread containers render as bordered cards with header

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(commons): complete prototype alignment — Abby AI, activity feed, visual polish"
```

---

## Deferred Items (Not in This Plan)

These items from the prototypes require backend work or are lower priority:

| Item | Reason Deferred |
|------|----------------|
| **Reviews tab in right panel** | Requires backend review workflow (API, models, permissions) — separate feature |
| **Direct Messages with online/offline dots** | Already scoped as separate phase; needs backend DM models |
| **Real Abby RAG backend** (`POST /commons/abby/query`) | Requires ChromaDB setup, Python AI service integration — Phase 6 per spec |
| **Real activity feed API** | Needs backend event tracking system — separate feature |
| **Object reference click → navigation** | Needs routing to cohort/study/concept-set detail pages |
| **Thread-level @Abby responses** (reply to thread with `parentMessageId`) | Works architecturally but needs backend threading for AI responses |
| **Abby in sidebar "Online" presence** | Requires Abby system user in presence channel |
| **Message attachments / file sharing** | Already marked "Phase 2" in current code |
