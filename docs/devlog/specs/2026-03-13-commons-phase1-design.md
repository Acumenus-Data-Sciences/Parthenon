# Commons Workspace — Phase 1: Foundation Design Spec

## Overview

Phase 1 of the Commons Workspace delivers core real-time messaging infrastructure within Parthenon. It establishes a three-panel layout (channel sidebar, message area, right panel shell), channel-based group chat with Markdown support, simple online/offline presence, and the Laravel Reverb WebSocket infrastructure that all future Commons phases build on.

This is Sub-project 1 of 5. See `docs/COMMONS_WORKSPACE_SPEC.md` for the full vision.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Three-panel shell (sidebar + chat + right panel with placeholder tabs) | Establishes visual architecture without building features prematurely |
| Primary keys | Bigint auto-increment | Consistent with existing Parthenon tables; UUID column can be added for federation in Phase 5 |
| Default channels | Seed `#general`, `#data-quality`, `#concept-sets` | Gives researchers immediate useful spaces matching OHDSI workflows |
| Presence scope | Simple online/offline dots | Activity-aware presence ("Currently in: Cohort Builder") deferred to Admin > Users page only |
| Real-time infra | Laravel Reverb (self-hosted WebSockets) | Healthcare/on-prem requirement; no external dependencies; first-class Laravel 11 support |
| Message composer | Markdown input with preview | Natural for researchers; lightweight; spec-aligned |
| Message virtualization | Deferred to Phase 2 | Simple scroll-to-bottom sufficient for initial volumes |

---

## Database Schema

All tables live in the Docker `parthenon` database under the `app` schema. The default Laravel database connection has `search_path = 'app,public'`, so models use unqualified table names (consistent with existing App models like `Source`, `CohortDefinition`, etc.).

### `commons_channels`

| Column | Type | Constraints |
|--------|------|-------------|
| id | bigint | PK, auto-increment |
| name | varchar(100) | NOT NULL |
| slug | varchar(100) | NOT NULL, UNIQUE |
| description | text | nullable |
| type | varchar(20) | NOT NULL, default `'topic'`. Values: `topic`, `study`, `custom` |
| visibility | varchar(20) | NOT NULL, default `'public'`. Values: `public`, `private` |
| study_id | bigint | nullable, FK → studies(id) ON DELETE SET NULL |
| created_by | bigint | NOT NULL, FK → users(id) |
| archived_at | timestamp | nullable |
| created_at | timestamp | NOT NULL |
| updated_at | timestamp | NOT NULL |

**Indexes**: `idx_channels_type(type)`, `idx_channels_study(study_id) WHERE study_id IS NOT NULL`

### `commons_channel_members`

| Column | Type | Constraints |
|--------|------|-------------|
| id | bigint | PK, auto-increment |
| channel_id | bigint | NOT NULL, FK → commons_channels(id) ON DELETE CASCADE |
| user_id | bigint | NOT NULL, FK → users(id) ON DELETE CASCADE |
| role | varchar(20) | NOT NULL, default `'member'`. Values: `owner`, `admin`, `member` |
| notification_preference | varchar(20) | NOT NULL, default `'mentions'`. Values: `all`, `mentions`, `none` |
| last_read_at | timestamp | nullable |
| joined_at | timestamp | NOT NULL, default NOW() |

**Constraints**: UNIQUE(channel_id, user_id)
**Indexes**: `idx_channel_members_user(user_id)`, `idx_channel_members_channel(channel_id)`

### `commons_messages`

| Column | Type | Constraints |
|--------|------|-------------|
| id | bigint | PK, auto-increment |
| channel_id | bigint | NOT NULL, FK → commons_channels(id) ON DELETE CASCADE |
| user_id | bigint | NOT NULL, FK → users(id) |
| parent_id | bigint | nullable, FK → commons_messages(id) ON DELETE CASCADE (for Phase 2 threading) |
| body | text | NOT NULL |
| body_html | text | nullable |
| is_edited | boolean | NOT NULL, default false |
| edited_at | timestamp | nullable |
| deleted_at | timestamp | nullable (soft delete) |
| created_at | timestamp | NOT NULL |
| updated_at | timestamp | NOT NULL |

**Indexes**: `idx_messages_channel_created(channel_id, created_at DESC)`, `idx_messages_parent(parent_id) WHERE parent_id IS NOT NULL`, `idx_messages_user(user_id)`, `idx_messages_search USING gin(to_tsvector('english', body))`

---

## API Endpoints

All under `/api/v1/commons/`, protected by `auth:sanctum`.

### Channels

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/channels` | List channels (joined + public) | authenticated |
| POST | `/channels` | Create channel | authenticated |
| GET | `/channels/{slug}` | Get channel details + member count | authenticated |
| PATCH | `/channels/{slug}` | Update channel | owner or admin |
| POST | `/channels/{slug}/archive` | Archive channel | owner only |

### Messages

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/channels/{slug}/messages` | Cursor-paginated messages | channel member (public channels: any authenticated user) |
| POST | `/channels/{slug}/messages` | Send message + broadcast | channel member, `throttle:60,1` |
| PATCH | `/messages/{id}` | Edit message | author only |
| DELETE | `/messages/{id}` | Soft-delete message | author or channel admin |

### Members

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/channels/{slug}/members` | List members with presence | channel member |
| POST | `/channels/{slug}/members` | Join (public) or invite (admin, private) | authenticated |
| DELETE | `/channels/{slug}/members/{id}` | Leave or remove | self or channel admin |
| POST | `/channels/{slug}/read` | Mark channel as read (updates `last_read_at`) | channel member |

### Channel Access Model

- **Public channels**: Any authenticated user can read messages and join. Writing requires membership (auto-join on first message send).
- **Private channels**: Only members can read or write. Members must be explicitly added by a channel admin/owner.
- `ChannelPolicy` enforces these rules. The `GET /channels` endpoint returns all public channels plus private channels the user is a member of.

### Pagination

Messages use **cursor-based pagination** with `id` as cursor:
- `GET /channels/{slug}/messages?before={id}&limit=50`
- Cursor comparison is `WHERE id < :before` (bigint auto-increment guarantees newer = higher ID)
- Returns messages in descending order, avoids offset issues with real-time inserts

---

## Real-Time Broadcasting (Laravel Reverb)

### Infrastructure

New Docker service reusing existing PHP image:

```yaml
reverb:
  build:
    context: ./docker
    dockerfile: Dockerfile
  command: php artisan reverb:start --host=0.0.0.0 --port=8080
  ports:
    - "${REVERB_PORT:-8080}:8080"
  env_file:
    - ./backend/.env
  volumes:
    - ./backend:/var/www/html
  depends_on:
    - redis
  networks:
    - parthenon
  healthcheck:
    test: ["CMD", "php", "-r", "echo @fsockopen('127.0.0.1', 8080) ? 'ok' : exit(1);"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Production WebSocket Proxy

In production, Reverb must NOT be exposed directly. The Apache reverse proxy at `parthenon.acumenus.net` must proxy WebSocket connections:

```apache
# Apache vhost addition for WebSocket proxy
ProxyPass /app ws://localhost:8080/app
ProxyPassReverse /app ws://localhost:8080/app
```

Frontend `VITE_REVERB_HOST` and `VITE_REVERB_PORT` should point to the main app domain in production (e.g., `parthenon.acumenus.net` on port 443 with `wss://`), not `localhost:8080`. The Reverb port should be firewalled from external access.

### Environment Variables

```env
# Backend
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=parthenon-commons
REVERB_APP_KEY=<generate-with-php-artisan-reverb:install>
REVERB_APP_SECRET=<generate-with-php-artisan-reverb:install>
REVERB_HOST=reverb
REVERB_PORT=8080
REVERB_SCHEME=http

# Frontend (Vite)
VITE_REVERB_APP_KEY=${REVERB_APP_KEY}
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

### Events

| Event Class | Broadcast Channel | Trigger | Payload |
|-------------|-------------------|---------|---------|
| `MessageSent` | `private-commons.channel.{channelId}` | New message saved | `{message: {id, user, body, body_html, parent_id, created_at}}` |
| `MessageUpdated` | `private-commons.channel.{channelId}` | Message edited or soft-deleted | `{message: {id, body, body_html, is_edited, deleted_at}, action: 'edited'\|'deleted'}` |

### Presence

Single presence channel: `presence-commons.online`

- Reverb handles join/leave automatically via presence channel protocol
- Authorization returns `{id, name}` for the joining user
- Frontend subscribes on app mount, updates online user list from `here()`, `joining()`, `leaving()` callbacks
- No heartbeat code needed — Reverb manages connection lifecycle

### Channel Authorization (`routes/channels.php`)

```php
// Any authenticated user joins presence
Broadcast::channel('commons.online', fn (User $user) => [
    'id' => $user->id,
    'name' => $user->name,
]);

// Only channel members receive messages
Broadcast::channel('commons.channel.{channelId}', function (User $user, int $channelId) {
    return ChannelMember::where('channel_id', $channelId)
        ->where('user_id', $user->id)
        ->exists();
});
```

---

## Frontend Architecture

### File Structure

```
frontend/src/features/commons/
├── pages/
│   └── CommonsPage.tsx            # Route-level page, renders CommonsLayout
├── components/
│   ├── CommonsLayout.tsx          # Three-panel flex container
│   ├── sidebar/
│   │   ├── ChannelList.tsx        # Channel sections (topic, study, DM placeholder)
│   │   ├── ChannelSearch.tsx      # Filter channels by name
│   │   └── OnlineUsers.tsx        # Presence dots at sidebar bottom
│   ├── chat/
│   │   ├── MessageList.tsx        # Scrollable message list, auto-scroll on new
│   │   ├── MessageItem.tsx        # Avatar, name, timestamp, rendered Markdown body
│   │   ├── MessageComposer.tsx    # Markdown textarea + formatting hints + send
│   │   └── ChannelHeader.tsx      # Channel name, description, right-panel toggle buttons
│   └── rightpanel/
│       └── RightPanel.tsx         # Tabbed shell (Activity, Pinned, Files) with "coming soon" placeholders
├── hooks/
│   ├── useChannels.ts             # TanStack Query: list, create, update channels
│   ├── useMessages.ts            # TanStack Query: cursor-paginated messages + Echo listener for real-time append
│   └── usePresence.ts            # Echo presence channel: online users list
├── api.ts                         # Axios API functions for all Commons endpoints
└── types.ts                       # TypeScript interfaces: Channel, Message, Member, PresenceUser
```

### Key Patterns

- **TanStack Query** for all data fetching (consistent with Parthenon codebase)
- **No Zustand store** in Phase 1 — TanStack Query cache handles channel/message state
- **Echo integration** via `usePresence` hook: joins `presence-commons.online` on mount, provides `onlineUsers` array
- **`useMessages` hook** subscribes to `private-commons.channel.{id}` via Echo, appends incoming `MessageSent` events to the query cache
- **Markdown rendering** via `react-markdown` + `remark-gfm` + `rehype-sanitize` (GFM support, XSS prevention)
- **Scroll behavior**: auto-scroll to bottom on new messages when user is at the bottom; show "New messages" indicator when scrolled up

### Routing

| Route | Component | Description |
|-------|-----------|-------------|
| `/commons` | CommonsPage | Default view, opens `#general` |
| `/commons/:slug` | CommonsPage | Opens specific channel |

### Sidebar Navigation

New top-level item positioned below Dashboard:

```tsx
{ name: 'Commons', href: '/commons', icon: MessageSquare }
```

Uses `lucide-react` `MessageSquare` icon, consistent with existing nav items.

### Echo Provider

Global `EchoProvider` component wraps the app inside `MainLayout`:

- Initializes `laravel-echo` with Pusher driver (Reverb is Pusher-protocol compatible)
- Connects to `ws://localhost:8080` (configurable via `VITE_REVERB_*` env vars)
- Provides Echo instance via React context
- Subscribes to presence channel on mount

---

## Laravel Backend Structure

### Models

```
backend/app/Models/Commons/
├── Channel.php          # HasMany: members, messages. BelongsTo: creator (User), study
├── ChannelMember.php    # BelongsTo: channel, user
└── Message.php          # BelongsTo: channel, user, parent (self). HasMany: replies
```

### Controllers

```
backend/app/Http/Controllers/Api/V1/Commons/
├── ChannelController.php    # CRUD for channels
├── MessageController.php    # CRUD for messages + broadcast dispatch
└── MemberController.php     # Join/leave/remove members
```

### Events

```
backend/app/Events/Commons/
├── MessageSent.php          # implements ShouldBroadcast
└── MessageUpdated.php       # implements ShouldBroadcast
```

### Form Requests

```
backend/app/Http/Requests/Commons/
├── CreateChannelRequest.php
├── UpdateChannelRequest.php
├── SendMessageRequest.php
└── UpdateMessageRequest.php
```

### Policies

```
backend/app/Policies/Commons/
├── ChannelPolicy.php    # Channel CRUD + archive authorization
└── MessagePolicy.php    # Message edit/delete authorization
```

### Services

```
backend/app/Services/Commons/
└── MessageService.php   # Message creation, Markdown→HTML rendering, mention extraction
```

`MessageService` handles `body_html` generation:
- On every `create()` and `update()`, converts `body` (raw Markdown) to `body_html` using `league/commonmark` with `GithubFlavoredMarkdownExtension`
- CommonMark environment configured with `disallowed_raw_html` extension to strip all raw HTML tags
- `body_html` is NEVER set from user input directly — always computed from `body`

### Seeder

`CommonsChannelSeeder` creates three default channels:
- `#general` (topic, public) — "General discussion for the team"
- `#data-quality` (topic, public) — "Data quality discussions and DQD results"
- `#concept-sets` (topic, public) — "Concept set design and review"

All existing users auto-join all three channels on seed. The seeder creator is the super-admin user. The seeder is idempotent — uses `firstOrCreate` to avoid duplicate channels/memberships on re-run.

---

## Security Considerations

- All endpoints require `auth:sanctum`
- Channel membership checked before message read/write (private channels via `ChannelPolicy`)
- Message edit/delete restricted to author (or channel admin for delete)
- Markdown rendered with `rehype-sanitize` — raw HTML stripped on frontend
- `body_html` pre-rendered server-side via `league/commonmark` with HTML purification
- Rate limiting on message sends: `throttle:60,1` (60/min per user)
- Reverb WebSocket auth uses existing Sanctum session/token
- No secrets in broadcast payloads — only user id, name, message content
- `commons_messages.user_id` and `commons_channels.created_by` use `ON DELETE RESTRICT` — users cannot be deleted while they have messages or channels (preserves audit trail)

---

## What's Deferred to Later Phases

| Feature | Phase |
|---------|-------|
| Direct messaging (DM channels) | Phase 2 |
| Threaded replies UI | Phase 2 |
| @mention autocomplete | Phase 2 |
| File uploads / attachments | Phase 2 |
| Typing indicators | Phase 2 |
| Message edit/delete UI | Phase 2 |
| Object reference cards | Phase 3 |
| Activity feed (right panel) | Phase 3 |
| Notification system | Phase 3 |
| Pinned messages | Phase 3 |
| Request for Review | Phase 4 |
| Announcements | Phase 4 |
| Wiki / Knowledge Base | Phase 4 |
| Cross-site federation | Phase 5 |
| Activity-aware presence on Admin > Users | Future |

---

## Required Packages

### Backend (Composer)
- `laravel/reverb` — WebSocket server
- `league/commonmark` — Markdown→HTML rendering (likely already installed with Laravel)

### Frontend (npm, install with `--legacy-peer-deps`)
- `laravel-echo` — WebSocket client for Laravel broadcasting
- `pusher-js` — Transport layer (Reverb uses Pusher protocol)
- `react-markdown` — Markdown rendering
- `remark-gfm` — GitHub Flavored Markdown support
- `rehype-sanitize` — HTML sanitization for rendered Markdown

### Notes
- `parent_id` column is included in the `commons_messages` schema now but threading UI is deferred to Phase 2. In Phase 1, `parent_id` is always `null`.
