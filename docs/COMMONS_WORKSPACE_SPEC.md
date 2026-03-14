# Parthenon Commons Workspace — Implementation Specification

## Overview

The Commons is a real-time collaborative communication workspace built into the Parthenon platform. It replaces the need for external tools (Slack, Teams, email) by embedding contextual, persistent communication directly alongside research workflows. The Commons is a first-class module within Parthenon's existing Laravel 11 + React 19 + TypeScript + PostgreSQL 17 + Docker Compose architecture.

**Strategic context**: No tool in the OHDSI ecosystem provides integrated collaboration. Parthenon's Commons will be a key differentiator — the feature that makes research teams *live* in the platform rather than just visit it for queries.

---

## Tech Stack (Existing Parthenon Stack)

- **Backend**: Laravel 11 (PHP 8.3+)
- **Frontend**: React 19 + TypeScript + Vite
- **Database**: PostgreSQL 17
- **Cache/Queue**: Redis
- **Real-time**: Laravel Reverb (WebSocket server, ships with Laravel 11)
- **Auth**: Existing Parthenon auth system (Sanctum/session-based)
- **Containerization**: Docker Compose

---

## Feature Specification

### 1. User Presence System

**Requirements**:
- Display all currently logged-in users with online/away/offline status
- Show what each online user is currently doing in the platform (e.g., "Cohort Builder", "Results Viewer", "Studies module")
- Presence sidebar visible from any page in the platform, not just the Commons
- Cross-site presence for federated deployments (show users at other sites with site badges)
- Clicking a user opens a DM or shows their profile card

**Implementation approach**:
- Use Laravel Reverb presence channels (`PresenceChannel`)
- Track user activity via middleware that broadcasts current route/module on each page navigation
- Store transient presence data in Redis (not PostgreSQL) — presence is ephemeral
- Presence heartbeat every 30 seconds; mark as "away" after 5 minutes of inactivity

**Laravel event**:
```php
// App\Events\UserPresenceUpdated
class UserPresenceUpdated implements ShouldBroadcast
{
    public function __construct(
        public User $user,
        public string $status,       // 'online' | 'away' | 'offline'
        public ?string $currentModule, // 'cohort-builder' | 'studies' | 'results' | etc.
        public ?string $currentObjectName, // 'T2DM Primary v3.2'
        public ?int $siteId           // For federated deployments
    ) {}

    public function broadcastOn(): array
    {
        return [new PresenceChannel('commons.presence')];
    }
}
```

**React component structure**:
```
<PresenceProvider>          // Context provider wrapping the app
  <PresenceSidebar />       // Collapsible sidebar on Commons page
  <PresenceIndicator />     // Compact indicator on other pages (shows count + avatars)
</PresenceProvider>
```

---

### 2. Channel-Based Group Chat

**Requirements**:
- Channels organized by type: study channels (auto-created per study), topic channels (data-quality, concept-sets, general), and custom channels
- Channel creation with name, description, and optional auto-membership rules (e.g., all members of a study)
- Public channels (visible to all platform users) and private channels (invite-only)
- Threaded replies on any message
- Rich text messages with Markdown support
- @mentions with autocomplete for users and @channel for broadcast
- Message editing and deletion (with audit trail)
- Unread counts and per-channel notification preferences
- Message search across all channels the user has access to
- Pinned messages per channel

**Database schema**:

```sql
-- Channels
CREATE TABLE commons_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'topic',  -- 'topic' | 'study' | 'custom'
    visibility VARCHAR(20) NOT NULL DEFAULT 'public',  -- 'public' | 'private'
    study_id UUID REFERENCES studies(id) ON DELETE SET NULL,  -- Link to study if type='study'
    created_by UUID NOT NULL REFERENCES users(id),
    archived_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_channels_type ON commons_channels(type);
CREATE INDEX idx_channels_study ON commons_channels(study_id) WHERE study_id IS NOT NULL;

-- Channel membership
CREATE TABLE commons_channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES commons_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
    notification_preference VARCHAR(20) NOT NULL DEFAULT 'mentions',  -- 'all' | 'mentions' | 'none'
    last_read_at TIMESTAMP,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

CREATE INDEX idx_channel_members_user ON commons_channel_members(user_id);
CREATE INDEX idx_channel_members_channel ON commons_channel_members(channel_id);

-- Messages
CREATE TABLE commons_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES commons_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES commons_messages(id) ON DELETE CASCADE,  -- Thread parent
    body TEXT NOT NULL,
    body_html TEXT,  -- Pre-rendered HTML from Markdown
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP,  -- Soft delete
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_channel_created ON commons_messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_parent ON commons_messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_messages_user ON commons_messages(user_id);
CREATE INDEX idx_messages_search ON commons_messages USING gin(to_tsvector('english', body));

-- Pinned messages
CREATE TABLE commons_pinned_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES commons_channels(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES commons_messages(id) ON DELETE CASCADE,
    pinned_by UUID NOT NULL REFERENCES users(id),
    pinned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(channel_id, message_id)
);
```

**Laravel broadcasting**:
```php
// When a message is sent, broadcast to the channel
class MessageSent implements ShouldBroadcast
{
    public function __construct(public Message $message) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("commons.channel.{$this->message->channel_id}")];
    }

    public function broadcastWith(): array
    {
        return [
            'message' => [
                'id' => $this->message->id,
                'user' => $this->message->user->only(['id', 'name', 'initials', 'avatar_url']),
                'body' => $this->message->body,
                'body_html' => $this->message->body_html,
                'parent_id' => $this->message->parent_id,
                'created_at' => $this->message->created_at->toISOString(),
                'object_references' => $this->message->objectReferences,
            ],
        ];
    }
}
```

**API endpoints**:
```
GET    /api/commons/channels                    — List channels for current user
POST   /api/commons/channels                    — Create channel
GET    /api/commons/channels/{slug}             — Get channel details
PATCH  /api/commons/channels/{slug}             — Update channel
DELETE /api/commons/channels/{slug}             — Archive channel

GET    /api/commons/channels/{slug}/messages    — List messages (paginated, cursor-based)
POST   /api/commons/channels/{slug}/messages    — Send message
PATCH  /api/commons/messages/{id}               — Edit message
DELETE /api/commons/messages/{id}               — Soft-delete message

GET    /api/commons/channels/{slug}/members     — List channel members
POST   /api/commons/channels/{slug}/members     — Add member
DELETE /api/commons/channels/{slug}/members/{id} — Remove member
PATCH  /api/commons/channels/{slug}/members/{id} — Update notification preference

POST   /api/commons/channels/{slug}/pins        — Pin message
DELETE /api/commons/channels/{slug}/pins/{id}   — Unpin message

GET    /api/commons/messages/search?q=          — Full-text search messages
GET    /api/commons/channels/{slug}/threads/{parentId} — Get thread messages
```

---

### 3. Direct Messaging (User-to-User Chat)

**Requirements**:
- One-on-one private conversations between any two platform users
- Same message features as channel chat (Markdown, threading, object references)
- DM conversations listed in the sidebar with unread indicators
- Typing indicators for DMs
- Option to escalate a DM conversation into a channel (for when a private discussion becomes relevant to the team)

**Implementation**:
- DMs are modeled as private channels with exactly two members and `type = 'dm'`
- Reuses the same `commons_messages` table and broadcasting infrastructure
- DM channels are auto-created on first message between two users
- Typing indicators use a dedicated ephemeral Reverb event (not stored in DB)

```sql
-- DM channels use the same commons_channels table with type='dm'
-- The slug for DMs is deterministic: dm_{sorted_user_id_1}_{sorted_user_id_2}
```

```php
// Ephemeral typing indicator — not persisted
class UserTyping implements ShouldBroadcast
{
    public function __construct(
        public string $channelId,
        public User $user
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("commons.channel.{$this->channelId}")];
    }

    public function broadcastAs(): string
    {
        return 'typing';
    }
}
```

---

### 4. Contextual Object References

**This is the most important differentiating feature.** Messages can reference any Parthenon object — cohort definitions, concept sets, analysis results, studies, data sources — creating a bidirectional link between conversation and research artifacts.

**Requirements**:
- Inline object reference cards in messages (like link previews, but for platform objects)
- Autocomplete picker triggered by `/ref` or a toolbar button when composing messages
- Object reference cards show: object type icon, name, status, last modified date, and a "Jump to" link
- Reverse lookup: from any Parthenon object, see all Commons discussions that reference it
- Object references are first-class database records, not just URLs in text

**Database schema**:

```sql
-- Object references (polymorphic link between messages and any Parthenon entity)
CREATE TABLE commons_object_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES commons_messages(id) ON DELETE CASCADE,
    referenceable_type VARCHAR(50) NOT NULL,  -- 'cohort_definition' | 'concept_set' | 'study' | 'analysis_result' | 'data_source'
    referenceable_id UUID NOT NULL,
    display_name VARCHAR(255) NOT NULL,  -- Cached name for rendering without joins
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_object_refs_message ON commons_object_references(message_id);
CREATE INDEX idx_object_refs_target ON commons_object_references(referenceable_type, referenceable_id);
```

**React component**:
```tsx
// Inline reference card in messages
interface ObjectReference {
    id: string;
    type: 'cohort_definition' | 'concept_set' | 'study' | 'analysis_result' | 'data_source';
    referenceableId: string;
    displayName: string;
}

// ObjectReferenceCard renders as a compact clickable card
// ObjectReferencePicker is the autocomplete search modal for attaching references
```

**API endpoints**:
```
GET  /api/commons/objects/search?q=&type=   — Search platform objects for reference picker
GET  /api/commons/objects/{type}/{id}/discussions — Get all messages referencing this object
```

---

### 5. Request for Review Workflow

**Requirements**:
- Any user can create a "Request for Review" (RfR) from the Commons, attached to a specific platform object
- RfR has states: `pending` → `in_review` → `approved` | `changes_requested` | `rejected`
- Assigned reviewer(s) get a notification and the RfR appears in their Reviews tab
- Review comments are threaded messages in the channel where the RfR was created
- State changes are broadcast and logged in the activity feed
- Designed to support multi-site review workflows (Site A researcher requests review from Site B statistician)

**Database schema**:

```sql
CREATE TABLE commons_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES commons_channels(id),
    message_id UUID REFERENCES commons_messages(id),  -- The message that initiated the review
    referenceable_type VARCHAR(50) NOT NULL,
    referenceable_id UUID NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE commons_review_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES commons_reviews(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    decision VARCHAR(20),  -- NULL | 'approved' | 'changes_requested' | 'rejected'
    comment TEXT,
    decided_at TIMESTAMP,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(review_id, reviewer_id)
);

CREATE INDEX idx_reviews_channel ON commons_reviews(channel_id);
CREATE INDEX idx_reviews_status ON commons_reviews(status) WHERE status IN ('pending', 'in_review');
CREATE INDEX idx_review_assignments_reviewer ON commons_review_assignments(reviewer_id);
```

**API endpoints**:
```
POST   /api/commons/reviews                    — Create review request
GET    /api/commons/reviews?status=pending      — List reviews (filterable by status, channel, assignee)
PATCH  /api/commons/reviews/{id}               — Update review status
POST   /api/commons/reviews/{id}/decisions     — Submit reviewer decision
GET    /api/commons/reviews/{id}               — Get review details with decisions
```

---

### 6. Activity Feed

**Requirements**:
- Real-time feed of platform events relevant to the current channel or globally
- Event types: cohort updated, analysis completed, study status changed, review requested/resolved, IRB status change, data refresh, new member joined, file shared
- Activity items link back to the source object
- Filterable by event type
- Available both per-channel (in the right panel) and globally (on the Commons home page)

**Database schema**:

```sql
CREATE TABLE commons_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES commons_channels(id) ON DELETE CASCADE,  -- NULL = global
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,  -- 'cohort_updated' | 'analysis_completed' | 'review_requested' | 'irb_status_changed' | 'file_shared' | 'member_joined' | etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    referenceable_type VARCHAR(50),
    referenceable_id UUID,
    metadata JSONB DEFAULT '{}',  -- Flexible data for rendering (old value, new value, etc.)
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_channel ON commons_activities(channel_id, created_at DESC);
CREATE INDEX idx_activities_global ON commons_activities(created_at DESC) WHERE channel_id IS NULL;
CREATE INDEX idx_activities_type ON commons_activities(event_type);
```

**Integration pattern**: Other Parthenon modules fire Laravel events (e.g., `CohortDefinitionUpdated`). A dedicated `CommonsActivityListener` subscribes to these events and creates activity records + broadcasts them to relevant channels.

```php
// App\Listeners\CommonsActivityListener
class CommonsActivityListener
{
    // Map of domain events to activity creation logic
    protected array $eventMap = [
        CohortDefinitionUpdated::class => 'handleCohortUpdate',
        AnalysisCompleted::class => 'handleAnalysisComplete',
        StudyStatusChanged::class => 'handleStudyStatusChange',
        // ... etc.
    ];
}
```

---

### 7. File and Artifact Sharing

**Requirements**:
- Drag-and-drop file upload in message composer
- Supported types: PDF, DOCX, CSV, PNG/JPG, and Parthenon export formats
- Inline preview for images and PDFs
- Files tagged to channels and optionally to platform objects
- "Files" tab in the right panel showing all files shared in the channel
- File size limit: 25MB per file

**Database schema**:

```sql
CREATE TABLE commons_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES commons_messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,  -- Path in local/S3 storage
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON commons_attachments(message_id);
```

---

### 8. Notification System

**Requirements**:
- Notification types: @mention, DM received, review assigned, review resolved, study status change, reply to your thread
- Per-channel notification preferences: all messages, mentions only, none
- Global daily digest option (email) for less active users
- In-app notification bell with unread count
- Push notification support (future — structure for it now)

**Database schema**:

```sql
CREATE TABLE commons_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- 'mention' | 'dm' | 'review_assigned' | 'review_resolved' | 'thread_reply' | 'study_status'
    title VARCHAR(255) NOT NULL,
    body TEXT,
    channel_id UUID REFERENCES commons_channels(id),
    message_id UUID REFERENCES commons_messages(id),
    referenceable_type VARCHAR(50),
    referenceable_id UUID,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON commons_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON commons_notifications(user_id, created_at DESC);
```

**API endpoints**:
```
GET    /api/commons/notifications               — List notifications (paginated)
GET    /api/commons/notifications/unread-count   — Unread count for bell icon
POST   /api/commons/notifications/mark-read      — Mark notifications as read (by ID or all)
PATCH  /api/commons/notifications/preferences    — Update notification preferences
```

---

### 9. Announcement Board / Bulletin

**Requirements**:
- Structured posts (not chat messages) for: study recruitment, data refresh notices, new concept set announcements, milestone notifications, policy updates
- Posts have a title, body (Markdown), category, and optional expiration date
- Pinned/featured posts appear at the top
- Posts can be scoped to specific channels or shown globally
- Users can bookmark posts for later reference

**Database schema**:

```sql
CREATE TABLE commons_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES commons_channels(id),  -- NULL = global
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    body_html TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'general',  -- 'general' | 'study_recruitment' | 'data_update' | 'milestone' | 'policy'
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE commons_announcement_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES commons_announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);
```

---

### 10. Knowledge Base / Wiki

**Requirements**:
- Lightweight wiki for institutional knowledge: why a concept set was designed a certain way, lessons learned, tips for specific data sources
- Articles with Markdown body, tags, and linked platform objects
- Versioning (edit history with diffs)
- Search across all articles
- Linked from contextual object reference cards ("3 wiki articles reference this concept set")

**Database schema**:

```sql
CREATE TABLE commons_wiki_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    body TEXT NOT NULL,
    body_html TEXT,
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    last_edited_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE commons_wiki_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES commons_wiki_articles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    edited_by UUID NOT NULL REFERENCES users(id),
    edit_summary VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_search ON commons_wiki_articles USING gin(to_tsvector('english', title || ' ' || body));
CREATE INDEX idx_wiki_tags ON commons_wiki_articles USING gin(tags);

-- Wiki articles can also reference platform objects using the same pattern
CREATE TABLE commons_wiki_object_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES commons_wiki_articles(id) ON DELETE CASCADE,
    referenceable_type VARCHAR(50) NOT NULL,
    referenceable_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 11. Cross-Site Federation

**Requirements**:
- In federated Parthenon deployments, the Commons shows presence and allows messaging across participating sites
- Identity is federated: users see display names and site affiliations, not raw credentials
- Cross-site messages are relayed through a secure API-to-API channel (not direct WebSocket)
- Site admins control which channels are federated (opt-in per channel)
- Cross-site activity feed items show the originating site

**Implementation approach**:
- Each site exposes a `/api/federation/commons` endpoint secured with mutual TLS or signed tokens
- Messages and presence updates for federated channels are POSTed to peer sites asynchronously via Laravel queued jobs
- A `site_id` column is added to `commons_messages` and `commons_activities` to track origin
- The existing Parthenon federation infrastructure (from the Studies module) is extended to support Commons

```sql
ALTER TABLE commons_channels ADD COLUMN is_federated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE commons_messages ADD COLUMN site_id UUID;  -- NULL = local
ALTER TABLE commons_activities ADD COLUMN site_id UUID;

CREATE TABLE commons_federation_peers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name VARCHAR(100) NOT NULL,
    site_url VARCHAR(500) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## React Component Architecture

```
src/modules/commons/
├── CommonsModule.tsx              # Module entry point, route registration
├── CommonsLayout.tsx              # Three-panel layout shell
├── context/
│   ├── CommonsProvider.tsx        # Global state: channels, active channel, unread counts
│   ├── PresenceProvider.tsx       # WebSocket presence management
│   └── NotificationProvider.tsx   # Notification state and WebSocket subscription
├── components/
│   ├── sidebar/
│   │   ├── ChannelList.tsx        # Channel navigation with unread badges
│   │   ├── DirectMessageList.tsx  # DM conversations
│   │   ├── PresencePanel.tsx      # Online users with activity indicators
│   │   └── ChannelCreateModal.tsx
│   ├── chat/
│   │   ├── MessageList.tsx        # Virtualized message list (react-window)
│   │   ├── MessageItem.tsx        # Single message with avatar, body, refs, thread link
│   │   ├── MessageComposer.tsx    # Input with Markdown, file upload, @mention, /ref
│   │   ├── ThreadPanel.tsx        # Slide-over panel for threaded replies
│   │   ├── ObjectReferenceCard.tsx # Inline object reference preview
│   │   └── ObjectReferencePicker.tsx # Autocomplete search for attaching refs
│   ├── rightpanel/
│   │   ├── ActivityFeed.tsx       # Real-time activity stream
│   │   ├── PinnedMessages.tsx     # Pinned messages list
│   │   ├── ReviewList.tsx         # Active reviews with status badges
│   │   ├── FileList.tsx           # Shared files browser
│   │   └── RightPanelTabs.tsx     # Tab switcher: Activity | Pinned | Reviews | Files
│   ├── reviews/
│   │   ├── ReviewRequestForm.tsx  # Create/edit review request
│   │   ├── ReviewCard.tsx         # Review status card with decision actions
│   │   └── ReviewDecisionForm.tsx # Approve/request changes/reject form
│   ├── announcements/
│   │   ├── AnnouncementBoard.tsx  # Bulletin view
│   │   ├── AnnouncementCard.tsx   # Single announcement with bookmark
│   │   └── AnnouncementEditor.tsx # Create/edit announcement
│   ├── wiki/
│   │   ├── WikiIndex.tsx          # Article list with search and tag filter
│   │   ├── WikiArticle.tsx        # Article viewer with version history
│   │   └── WikiEditor.tsx         # Markdown editor with object reference linking
│   └── shared/
│       ├── UserAvatar.tsx         # Avatar with presence dot
│       ├── MentionAutocomplete.tsx # @mention typeahead
│       ├── MarkdownRenderer.tsx   # Secure Markdown rendering
│       └── NotificationBell.tsx   # Global notification indicator
├── hooks/
│   ├── useChannel.ts             # Channel data fetching and WebSocket subscription
│   ├── useMessages.ts            # Paginated message loading with cursor-based pagination
│   ├── usePresence.ts            # Presence channel subscription
│   ├── useTypingIndicator.ts     # Typing state management
│   ├── useUnreadCounts.ts        # Unread count tracking across channels
│   └── useNotifications.ts       # Notification subscription and state
└── types/
    └── commons.ts                # TypeScript interfaces for all Commons entities
```

---

## Laravel Backend Structure

```
app/
├── Models/Commons/
│   ├── Channel.php
│   ├── ChannelMember.php
│   ├── Message.php
│   ├── ObjectReference.php
│   ├── Review.php
│   ├── ReviewAssignment.php
│   ├── Activity.php
│   ├── Attachment.php
│   ├── Notification.php
│   ├── Announcement.php
│   ├── WikiArticle.php
│   └── WikiRevision.php
├── Http/Controllers/Commons/
│   ├── ChannelController.php
│   ├── MessageController.php
│   ├── MemberController.php
│   ├── ReviewController.php
│   ├── NotificationController.php
│   ├── AnnouncementController.php
│   ├── WikiController.php
│   ├── ObjectSearchController.php
│   └── AttachmentController.php
├── Events/Commons/
│   ├── MessageSent.php
│   ├── MessageUpdated.php
│   ├── UserPresenceUpdated.php
│   ├── UserTyping.php
│   ├── ReviewStatusChanged.php
│   └── ActivityCreated.php
├── Listeners/
│   └── CommonsActivityListener.php  # Subscribes to domain events, creates activities
├── Policies/Commons/
│   ├── ChannelPolicy.php
│   ├── MessagePolicy.php
│   └── ReviewPolicy.php
├── Services/Commons/
│   ├── MessageService.php           # Message creation, Markdown parsing, mention extraction
│   ├── NotificationService.php      # Notification creation and delivery
│   ├── FederationService.php        # Cross-site message relay
│   └── SearchService.php            # Full-text search across messages and wiki
└── database/migrations/
    ├── xxxx_create_commons_channels_table.php
    ├── xxxx_create_commons_channel_members_table.php
    ├── xxxx_create_commons_messages_table.php
    ├── xxxx_create_commons_object_references_table.php
    ├── xxxx_create_commons_reviews_table.php
    ├── xxxx_create_commons_review_assignments_table.php
    ├── xxxx_create_commons_activities_table.php
    ├── xxxx_create_commons_attachments_table.php
    ├── xxxx_create_commons_notifications_table.php
    ├── xxxx_create_commons_announcements_table.php
    ├── xxxx_create_commons_wiki_articles_table.php
    └── xxxx_create_commons_wiki_revisions_table.php
```

---

## Implementation Order (Suggested Phases)

### Phase 1: Foundation (Core Messaging)
1. Database migrations for channels, members, messages
2. Laravel Reverb setup and WebSocket configuration in Docker Compose
3. Channel CRUD API + MessageController with real-time broadcasting
4. React three-panel layout with ChannelList, MessageList, MessageComposer
5. Basic presence system (online/offline indicators)

### Phase 2: Rich Communication
6. Direct messaging (DM channels)
7. Threaded replies
8. @mention autocomplete
9. File upload and attachments
10. Typing indicators
11. Message editing and deletion

### Phase 3: Contextual Intelligence
12. Object reference system (ObjectReferenceCard, ObjectReferencePicker)
13. Activity feed with integration to existing Parthenon domain events
14. Notification system with per-channel preferences
15. Pinned messages

### Phase 4: Governance and Knowledge
16. Request for Review workflow
17. Announcement board
18. Wiki / knowledge base with versioning
19. Full-text search across messages, announcements, and wiki

### Phase 5: Federation
20. Cross-site presence
21. Federated channel messaging
22. Cross-site review workflows

---

## Key Design Decisions

1. **Messages stored in PostgreSQL, not Redis**: Messages are persistent research records and may be needed for audit trails. Redis is only for ephemeral data (presence, typing indicators, unread count caching).

2. **Polymorphic object references**: Using `referenceable_type` + `referenceable_id` pattern allows referencing any Parthenon entity without coupling the Commons schema to specific modules.

3. **Channel-per-study auto-creation**: When a new Study is created in the Studies module, a corresponding Commons channel is automatically created via a Laravel event listener. This ensures every study has a discussion space without manual setup.

4. **Cursor-based pagination for messages**: Use `created_at` + `id` as cursor (not offset) for message loading. This prevents issues with new messages shifting page boundaries during real-time updates.

5. **Markdown with sanitization**: Messages support GitHub-flavored Markdown rendered via a secure parser. Raw HTML is stripped. Object references are rendered from structured data, not parsed from Markdown links.

6. **WebSocket auth via Laravel Sanctum**: Channel authorization uses the existing Sanctum session/token auth. Private channels verify membership; presence channels verify platform authentication.

---

## Docker Compose Addition

```yaml
services:
  # ... existing services ...

  reverb:
    build:
      context: .
      dockerfile: Dockerfile
    command: php artisan reverb:start --host=0.0.0.0 --port=8080
    ports:
      - "8080:8080"
    environment:
      - REVERB_APP_ID=${REVERB_APP_ID}
      - REVERB_APP_KEY=${REVERB_APP_KEY}
      - REVERB_APP_SECRET=${REVERB_APP_SECRET}
      - DB_CONNECTION=pgsql
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    networks:
      - parthenon
```

---

## Environment Variables

```env
# Laravel Reverb (WebSocket)
REVERB_APP_ID=parthenon-commons
REVERB_APP_KEY=your-reverb-key
REVERB_APP_SECRET=your-reverb-secret
REVERB_HOST=reverb
REVERB_PORT=8080
REVERB_SCHEME=http

# Frontend WebSocket connection
VITE_REVERB_APP_KEY=${REVERB_APP_KEY}
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

---

## Notes for Claude Code

- This module follows existing Parthenon conventions for Laravel controllers, React components, and TypeScript types
- All database tables use UUID primary keys (consistent with existing schema)
- Use Laravel's built-in broadcasting system with Reverb — do not install Pusher or Socket.io
- React components should use the existing Parthenon design system (Tailwind CSS classes, shared component library)
- The MessageList should use virtualization (react-window or @tanstack/virtual) for performance with large message histories
- Full-text search uses PostgreSQL's built-in `tsvector/tsquery` — no external search engine needed
- The Object Reference system is the highest-priority differentiating feature after basic messaging works

---
---

# Phase 6: Abby — AI Research Companion with Persistent Memory

## Overview

Abby is Parthenon's existing AI assistant (Python FastAPI + Ollama with MedGemma), currently serving as the platform's AI service layer for concept mapping, ETL assistance, and clinical intelligence. Phase 6 extends Abby into the Commons workspace as a first-class participant — an always-learning research companion who absorbs institutional knowledge through ChromaDB vector storage and surfaces it contextually when researchers need it.

**What makes this different from a chatbot**: Abby isn't stateless. She continuously ingests, embeds, and indexes everything flowing through the Commons — messages, decisions, object references, review outcomes, wiki articles, analysis results. Over weeks and months, she builds a deep semantic memory of the research network's collective knowledge. When a researcher asks "Have we tried this approach before?" or "What happened last time someone used this inclusion criterion?", Abby can recall across the full institutional history — something no individual researcher can do.

**Underlying LLM**: Ollama (local, privacy-preserving) — currently running `MedAIBase/MedGemma1.5:4b` via the existing `ai/` service in Parthenon. All data stays on-premises.

---

## 12. Abby Commons Integration

### 12.1 Participation Model

Abby participates in the Commons through two complementary modes:

**A. @Abby Mention in Any Channel**
- Any researcher can summon Abby by typing `@Abby` followed by a question or request in any channel or DM
- Abby responds in-thread (not in the main channel stream) to avoid noise
- She has read access to the full channel history and all referenced platform objects
- She can create object references in her responses (linking to cohorts, concept sets, studies)

**B. Dedicated #ask-abby Channel**
- A permanent, auto-created channel where any researcher can ask Abby directly
- Functions as the "help desk" for the entire platform
- Questions and answers are indexed in ChromaDB, building a living FAQ
- Other researchers can browse past Q&A threads for self-service knowledge

**What Abby does NOT do**:
- She never posts unsolicited messages (no proactive interruptions)
- She never modifies platform objects (cohorts, concept sets, studies) — she advises, researchers act
- She never participates in DMs unless explicitly @mentioned
- She clearly labels all responses as AI-generated

### 12.2 ChromaDB Knowledge Brain

ChromaDB serves as Abby's persistent vector memory — a semantic index of everything she has learned from the research network.

#### What gets embedded and stored

| Source | Trigger | What's Stored | Collection |
|--------|---------|---------------|------------|
| Commons messages | Every message sent | Message text + metadata (author, channel, timestamp, object refs) | `commons_messages` |
| Review decisions | Review status change | Decision rationale, reviewer comments, referenced object | `review_decisions` |
| Wiki articles | Article created/edited | Full article text + tags + linked objects | `wiki_articles` |
| Cohort definitions | Cohort saved/updated | JSON definition + name + description + inclusion/exclusion criteria text | `cohort_definitions` |
| Concept sets | Concept set saved | Concept list + name + description + vocabulary context | `concept_sets` |
| Study designs | Study created/updated | Protocol text + study metadata + sites + status | `study_designs` |
| Analysis results | Analysis completed | Result summary + parameters + interpretation notes from activity feed | `analysis_results` |
| Announcements | Announcement posted | Full announcement text + category + expiration | `announcements` |
| Object reference context | Object referenced in message | The contextual discussion around the object (surrounding messages) | `object_discussions` |

#### ChromaDB Architecture

```
ChromaDB Instance (Docker container)
├── Collection: commons_messages
│   ├── Embedding model: nomic-embed-text (via Ollama)
│   ├── Metadata: channel_id, user_id, timestamp, thread_id, object_refs[]
│   └── Document: message body text
├── Collection: review_decisions
│   ├── Metadata: review_id, status, reviewer_ids[], object_type, object_id
│   └── Document: concatenated review comments + decision rationale
├── Collection: wiki_articles
│   ├── Metadata: article_id, tags[], author_id, last_edited
│   └── Document: article title + body (chunked at ~500 tokens)
├── Collection: cohort_definitions
│   ├── Metadata: cohort_id, author_id, version, patient_count
│   └── Document: name + description + human-readable criteria summary
├── Collection: concept_sets
│   ├── Metadata: concept_set_id, vocabulary_ids[], concept_count
│   └── Document: name + description + concept names list
├── Collection: study_designs
│   ├── Metadata: study_id, status, site_ids[], pi_id
│   └── Document: protocol summary + study title + objectives
├── Collection: analysis_results
│   ├── Metadata: analysis_id, study_id, type, completed_at
│   └── Document: result summary + parameter description
├── Collection: announcements
│   ├── Metadata: announcement_id, category, channel_id, expires_at
│   └── Document: title + body text
└── Collection: object_discussions
    ├── Metadata: object_type, object_id, channel_id, message_count
    └── Document: concatenated discussion thread around the object
```

#### Embedding Strategy

- **Embedding model**: `nomic-embed-text` via Ollama (768-dim vectors, runs locally alongside MedGemma)
- **Chunking**: Long documents (wiki articles, study protocols) are chunked at ~500 tokens with 50-token overlap using recursive character splitting
- **Deduplication**: Messages edited within 5 minutes of original are re-embedded (replace, not append); deleted messages are soft-removed from ChromaDB (metadata flag, not purged)
- **Metadata enrichment**: Every embedding includes structured metadata for filtered retrieval (e.g., "find all discussions about this specific cohort" uses `object_refs` filter)

### 12.3 Retrieval-Augmented Generation (RAG) Pipeline

When Abby receives a query (via @mention or #ask-abby), she follows this pipeline:

```
User query
    │
    ▼
┌─────────────────────────────────┐
│  1. Query Analysis               │
│  - Extract intent                │
│  - Identify referenced objects   │
│  - Determine relevant collections│
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  2. Multi-Collection Retrieval   │
│  - Semantic search across        │
│    relevant ChromaDB collections │
│  - Metadata filtering (channel,  │
│    date range, object refs)      │
│  - Top-k retrieval (k=10-20)    │
│  - Reranking by relevance score  │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  3. Context Assembly             │
│  - Deduplicate retrieved chunks  │
│  - Order by relevance + recency  │
│  - Inject current channel context│
│  - Build prompt with system      │
│    instructions + retrieved      │
│    context + user query          │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  4. LLM Generation (MedGemma)    │
│  - Generate response via Ollama  │
│  - Include source attribution    │
│  - Format object references      │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  5. Response Post-Processing     │
│  - Extract object references     │
│  - Create commons_message record │
│  - Embed Abby's own response    │
│    back into ChromaDB            │
│  - Broadcast via WebSocket       │
└─────────────────────────────────┘
```

#### System Prompt Template

```python
ABBY_SYSTEM_PROMPT = """You are Abby, the AI research companion for Parthenon, 
an outcomes research platform built on OMOP CDM v5.4. You assist clinical 
researchers, biostatisticians, and data scientists working on observational 
health studies.

Your capabilities:
- You have deep knowledge of OMOP CDM, OHDSI vocabularies (SNOMED CT, LOINC, 
  RxNorm, ICD-10), cohort definition patterns, and study design best practices
- You have access to this research network's institutional memory — past 
  discussions, decisions, cohort designs, study outcomes, and lessons learned
- You can reference specific platform objects (cohorts, concept sets, studies, 
  analyses) in your responses

Your principles:
- Always cite your sources — if recalling a past discussion, name the channel, 
  approximate date, and participants when available
- Distinguish between what you KNOW from institutional memory vs. what you 
  INFER from general medical/informatics knowledge
- Never fabricate institutional memory — if you don't have relevant history, 
  say so
- Be concise and actionable — researchers are busy
- When referencing platform objects, format them as [Object Type: Object Name] 
  so the frontend can render them as clickable reference cards

Retrieved context from institutional memory:
{retrieved_context}

Current channel: {channel_name}
Current user: {user_name}
"""
```

### 12.4 Ingestion Pipeline (Background Workers)

Abby's knowledge grows continuously through background ingestion workers that listen to platform events and embed new knowledge into ChromaDB.

#### Laravel Event Listeners → FastAPI Ingestion

```php
// App\Listeners\AbbyIngestionListener
// Subscribes to all relevant domain events and forwards to the AI service

class AbbyIngestionListener
{
    protected AbbyIngestionService $ingestionService;

    public function handleMessageSent(MessageSent $event): void
    {
        // Queue the message for embedding (don't block the WebSocket broadcast)
        dispatch(new IngestToAbbyJob(
            type: 'commons_message',
            payload: [
                'id' => $event->message->id,
                'body' => $event->message->body,
                'channel_id' => $event->message->channel_id,
                'channel_name' => $event->message->channel->name,
                'user_id' => $event->message->user_id,
                'user_name' => $event->message->user->name,
                'parent_id' => $event->message->parent_id,
                'object_references' => $event->message->objectReferences->toArray(),
                'created_at' => $event->message->created_at->toISOString(),
            ]
        ));
    }

    public function handleCohortDefinitionUpdated(CohortDefinitionUpdated $event): void
    {
        dispatch(new IngestToAbbyJob(
            type: 'cohort_definition',
            payload: [
                'id' => $event->cohort->id,
                'name' => $event->cohort->name,
                'description' => $event->cohort->description,
                'criteria_summary' => $event->cohort->getHumanReadableCriteria(),
                'patient_count' => $event->cohort->patient_count,
                'author_id' => $event->cohort->created_by,
                'version' => $event->cohort->version,
            ]
        ));
    }

    // Similar handlers for:
    // - handleReviewStatusChanged
    // - handleWikiArticleUpdated
    // - handleConceptSetUpdated
    // - handleStudyStatusChanged
    // - handleAnalysisCompleted
    // - handleAnnouncementPosted
}
```

#### FastAPI Ingestion Endpoints

```python
# ai/app/routers/abby_ingest.py

from fastapi import APIRouter, BackgroundTasks
from chromadb import Client as ChromaClient
from app.services.embeddings import OllamaEmbedder
from app.services.chunker import RecursiveChunker

router = APIRouter(prefix="/abby/ingest", tags=["abby-ingestion"])

embedder = OllamaEmbedder(model="nomic-embed-text")
chunker = RecursiveChunker(chunk_size=500, chunk_overlap=50)
chroma = ChromaClient()

@router.post("/commons_message")
async def ingest_message(payload: MessagePayload, bg: BackgroundTasks):
    """Embed a Commons message into ChromaDB."""
    bg.add_task(_embed_message, payload)
    return {"status": "queued"}

async def _embed_message(payload: MessagePayload):
    collection = chroma.get_or_create_collection(
        name="commons_messages",
        metadata={"hnsw:space": "cosine"}
    )
    
    embedding = await embedder.embed(payload.body)
    
    metadata = {
        "channel_id": str(payload.channel_id),
        "channel_name": payload.channel_name,
        "user_id": str(payload.user_id),
        "user_name": payload.user_name,
        "parent_id": str(payload.parent_id) if payload.parent_id else None,
        "object_refs": json.dumps(payload.object_references),
        "created_at": payload.created_at,
    }
    
    collection.upsert(
        ids=[str(payload.id)],
        embeddings=[embedding],
        documents=[payload.body],
        metadatas=[metadata],
    )

@router.post("/cohort_definition")
async def ingest_cohort(payload: CohortPayload, bg: BackgroundTasks):
    """Embed a cohort definition into ChromaDB."""
    bg.add_task(_embed_cohort, payload)
    return {"status": "queued"}

async def _embed_cohort(payload: CohortPayload):
    collection = chroma.get_or_create_collection(
        name="cohort_definitions",
        metadata={"hnsw:space": "cosine"}
    )
    
    # Combine fields into a rich document for embedding
    document = (
        f"Cohort: {payload.name}\n"
        f"Description: {payload.description}\n"
        f"Criteria: {payload.criteria_summary}\n"
        f"Patient count: {payload.patient_count}"
    )
    
    # Chunk if the criteria summary is very long
    chunks = chunker.split(document)
    
    for i, chunk in enumerate(chunks):
        chunk_id = f"{payload.id}__chunk_{i}"
        embedding = await embedder.embed(chunk)
        
        collection.upsert(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{
                "cohort_id": str(payload.id),
                "name": payload.name,
                "author_id": str(payload.author_id),
                "version": payload.version,
                "patient_count": payload.patient_count,
                "chunk_index": i,
            }],
        )

# Similar ingestion endpoints for:
# - /review_decision
# - /wiki_article
# - /concept_set
# - /study_design
# - /analysis_result
# - /announcement
```

### 12.5 Query Processing (RAG Endpoint)

```python
# ai/app/routers/abby_query.py

from fastapi import APIRouter
from app.services.ollama_client import OllamaChat
from app.services.retriever import MultiCollectionRetriever
from app.prompts.abby import ABBY_SYSTEM_PROMPT

router = APIRouter(prefix="/abby", tags=["abby-query"])

retriever = MultiCollectionRetriever(
    collections=[
        "commons_messages",
        "review_decisions", 
        "wiki_articles",
        "cohort_definitions",
        "concept_sets",
        "study_designs",
        "analysis_results",
        "announcements",
        "object_discussions",
    ],
    embedder=OllamaEmbedder(model="nomic-embed-text"),
    top_k=15,
)

llm = OllamaChat(model="MedAIBase/MedGemma1.5:4b")

@router.post("/query")
async def query_abby(request: AbbyQueryRequest) -> AbbyQueryResponse:
    """
    Main RAG endpoint: retrieve relevant context from ChromaDB,
    assemble prompt, generate response via MedGemma.
    """
    
    # 1. Determine which collections to search based on query analysis
    relevant_collections = analyze_query_intent(request.query)
    
    # 2. Build metadata filters (scope to channel, date range, specific objects)
    filters = {}
    if request.channel_id:
        filters["channel_id"] = str(request.channel_id)
    if request.object_type and request.object_id:
        filters["object_refs"] = {"$contains": str(request.object_id)}
    
    # 3. Multi-collection semantic retrieval
    retrieved_chunks = await retriever.retrieve(
        query=request.query,
        collections=relevant_collections,
        filters=filters,
        top_k=15,
    )
    
    # 4. Rerank by relevance and recency
    ranked_chunks = rerank_chunks(retrieved_chunks, request.query)
    
    # 5. Format retrieved context for the prompt
    context_text = format_retrieved_context(ranked_chunks[:10])
    
    # 6. Assemble the full prompt
    system_prompt = ABBY_SYSTEM_PROMPT.format(
        retrieved_context=context_text,
        channel_name=request.channel_name or "ask-abby",
        user_name=request.user_name,
    )
    
    # 7. Generate response via Ollama/MedGemma
    response = await llm.chat(
        system=system_prompt,
        messages=[{"role": "user", "content": request.query}],
    )
    
    # 8. Extract any object references from the response
    object_refs = extract_object_references(response.content)
    
    # 9. Build source attributions
    sources = [
        {
            "collection": chunk.collection,
            "document_id": chunk.id,
            "snippet": chunk.document[:100],
            "metadata": chunk.metadata,
            "relevance_score": chunk.score,
        }
        for chunk in ranked_chunks[:5]
    ]
    
    return AbbyQueryResponse(
        content=response.content,
        sources=sources,
        object_references=object_refs,
    )


def analyze_query_intent(query: str) -> list[str]:
    """Determine which ChromaDB collections are relevant to the query."""
    
    # Keyword-based fast path (supplement with LLM classification if needed)
    all_collections = [
        "commons_messages", "review_decisions", "wiki_articles",
        "cohort_definitions", "concept_sets", "study_designs",
        "analysis_results", "announcements", "object_discussions",
    ]
    
    cohort_keywords = ["cohort", "inclusion", "exclusion", "criteria", "patient", "population"]
    study_keywords = ["study", "protocol", "site", "multi-site", "federated", "IRB"]
    analysis_keywords = ["result", "analysis", "survival", "incidence", "outcome", "kaplan"]
    concept_keywords = ["concept", "vocabulary", "SNOMED", "LOINC", "RxNorm", "ICD", "code"]
    review_keywords = ["review", "approve", "reject", "decision", "feedback"]
    
    relevant = set()
    query_lower = query.lower()
    
    if any(kw in query_lower for kw in cohort_keywords):
        relevant.update(["cohort_definitions", "object_discussions"])
    if any(kw in query_lower for kw in study_keywords):
        relevant.update(["study_designs", "object_discussions"])
    if any(kw in query_lower for kw in analysis_keywords):
        relevant.update(["analysis_results", "object_discussions"])
    if any(kw in query_lower for kw in concept_keywords):
        relevant.update(["concept_sets"])
    if any(kw in query_lower for kw in review_keywords):
        relevant.update(["review_decisions"])
    
    # Always include messages and wiki (broad knowledge)
    relevant.update(["commons_messages", "wiki_articles"])
    
    return list(relevant) if relevant else all_collections
```

### 12.6 Laravel Integration (Controller + Service)

```php
// App\Http\Controllers\Commons\AbbyController.php

class AbbyController extends Controller
{
    public function __construct(
        private AbbyService $abbyService,
        private MessageService $messageService,
    ) {}

    /**
     * Handle an @Abby query from any channel.
     * Called when a message containing @Abby is detected.
     */
    public function query(AbbyQueryRequest $request): JsonResponse
    {
        $user = $request->user();
        $channel = Channel::findOrFail($request->channel_id);
        
        // Verify user has access to this channel
        $this->authorize('view', $channel);
        
        // Call the FastAPI AI service
        $response = $this->abbyService->query(
            query: $request->query,
            channelId: $channel->id,
            channelName: $channel->name,
            userName: $user->name,
            objectType: $request->object_type,
            objectId: $request->object_id,
        );
        
        // Create Abby's response as a Commons message
        $abbyUser = User::where('email', 'abby@parthenon.local')->first();
        
        $message = $this->messageService->create(
            channelId: $channel->id,
            userId: $abbyUser->id,
            body: $response->content,
            parentId: $request->parent_message_id, // Reply in thread
            objectReferences: $response->object_references,
            metadata: [
                'is_ai_generated' => true,
                'model' => 'MedGemma1.5:4b',
                'sources' => $response->sources,
                'confidence' => $response->confidence_score,
            ],
        );
        
        return response()->json([
            'message' => $message->load('user', 'objectReferences'),
            'sources' => $response->sources,
        ]);
    }
}
```

```php
// App\Services\Commons\AbbyService.php

class AbbyService
{
    private string $aiBaseUrl;
    
    public function __construct()
    {
        $this->aiBaseUrl = config('services.ai.base_url', 'http://ai:8000');
    }
    
    public function query(
        string $query,
        string $channelId,
        string $channelName,
        string $userName,
        ?string $objectType = null,
        ?string $objectId = null,
    ): AbbyQueryResponse {
        $response = Http::timeout(60)->post("{$this->aiBaseUrl}/abby/query", [
            'query' => $query,
            'channel_id' => $channelId,
            'channel_name' => $channelName,
            'user_name' => $userName,
            'object_type' => $objectType,
            'object_id' => $objectId,
        ]);
        
        if ($response->failed()) {
            throw new AbbyServiceException(
                "AI service returned {$response->status()}: {$response->body()}"
            );
        }
        
        return AbbyQueryResponse::from($response->json());
    }
    
    /**
     * Send content to be ingested into Abby's ChromaDB memory.
     * Fire-and-forget via queued job.
     */
    public function ingest(string $type, array $payload): void
    {
        Http::timeout(10)->post("{$this->aiBaseUrl}/abby/ingest/{$type}", $payload);
    }
}
```

### 12.7 React Components

```
src/modules/commons/components/abby/
├── AbbyMentionHandler.tsx     # Detects @Abby in message composer, triggers query
├── AbbyResponseCard.tsx       # Renders Abby's response with AI badge + sources
├── AbbySourceAttribution.tsx  # Expandable panel showing retrieved context sources
├── AbbyTypingIndicator.tsx    # "Abby is thinking..." animation during RAG pipeline
├── AskAbbyChannel.tsx         # Dedicated #ask-abby channel with optimized UX
└── AbbyAvatar.tsx             # Consistent Abby avatar with AI indicator
```

**AbbyResponseCard** renders differently from human messages:
- Subtle AI badge ("Abby · AI Assistant") with a distinct avatar
- "Sources" expandable section showing what institutional memory informed the response
- Object reference cards rendered inline (same as human messages)
- "Was this helpful?" thumbs up/down for response quality tracking
- "Sources" links back to original messages/articles/decisions

### 12.8 Abby's Special Capabilities

Beyond simple Q&A, Abby can perform these research-specific tasks when asked:

**A. Cohort Design Review**
- "Hey @Abby, review this T2DM cohort definition for common pitfalls"
- Retrieves similar cohort designs from ChromaDB, compares criteria patterns
- Flags potential issues based on past discussions about similar cohorts

**B. Cross-Study Knowledge Synthesis**
- "What do we know about GLP-1 RA outcomes across all our studies?"
- Searches across study_designs, analysis_results, and object_discussions
- Synthesizes findings from multiple studies into a coherent summary

**C. Onboarding Assistance**
- New researchers in #ask-abby: "How do I create a cohort in Parthenon?"
- Retrieves wiki articles, past onboarding discussions, and relevant docs
- Provides step-by-step guidance with links to platform features

**D. Decision Archaeology**
- "Why did we exclude patients with prior bariatric surgery from the CKD cohort?"
- Searches review_decisions and commons_messages for the historical rationale
- Returns the specific discussion thread and review decision with attribution

**E. Concept Set Assistance**
- "@Abby, what SNOMED codes should I include for heart failure with reduced EF?"
- Combines OMOP vocabulary knowledge with institutional memory of past concept sets
- References how other researchers in the network have approached similar definitions

### 12.9 Database Schema Additions

```sql
-- Abby system user (created via seeder, not a real human account)
-- Uses existing users table with a special flag
ALTER TABLE users ADD COLUMN is_ai_agent BOOLEAN NOT NULL DEFAULT FALSE;

-- Track Abby response quality for continuous improvement
CREATE TABLE commons_abby_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES commons_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    rating VARCHAR(10) NOT NULL,  -- 'helpful' | 'not_helpful'
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_abby_feedback_message ON commons_abby_feedback(message_id);

-- Track ChromaDB ingestion status for debugging/monitoring
CREATE TABLE commons_abby_ingestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,  -- 'commons_message' | 'cohort_definition' | etc.
    source_id UUID NOT NULL,
    collection_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'embedded' | 'failed'
    error_message TEXT,
    embedding_duration_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingestion_log_status ON commons_abby_ingestion_log(status)
    WHERE status = 'failed';
CREATE INDEX idx_ingestion_log_source ON commons_abby_ingestion_log(source_type, source_id);
```

### 12.10 Docker Compose Addition

```yaml
services:
  # ... existing services ...

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    volumes:
      - chromadb_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=FALSE
      - ALLOW_RESET=FALSE
    networks:
      - parthenon
    restart: unless-stopped

volumes:
  # ... existing volumes ...
  chromadb_data:
    driver: local
```

The existing `ai` service in docker-compose.yml needs these environment additions:

```yaml
  ai:
    # ... existing config ...
    environment:
      # ... existing env vars ...
      - CHROMA_HOST=chromadb
      - CHROMA_PORT=8000
      - EMBEDDING_MODEL=nomic-embed-text
      - LLM_MODEL=MedAIBase/MedGemma1.5:4b
      - ABBY_MAX_CONTEXT_CHUNKS=10
      - ABBY_RETRIEVAL_TOP_K=15
    depends_on:
      - ollama
      - chromadb
```

### 12.11 Python Dependencies (ai/requirements.txt additions)

```
chromadb>=0.5.0
langchain-text-splitters>=0.2.0    # For RecursiveCharacterTextSplitter
httpx>=0.27.0                       # Async HTTP for Ollama calls
pydantic>=2.0                       # Request/response models
```

### 12.12 Environment Variables

```env
# Abby AI Configuration
CHROMA_HOST=chromadb
CHROMA_PORT=8000
EMBEDDING_MODEL=nomic-embed-text
ABBY_LLM_MODEL=MedAIBase/MedGemma1.5:4b
ABBY_MAX_CONTEXT_CHUNKS=10
ABBY_RETRIEVAL_TOP_K=15
ABBY_RESPONSE_MAX_TOKENS=2048

# Abby system user (seeded on first deploy)
ABBY_USER_EMAIL=abby@parthenon.local
ABBY_USER_NAME=Abby
```

### 12.13 Implementation Sub-Phases

**Phase 6a: ChromaDB Infrastructure + Ingestion Pipeline**
1. Add ChromaDB container to Docker Compose
2. Install `nomic-embed-text` model in Ollama
3. Build FastAPI ingestion endpoints for all content types
4. Build Laravel event listeners + queued ingestion jobs
5. Backfill existing platform data (cohort definitions, concept sets, studies) into ChromaDB
6. Build ingestion monitoring dashboard (admin panel)

**Phase 6b: RAG Query Pipeline**
7. Build multi-collection retriever with metadata filtering
8. Build query intent analyzer
9. Build prompt assembly with system instructions + retrieved context
10. Build response post-processing (object reference extraction, source attribution)
11. Build AbbyController + AbbyService in Laravel
12. Wire up @Abby mention detection in message composer

**Phase 6c: Commons UI Integration**
13. Build AbbyResponseCard with AI badge and source attribution
14. Build AskAbbyChannel dedicated interface
15. Build AbbyTypingIndicator (streaming-aware)
16. Build feedback mechanism (helpful/not helpful)
17. Create Abby system user seeder

**Phase 6d: Advanced Capabilities**
18. Cohort design review workflow
19. Cross-study knowledge synthesis
20. Decision archaeology (historical rationale retrieval)
21. Response quality analytics dashboard (admin)
22. ChromaDB collection maintenance (periodic re-embedding, garbage collection)

---

## Updated Implementation Order (All Phases)

### Phase 1: Foundation (Core Messaging)
### Phase 2: Rich Communication
### Phase 3: Contextual Intelligence
### Phase 4: Governance and Knowledge
### Phase 5: Federation
### Phase 6: Abby AI Research Companion (ChromaDB Brain)

---

## Key Design Decisions (Updated)

*Original decisions 1-6 remain unchanged. Adding:*

7. **ChromaDB over pgvector**: While PostgreSQL 17 supports pgvector for embeddings, ChromaDB is chosen because (a) it provides purpose-built collection management with metadata filtering, (b) it runs as a separate container so embedding operations don't compete with OMOP query workloads on PostgreSQL, (c) it's trivially replaceable with other vector stores later if needed, and (d) it keeps the AI service self-contained within the `ai/` directory + its own dependencies.

8. **nomic-embed-text for embeddings**: Runs locally via Ollama (same as MedGemma), producing 768-dimension vectors with strong performance on retrieval benchmarks. No external API calls, all data stays on-premises. Can be swapped for `mxbai-embed-large` or other Ollama-compatible embedding models.

9. **Abby responds in-thread only**: When mentioned in a channel, Abby replies as a thread response, not a top-level message. This prevents AI responses from dominating the channel stream and keeps the signal-to-noise ratio high for human discussion.

10. **Fire-and-forget ingestion**: Embedding new content into ChromaDB is handled asynchronously via Laravel queued jobs → FastAPI background tasks. The Commons messaging pipeline is never blocked by embedding operations. Failed embeddings are logged and retried.
