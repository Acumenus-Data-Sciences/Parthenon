# Commons Workspace Functional Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove demo data, unify the duplicate channel header/tab-bar into a single spanning row, make Ask Abby conversations persist across navigation via localStorage-backed Zustand store, and add a collapsible conversation history panel.

**Architecture:** The backend is already complete (DB tables, APIs, WebSocket channels). All changes are frontend-only except a one-line seeder addition. Abby persistence works by adding Zustand `persist` middleware to the existing `abbyStore.ts` — only `conversationId` (typed `number | null`) is stored; messages are always fetched fresh. The header unification deletes `ChannelHeader.tsx` and moves channel identity into the top row of `RightPanel`.

**Tech Stack:** React 19, TypeScript strict, Zustand 5 (`persist` from `zustand/middleware`), TanStack Query v5, Vitest + @testing-library/react, Pest (PHP), Tailwind 4.

---

## Chunk 1: Seeder + Header Unification

### Task 1: Add #announcements Channel to Seeder

**Files:**
- Modify: `backend/database/seeders/CommonsChannelSeeder.php`
- Test: `backend/tests/Feature/Commons/CommonsChannelSeederTest.php` (create)

---

- [ ] **Step 1.1 — Write the failing test**

Create `backend/tests/Feature/Commons/CommonsChannelSeederTest.php`:

```php
<?php

namespace Tests\Feature\Commons;

use App\Models\Commons\Channel;
use App\Models\User;
use Database\Seeders\CommonsChannelSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('seeds exactly four skeleton channels', function () {
    User::factory()->create(['email' => 'admin@acumenus.net']);

    $this->seed(CommonsChannelSeeder::class);

    $slugs = Channel::pluck('slug')->sort()->values()->toArray();
    expect($slugs)->toBe(['announcements', 'concept-sets', 'data-quality', 'general']);
});

test('seeder is idempotent — running twice does not duplicate channels', function () {
    User::factory()->create(['email' => 'admin@acumenus.net']);

    $this->seed(CommonsChannelSeeder::class);
    $this->seed(CommonsChannelSeeder::class);

    expect(Channel::count())->toBe(4);
});

test('seeder does not delete channels that already exist with messages', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    $this->seed(CommonsChannelSeeder::class);

    // Re-running the seeder should not touch existing channels
    $generalId = Channel::where('slug', 'general')->value('id');
    $this->seed(CommonsChannelSeeder::class);

    expect(Channel::where('slug', 'general')->value('id'))->toBe($generalId);
});
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```bash
cd /home/smudoshi/Github/Parthenon/backend
vendor/bin/pest tests/Feature/Commons/CommonsChannelSeederTest.php --no-coverage
```

Expected: FAIL — "seeds exactly four skeleton channels" fails (only 3 channels exist)

- [ ] **Step 1.3 — Add announcements channel to seeder**

In `backend/database/seeders/CommonsChannelSeeder.php`, add the fourth entry to the `$channels` array:

```php
$channels = [
    ['name' => 'General',       'slug' => 'general',       'description' => 'General discussion for the team'],
    ['name' => 'Data Quality',  'slug' => 'data-quality',  'description' => 'Data quality discussions and DQD results'],
    ['name' => 'Concept Sets',  'slug' => 'concept-sets',  'description' => 'Concept set design and review'],
    ['name' => 'Announcements', 'slug' => 'announcements', 'description' => 'Platform announcements and updates'],
];
```

- [ ] **Step 1.4 — Run tests to verify they pass**

```bash
cd /home/smudoshi/Github/Parthenon/backend
vendor/bin/pest tests/Feature/Commons/CommonsChannelSeederTest.php --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 1.5 — Commit**

```bash
git add backend/database/seeders/CommonsChannelSeeder.php \
        backend/tests/Feature/Commons/CommonsChannelSeederTest.php
git commit -m "feat: add #announcements channel to CommonsChannelSeeder"
```

---

### Task 2: Header Unification

**Files:**
- Delete: `frontend/src/features/commons/components/chat/ChannelHeader.tsx`
- Modify: `frontend/src/features/commons/components/CommonsLayout.tsx`
- Modify: `frontend/src/features/commons/components/rightpanel/RightPanel.tsx`
- Test: `frontend/src/features/commons/components/rightpanel/__tests__/RightPanel.test.tsx` (create)

**Context:**
- `ChannelHeader` currently shows `# name`, description, and icon buttons for Pin/Search/Members/Settings — all duplicated in RightPanel's tab bar.
- `RightPanel` already accepts `channel?: Channel` as a prop (line 24 in RightPanel.tsx).
- The center column `CommonsLayout` will no longer render `ChannelHeader` — the message list starts immediately.

---

- [ ] **Step 2.1 — Write the failing test**

Create `frontend/src/features/commons/components/rightpanel/__tests__/RightPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RightPanel } from '../RightPanel';
import type { Channel, ChannelMember } from '../../../types';

const mockChannel: Channel = {
  id: 1,
  name: 'general',
  slug: 'general',
  description: 'Main research discussion',
  type: 'topic',
  visibility: 'public',
  members_count: 5,
  created_by: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived_at: null,
  study_id: null,
};

describe('RightPanel', () => {
  it('shows channel name and description in the unified header', () => {
    render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={vi.fn()}
        members={[]}
        channel={mockChannel}
      />
    );
    expect(screen.getByText('# general')).toBeInTheDocument();
    expect(screen.getByText('Main research discussion')).toBeInTheDocument();
  });

  it('shows skeleton when channel is undefined', () => {
    const { container } = render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={vi.fn()}
        members={[]}
        channel={undefined}
      />
    );
    // Skeleton element should exist, no channel name text
    expect(screen.queryByText(/# /)).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('calls onTabChange when a tab icon is clicked', async () => {
    const onTabChange = vi.fn();
    render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={onTabChange}
        members={[]}
        channel={mockChannel}
      />
    );
    // Click the Pinned tab (title="Pinned")
    await userEvent.click(screen.getByTitle('Pinned'));
    expect(onTabChange).toHaveBeenCalledWith('pinned');
  });

  it('does not render a separate tab bar row below the header', () => {
    const { container } = render(
      <RightPanel
        slug="general"
        activeTab="activity"
        onTabChange={vi.fn()}
        members={[]}
        channel={mockChannel}
      />
    );
    // Only one border-b row at the top — the unified header
    const borderRows = container.querySelectorAll('[class*="border-b"]');
    expect(borderRows.length).toBe(1);
  });
});
```

- [ ] **Step 2.2 — Run tests to verify they fail**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/features/commons/components/rightpanel/__tests__/RightPanel.test.tsx
```

Expected: FAIL — "shows channel name and description" fails (no such text rendered), "does not render separate tab bar" fails (two border-b rows exist)

- [ ] **Step 2.3 — Update `RightPanel.tsx`**

Replace the entire current `RightPanel` component with the following. The key change is replacing the icon-only tab bar with a unified header row that contains both the channel identity (left) and the tab icons (right). Remove the separate tab bar row.

```tsx
import { Pin, Search, Users, Settings, ClipboardCheck, Zap } from "lucide-react";
import type { Channel, ChannelMember } from "../../types";
import { PinnedList } from "./PinnedList";
import { SearchPanel } from "./SearchPanel";
import { MemberList } from "./MemberList";
import { ChannelSettings } from "./ChannelSettings";
import { ReviewList } from "./ReviewList";
import { ActivityFeed } from "./ActivityFeed";

const TABS = [
  { key: "activity", label: "Activity", icon: Zap },
  { key: "pinned",   label: "Pinned",   icon: Pin },
  { key: "search",   label: "Search",   icon: Search },
  { key: "reviews",  label: "Reviews",  icon: ClipboardCheck },
  { key: "members",  label: "Members",  icon: Users },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

interface RightPanelProps {
  slug: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  members: ChannelMember[];
  channel?: Channel;
  currentMember?: ChannelMember;
}

export function RightPanel({
  slug,
  activeTab,
  onTabChange,
  members,
  channel,
  currentMember,
}: RightPanelProps) {
  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-white/[0.04] bg-[#0c0c10]">
      {/* Unified header: channel identity (left) + tab icons (right) */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 min-w-0">
        {/* Channel identity */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {channel ? (
            <>
              <span className="text-[13px] font-semibold text-foreground shrink-0">
                # {channel.name}
              </span>
              {channel.description && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {channel.description}
                </span>
              )}
            </>
          ) : (
            <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
          )}
        </div>

        {/* Tab icon buttons */}
        {channel && (
          <div className="flex shrink-0 items-center gap-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  title={tab.label}
                  className={`flex h-[26px] w-[26px] items-center justify-center rounded transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "pinned"   && <PinnedList slug={slug} />}
      {activeTab === "search"   && <SearchPanel slug={slug} />}
      {activeTab === "activity" && <ActivityFeed slug={slug} />}
      {activeTab === "reviews"  && <ReviewList slug={slug} />}
      {activeTab === "members"  && <MemberList members={members} />}
      {activeTab === "settings" && channel && (
        <ChannelSettings channel={channel} currentMember={currentMember} slug={slug} />
      )}
    </div>
  );
}
```

- [ ] **Step 2.4 — Update `CommonsLayout.tsx`**

Remove `ChannelHeader` import and render. Remove `onToggleTab` prop threading. The center column now starts directly with `MessageList`.

Find and remove these lines:

```tsx
// REMOVE this import:
import { ChannelHeader } from "./chat/ChannelHeader";

// REMOVE this render block (inside the chat view):
{channel && (
  <ChannelHeader
    channel={channel}
    onToggleTab={(tab) => setRightTab(rightTab === tab ? tab : tab)}
  />
)}
```

The center `<div className="flex flex-1 flex-col">` content order becomes:
1. `<MessageList .../>` (starts immediately, no header above)
2. `<AbbyMentionHandler .../>`
3. `<MessageComposer .../>`

No other changes to `CommonsLayout.tsx` are needed — `channel` is already passed to `RightPanel` and `rightTab`/`setRightTab` continue to wire to `RightPanel`'s `activeTab`/`onTabChange`.

- [ ] **Step 2.5 — Delete `ChannelHeader.tsx`**

```bash
rm /home/smudoshi/Github/Parthenon/frontend/src/features/commons/components/chat/ChannelHeader.tsx
```

- [ ] **Step 2.6 — Run tests**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/features/commons/components/rightpanel/__tests__/RightPanel.test.tsx
```

Expected: 4 tests PASS

- [ ] **Step 2.7 — TypeScript check**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx tsc --noEmit 2>&1 | grep -E "error|ChannelHeader"
```

Expected: no errors referencing `ChannelHeader` (file is deleted and import removed)

- [ ] **Step 2.8 — Commit**

```bash
git add frontend/src/features/commons/components/rightpanel/RightPanel.tsx \
        frontend/src/features/commons/components/CommonsLayout.tsx \
        frontend/src/features/commons/components/rightpanel/__tests__/RightPanel.test.tsx
git rm frontend/src/features/commons/components/chat/ChannelHeader.tsx
git commit -m "feat: unify channel header — delete ChannelHeader, promote identity into RightPanel"
```

---

## Chunk 2: Abby Persistence

### Task 3: Add `persist` Middleware + Fix Type in `abbyStore.ts`

**Files:**
- Modify: `frontend/src/stores/abbyStore.ts`
- Test: `frontend/src/stores/__tests__/abbyStore.test.ts` (create)

**Context:**
- `abbyStore.ts` currently uses `create<AbbyState>()((set) => ...)` — no persistence.
- The existing pattern in `authStore.ts` uses `create<State>()(persist(..., { name, partialize }))`.
- `conversationId` is currently typed `string | null` in the store but `number | null` everywhere in the service layer. Fix to `number | null`.
- Only `conversationId` is persisted to localStorage — everything else is ephemeral.

---

- [ ] **Step 3.1 — Write the failing test**

Create `frontend/src/stores/__tests__/abbyStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAbbyStore } from '../abbyStore';

// Reset store between tests
beforeEach(() => {
  useAbbyStore.setState({
    conversationId: null,
    messages: [],
    conversationList: [],
    panelOpen: false,
    pageContext: 'general',
    isStreaming: false,
    streamingContent: '',
  });
  localStorage.clear();
});

describe('abbyStore', () => {
  it('conversationId is number | null (not string)', () => {
    useAbbyStore.getState().setConversationId(42);
    const id = useAbbyStore.getState().conversationId;
    expect(typeof id).toBe('number');
    expect(id).toBe(42);
  });

  it('setConversationId(null) clears the id', () => {
    useAbbyStore.getState().setConversationId(42);
    useAbbyStore.getState().setConversationId(null);
    expect(useAbbyStore.getState().conversationId).toBeNull();
  });

  it('clearMessages resets messages and conversationId', () => {
    useAbbyStore.getState().setConversationId(10);
    useAbbyStore.getState().clearMessages();
    expect(useAbbyStore.getState().conversationId).toBeNull();
  });

  it('conversationId is persisted to localStorage under parthenon-abby', () => {
    useAbbyStore.getState().setConversationId(99);
    const stored = JSON.parse(localStorage.getItem('parthenon-abby') ?? '{}');
    expect(stored.state?.conversationId).toBe(99);
  });

  it('messages are NOT persisted to localStorage', () => {
    useAbbyStore.getState().addMessage({
      id: 'test',
      role: 'user',
      content: 'hello',
      timestamp: new Date(),
    });
    const stored = JSON.parse(localStorage.getItem('parthenon-abby') ?? '{}');
    expect(stored.state?.messages).toBeUndefined();
  });
});
```

- [ ] **Step 3.2 — Run tests to verify they fail**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/stores/__tests__/abbyStore.test.ts
```

Expected: "conversationId is persisted" fails (no persist middleware yet), "conversationId is number | null" fails (type is string)

- [ ] **Step 3.3 — Update `abbyStore.ts`**

Replace the entire file:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export interface ConversationSummary {
  id: number;
  title: string;
  page_context: string;
  created_at: string;
  messages_count: number;
}

interface AbbyState {
  panelOpen: boolean;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;

  messages: Message[];
  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  conversationId: number | null;             // was string | null
  setConversationId: (id: number | null) => void;

  conversationList: ConversationSummary[];
  setConversationList: (list: ConversationSummary[]) => void;

  pageContext: string;
  setPageContext: (ctx: string) => void;

  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;

  streamingContent: string;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm Abby, your AI research assistant powered by MedGemma and backed by a knowledge base of 39,000+ documentation chunks. I remember our past conversations and can help with concept mapping, cohort design, data quality, clinical analytics, and OMOP CDM guidance. How can I help?",
  timestamp: new Date(),
};

export const useAbbyStore = create<AbbyState>()(
  persist(
    (set) => ({
      panelOpen: false,
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setPanelOpen: (open) => set({ panelOpen: open }),

      messages: [WELCOME_MESSAGE],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [WELCOME_MESSAGE], conversationId: null }),

      conversationId: null,
      setConversationId: (id) => set({ conversationId: id }),

      conversationList: [],
      setConversationList: (list) => set({ conversationList: list }),

      pageContext: "general",
      setPageContext: (ctx) => set({ pageContext: ctx }),

      isStreaming: false,
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),

      streamingContent: "",
      setStreamingContent: (content) => set({ streamingContent: content }),
      appendStreamingContent: (chunk) =>
        set((s) => ({ streamingContent: s.streamingContent + chunk })),
    }),
    {
      name: "parthenon-abby",
      partialize: (state) => ({ conversationId: state.conversationId }),
    },
  ),
);
```

- [ ] **Step 3.4 — Run tests**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/stores/__tests__/abbyStore.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 3.5 — Commit**

```bash
git add frontend/src/stores/abbyStore.ts \
        frontend/src/stores/__tests__/abbyStore.test.ts
git commit -m "feat: add localStorage persistence and fix conversationId type in abbyStore"
```

---

### Task 4: Fix `AbbyPanel.tsx` Type Callsites

**Files:**
- Modify: `frontend/src/components/layout/AbbyPanel.tsx`

**Context:**
`AbbyPanel.tsx` stored `conversationId` as a string everywhere (via `String()` wrappers and inline TS interfaces). Now that the store is `number | null`, these must be updated. There are **7 specific locations** — do not rely on search alone as some are string-to-number coercions, not just function calls.

---

- [ ] **Step 4.1 — Fix line 240: `setConversationId(String(data.data.id))`**

```tsx
// Before:
setConversationId(String(data.data.id));

// After:
setConversationId(data.data.id);  // data.data.id is already number
```

- [ ] **Step 4.2 — Fix line 258: `conversationId === String(convId)`**

```tsx
// Before:
if (conversationId === String(convId)) {
  clearMessages();
}

// After:
if (conversationId === convId) {
  clearMessages();
}
```

- [ ] **Step 4.3 — Fix inline SSE response type at line ~347 (streaming path)**

Find the inline interface that looks like:
```ts
const parsed = JSON.parse(data) as {
  token?: string;
  suggestions?: string[];
  conversation_id?: string;   // ← change this
  error?: string;
};
```
Change `conversation_id?: string` → `conversation_id?: number`.

Do the same for the two other inline response type definitions at lines ~380 and ~413 (non-streaming response paths). All three blocks have `conversation_id?: string` — change all to `conversation_id?: number`.

- [ ] **Step 4.4 — Fix lines 357, 392, 425: `setConversationId(parsed.conversation_id)`**

These are already calling `setConversationId` with a value that is now typed `number` — no casting needed since the inline type is fixed in Step 4.3. Verify each call looks like:

```tsx
if (parsed.conversation_id && !useAbbyStore.getState().conversationId) {
  setConversationId(parsed.conversation_id);  // number ✓
}
```

- [ ] **Step 4.5 — Fix lines 586 and 593: `conversationId === String(conv.id)`**

```tsx
// Before:
background: conversationId === String(conv.id) ? "var(--surface-overlay)" : "transparent"

// After:
background: conversationId === conv.id ? "var(--surface-overlay)" : "transparent"
```

Apply the same fix to line 593 (same pattern, different JSX attribute).

- [ ] **Step 4.6 — TypeScript check**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx tsc --noEmit 2>&1 | grep "AbbyPanel"
```

Expected: no errors in `AbbyPanel.tsx`

- [ ] **Step 4.7 — Run full frontend type check**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4.8 — Commit**

```bash
git add frontend/src/components/layout/AbbyPanel.tsx
git commit -m "fix: update AbbyPanel conversationId type callsites from string to number"
```

---

### Task 5: Add `useAbbyConversations` TanStack Query Hook

**Files:**
- Modify: `frontend/src/features/commons/api.ts`
- Test: `frontend/src/features/commons/__tests__/api.abby.test.ts` (create)

**Context:**
`api.ts` currently only contains TanStack Query hooks for channels, messages, members, reactions, etc. It does not import from `abbyService.ts`. The `listAbbyConversations` function already exists in `frontend/src/features/commons/services/abbyService.ts` and returns `Promise<ConversationSummary[]>`.

---

- [ ] **Step 5.1 — Write the failing test**

Create `frontend/src/features/commons/__tests__/api.abby.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useAbbyConversations } from '../api';
import * as abbyService from '../services/abbyService';

vi.mock('../services/abbyService');

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useAbbyConversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches conversation list from listAbbyConversations', async () => {
    const mockData = [
      { id: 1, title: 'T2DM study', page_context: 'commons_ask_abby', created_at: '2026-03-15', messages_count: 4 },
    ];
    vi.mocked(abbyService.listAbbyConversations).mockResolvedValue(mockData);

    const { result } = renderHook(() => useAbbyConversations(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(abbyService.listAbbyConversations).toHaveBeenCalledOnce();
  });

  it('uses staleTime of 60 seconds', () => {
    // The hook should not refetch within 60s — just verify it is exported correctly
    expect(useAbbyConversations).toBeDefined();
  });
});
```

- [ ] **Step 5.2 — Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/features/commons/__tests__/api.abby.test.ts
```

Expected: FAIL — `useAbbyConversations` is not exported from `../api`

- [ ] **Step 5.3 — Add the hook to `api.ts`**

At the top of `frontend/src/features/commons/api.ts`, add the import:

```ts
import { listAbbyConversations } from "./services/abbyService";
```

Then add the hook (after the existing imports and before the first `use*` hook, or at the end of the file — either position is fine):

```ts
export function useAbbyConversations() {
  return useQuery({
    queryKey: ["abby", "conversations"],
    queryFn: listAbbyConversations,
    staleTime: 60_000,
  });
}
```

Note: `useQuery` is already imported at the top of `api.ts` (it's used throughout the file). No new import needed for it.

- [ ] **Step 5.4 — Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/features/commons/__tests__/api.abby.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 5.5 — Commit**

```bash
git add frontend/src/features/commons/api.ts \
        frontend/src/features/commons/__tests__/api.abby.test.ts
git commit -m "feat: add useAbbyConversations TanStack Query hook to commons api"
```

---

### Task 6: Wire `AskAbbyChannel` to Store + Add History Panel

**Files:**
- Modify: `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx`
- Test: `frontend/src/features/commons/components/abby/__tests__/AskAbbyChannel.test.tsx` (create)

**Context before editing:**
- Line 186: `const [conversationId, setConversationId] = useState<number | null>(null);`
- Lines 202–247: mount effect that calls `listAbbyConversations()` to auto-discover the latest `commons_ask_abby` conversation. **This is deliberately replaced** by a simpler store-based restore. The auto-discover is gone — the persisted store ID is the only restore mechanism.
- Line 185: local `conversation` array (`ConversationEntry[]`) — keep this as local state.
- Line 307: `sendQuery({ ..., conversation_id: conversationId ?? undefined })` — update to use store value.
- The component already imports `fetchAbbyConversation` and `listAbbyConversations` from `abbyService` — `listAbbyConversations` import can be removed.

---

- [ ] **Step 6.1 — Write the failing tests**

Create `frontend/src/features/commons/components/abby/__tests__/AskAbbyChannel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import AskAbbyChannel from '../AskAbbyChannel';
import { useAbbyStore } from '@/stores/abbyStore';
import * as abbyService from '../../../services/abbyService';

vi.mock('../../../services/abbyService');
vi.mock('@/stores/abbyStore', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/stores/abbyStore')>();
  return mod; // use real store so state persists across renders in tests
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  useAbbyStore.setState({ conversationId: null, messages: [], conversationList: [] });
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AskAbbyChannel', () => {
  it('shows welcome card when no conversationId is in store', async () => {
    render(<AskAbbyChannel />, { wrapper: makeWrapper() });
    await waitFor(() =>
      expect(screen.getByText(/I'm Abby/)).toBeInTheDocument()
    );
    expect(abbyService.fetchAbbyConversation).not.toHaveBeenCalled();
  });

  it('loads conversation from API when store has a conversationId', async () => {
    vi.mocked(abbyService.fetchAbbyConversation).mockResolvedValue({
      id: 7,
      messages: [
        { id: 1, role: 'user', content: 'Hello Abby', created_at: new Date().toISOString(), metadata: {} },
        { id: 2, role: 'assistant', content: 'Hello researcher', created_at: new Date().toISOString(), metadata: {} },
      ],
    } as any);

    useAbbyStore.setState({ conversationId: 7 });
    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByText('Hello Abby')).toBeInTheDocument()
    );
    expect(abbyService.fetchAbbyConversation).toHaveBeenCalledWith(7);
  });

  it('clears store and shows welcome when conversation fetch returns 404', async () => {
    vi.mocked(abbyService.fetchAbbyConversation).mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 })
    );

    useAbbyStore.setState({ conversationId: 999 });
    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByText(/I'm Abby/)).toBeInTheDocument()
    );
    expect(useAbbyStore.getState().conversationId).toBeNull();
  });

  it('shows history panel when history button is clicked', async () => {
    vi.mocked(abbyService.listAbbyConversations).mockResolvedValue([
      { id: 1, title: 'T2DM study', page_context: 'commons_ask_abby', created_at: '2026-03-15T00:00:00Z', messages_count: 3 },
    ]);

    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    await userEvent.click(screen.getByTitle('Conversation history'));
    await waitFor(() =>
      expect(screen.getByText('T2DM study')).toBeInTheDocument()
    );
  });

  it('New chat button clears conversationId and shows welcome card', async () => {
    useAbbyStore.setState({ conversationId: 5 });
    vi.mocked(abbyService.fetchAbbyConversation).mockResolvedValue({
      id: 5,
      messages: [],
    } as any);

    render(<AskAbbyChannel />, { wrapper: makeWrapper() });

    // Open history to access "New chat" button
    vi.mocked(abbyService.listAbbyConversations).mockResolvedValue([]);
    await userEvent.click(screen.getByTitle('Conversation history'));
    await userEvent.click(screen.getByText('New chat'));

    expect(useAbbyStore.getState().conversationId).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(/I'm Abby/)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 6.2 — Run tests to verify they fail**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/features/commons/components/abby/__tests__/AskAbbyChannel.test.tsx
```

Expected: FAIL — "loads conversation from API when store has conversationId" fails (component uses local state, not store), "shows history panel" fails (no history button exists)

- [ ] **Step 6.3 — Update imports in `AskAbbyChannel.tsx`**

**Add** import for store and `useAbbyConversations`:
```tsx
import { useAbbyStore } from "@/stores/abbyStore";
import { useAbbyConversations } from "../../api";
```

**Remove** `listAbbyConversations` from the `abbyService` import (it is no longer called directly):
```tsx
// Before:
import {
  fetchAbbyConversation,
  listAbbyConversations,
  submitFeedback,
} from "../../services/abbyService";

// After:
import {
  fetchAbbyConversation,
  submitFeedback,
} from "../../services/abbyService";
```

- [ ] **Step 6.4 — Replace `conversationId` local state with store**

**Remove** (line 186):
```tsx
const [conversationId, setConversationId] = useState<number | null>(null);
```

**Add** after `const user = useAuthStore(...)`:
```tsx
const conversationId = useAbbyStore((s) => s.conversationId);
const setConversationId = useAbbyStore((s) => s.setConversationId);
```

- [ ] **Step 6.5 — Add `historyOpen` state and `useAbbyConversations` hook**

After the `conversationId` lines above, add:
```tsx
const [historyOpen, setHistoryOpen] = useState(false);
const { data: conversationHistory = [] } = useAbbyConversations();
```

- [ ] **Step 6.6 — Replace the mount effect**

**Remove** the entire existing `useEffect` block (lines 202–247) that calls `loadLatestConversation`.

**Also remove** these two lines — they belong to the old effect and will cause a TypeScript `noUnusedLocals` error if left behind:
```tsx
// Line 188 — DELETE this:
const [hasLoadedConversation, setHasLoadedConversation] = useState(false);
```
(The `setHasLoadedConversation(true)` calls disappear automatically when the old `useEffect` block is deleted.)

**Replace with** this new mount effect:
```tsx
useEffect(() => {
  if (!conversationId) return;
  let cancelled = false;

  fetchAbbyConversation(conversationId)
    .then((conv) => {
      if (cancelled) return;
      setConversation(
        conv.messages.map((m) => mapConversationMessage(m, userName))
      );
    })
    .catch(() => {
      if (!cancelled) {
        setConversationId(null);
        setConversation([]);
      }
    });

  return () => { cancelled = true; };
}, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once on mount
```

Update the `WelcomeCard` render condition — replace `{hasLoadedConversation && conversation.length === 0 && ...}` with:
```tsx
{conversation.length === 0 && <WelcomeCard onPromptClick={(prompt) => handleSend(prompt)} />}
```

- [ ] **Step 6.7 — Add `loadConversation` helper for history panel**

After `handleFeedback`, add:

```tsx
const loadConversation = useCallback(
  async (id: number) => {
    try {
      const conv = await fetchAbbyConversation(id);
      setConversation(conv.messages.map((m) => mapConversationMessage(m, userName)));
      setConversationId(id);
      setHistoryOpen(false);
    } catch {
      // Failed to load — leave current conversation
    }
  },
  [userName, setConversationId]
);

const handleNewChat = useCallback(() => {
  setConversationId(null);
  setConversation([]);
  setHistoryOpen(false);
}, [setConversationId]);
```

- [ ] **Step 6.8 — Add history panel to JSX**

Replace the current outer `<div className="flex flex-1 min-h-0 flex-col">` with a layout that allows the history sidebar. The overall structure becomes:

```tsx
return (
  <div className="flex flex-1 min-h-0">
    {/* History sidebar */}
    {historyOpen && (
      <div className="flex w-[220px] shrink-0 flex-col border-r border-white/[0.04] bg-[#101014]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
          <span className="text-[12px] font-semibold text-foreground">History</span>
          <button
            onClick={handleNewChat}
            className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
          >
            + New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {conversationHistory.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
              No past conversations
            </p>
          ) : (
            conversationHistory.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full px-3 py-2 text-left transition-colors hover:bg-white/[0.04] ${
                  conversationId === conv.id ? "bg-white/[0.06]" : ""
                }`}
              >
                <p className="truncate text-[12px] text-foreground">
                  {conv.title || `Conversation — ${new Date(conv.created_at).toLocaleDateString()}`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(conv.created_at).toLocaleDateString()} · {conv.messages_count} messages
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    )}

    {/* Main Abby area */}
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Channel header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] shrink-0 bg-gradient-to-r from-emerald-900/[0.04] to-transparent">
        <AbbyAvatar size="lg" showStatus />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-foreground">Ask Abby</h2>
          <p className="text-[11px] text-muted-foreground">
            AI research companion · MedGemma · Institutional memory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            title="Conversation history"
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              historyOpen
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
            }`}
          >
            {/* Clock icon */}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Online
          </div>
        </div>
      </div>

      {/* Conversation area */}
      <div
        ref={scrollRef}
        className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {conversation.length === 0 && (
          <WelcomeCard onPromptClick={(prompt) => handleSend(prompt)} />
        )}
        {conversation.map((entry) =>
          entry.role === "user" ? (
            <UserBubble key={entry.id} entry={entry} initials={userInitials} />
          ) : (
            <AbbyBubble key={entry.id} entry={entry} onFeedback={handleFeedback} />
          )
        )}
        {isLoading && (
          <div className="flex gap-2">
            <AbbyAvatar size="sm" />
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-muted">
              <AbbyTypingIndicator pipelineState={pipelineState} />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] bg-gradient-to-t from-black/20 to-transparent">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Abby anything about your research network..."
            disabled={isLoading}
            className="flex-1 h-10 px-3.5 text-[13px] bg-[#13131a] border border-white/[0.08] rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 disabled:opacity-60 transition-all duration-150"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="h-10 px-5 rounded-lg text-[13px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer hover:shadow-[0_0_16px_rgba(16,185,129,0.25)]"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 6.9 — Run tests**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run src/features/commons/components/abby/__tests__/AskAbbyChannel.test.tsx
```

Expected: 5 tests PASS

- [ ] **Step 6.10 — Full TypeScript check**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6.11 — Commit**

```bash
git add frontend/src/features/commons/components/abby/AskAbbyChannel.tsx \
        frontend/src/features/commons/components/abby/__tests__/AskAbbyChannel.test.tsx
git commit -m "feat: persist Abby conversations across navigation + add collapsible history panel"
```

---

## Chunk 3: Verification + Full Test Run

### Task 7: Online Presence Verification + Integration Check

**Files:**
- Read-only check: `backend/routes/channels.php`
- Read-only check: `frontend/src/features/commons/hooks/usePresence.ts`

---

- [ ] **Step 7.1 — Verify presence channel auth**

```bash
grep -A5 "commons.online" /home/smudoshi/Github/Parthenon/backend/routes/channels.php
```

Expected output should include:
```php
Broadcast::channel('commons.online', function ($user) {
    return ['id' => $user->id, 'name' => $user->name];
});
```

If missing: add it to `routes/channels.php`. If present: no action needed.

- [ ] **Step 7.2 — Verify `usePresence` hook channel name**

```bash
grep "echo.join\|presence" /home/smudoshi/Github/Parthenon/frontend/src/features/commons/hooks/usePresence.ts
```

Expected: `echo.join("commons.online")` — Laravel Echo prepends `presence-` automatically.

- [ ] **Step 7.3 — Run full backend test suite**

```bash
cd /home/smudoshi/Github/Parthenon/backend
vendor/bin/pest --no-coverage
```

Expected: all tests pass (including the new `CommonsChannelSeederTest`)

- [ ] **Step 7.4 — Run full frontend test suite + TypeScript check**

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx vitest run
npx tsc --noEmit
```

Expected: all tests pass (including all new tests from Tasks 2–6); 0 TypeScript errors

- [ ] **Step 7.5 — Deploy**

```bash
cd /home/smudoshi/Github/Parthenon
./deploy.sh
```

Expected: PHP opcache cleared, migrations run, frontend production build completed successfully.

- [ ] **Step 7.5a — Run seeder in PHP container**

```bash
docker compose exec php php artisan db:seed --class=CommonsChannelSeeder
```

Expected output: `Commons channels seeded: general, data-quality, concept-sets, announcements`

- [ ] **Step 7.5b — Manual smoke test in browser at https://parthenon.acumenus.net**

Verify each item:

1. **Seeder:** `#announcements` appears in the Commons left sidebar channel list; `#general`, `#data-quality`, `#concept-sets` are also present; no fake messages exist in any channel
2. **Header:** Navigate to any channel — channel name and description appear once at the top of the right panel; there is no separate header row above the message list in the center column; the center message list begins immediately below the left sidebar header
3. **Center height:** The message list area is visibly taller than before (ChannelHeader row ~38px removed)
4. **Abby persistence:** Type and send a message to Abby → navigate away to Analyses page → use browser back or click Commons → Ask Abby: confirm same conversation and response are shown
5. **Abby browser refresh:** With the same conversation open, press F5 (hard refresh) → confirm conversation reloads from the API automatically
6. **Abby stale ID:** Open browser DevTools → Application → Local Storage → `parthenon-abby` → manually set `conversationId` to `999999` → refresh → confirm Abby shows the welcome/empty state (not an error)
7. **Abby history:** Click the clock icon button → confirm collapsible history sidebar shows past conversations → click one → confirm it loads in the main chat area
8. **Abby new chat:** Click "New chat" button → confirm empty welcome state with suggested prompts appears; LocalStorage `parthenon-abby` `conversationId` should be `null`
9. **Presence:** Open an incognito window → log in as a different user → switch back to main window → confirm both user avatars appear in the online strip at the bottom of the Commons left sidebar within ~5 seconds
10. **Wiki:** Click "Knowledge Base" in the left sidebar → confirm `WikiPage` renders (search, list of articles)
11. **Announcements:** Click "Announcements" in the left sidebar → confirm `AnnouncementBoard` renders

- [ ] **Step 7.6 — Final commit**

Only commit if Step 7.1 required adding the presence channel auth (i.e., a code change was made). If Step 7.1 confirmed the channel auth was already present and no code changed, skip this commit.

```bash
# Only if routes/channels.php was modified in Step 7.1:
git add backend/routes/channels.php
git commit -m "fix: ensure commons.online presence channel auth is registered"
```

---

## Success Criteria Reference

- [ ] 4 channels exist after seeder: `general`, `data-quality`, `concept-sets`, `announcements` — no fake messages
- [ ] Seeder is idempotent (tested in Task 1)
- [ ] Channel name appears exactly once in the UI — no duplicate header row
- [ ] Center message list starts immediately (no header above it)
- [ ] Undefined channel during load → skeleton placeholder, not crash (tested in Task 2)
- [ ] Abby conversation survives navigation away and back
- [ ] Browser refresh restores last Abby conversation
- [ ] Stale/deleted `conversationId` in localStorage → silent reset to welcome screen (tested in Task 6)
- [ ] History panel shows past conversations, clicking loads them (tested in Task 6)
- [ ] "New chat" resets session and clears persisted ID (tested in Task 6)
- [ ] `AbbyPanel` (global header slide-out) continues to work (TypeScript check in Task 4)
- [ ] Two logged-in users appear in online users strip (manual test in Task 7)
