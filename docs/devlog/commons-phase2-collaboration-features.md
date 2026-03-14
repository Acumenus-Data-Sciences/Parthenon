# Commons Phase 2: Collaboration Features

**Date:** 2026-03-13
**Status:** Complete

## What Was Built

Phase 2 adds the collaboration layer to Commons, transforming it from a basic chat into a research-grade workspace. All features are live at https://parthenon.acumenus.net.

### Features Delivered

1. **Pinned Messages & Search** — Pin important messages to channels; full-text search across all messages using PostgreSQL `to_tsvector/plainto_tsquery` with GIN index.

2. **Members Panel & @Mentions** — Right-panel member list sorted by role with avatar colors. @mention autocomplete in the composer with keyboard navigation (ArrowUp/Down/Enter/Tab/Escape).

3. **Channel Creation & Settings** — Create channels (topic/custom, public/private) with auto-slug generation. Channel settings tab for admins (name/description editing) and notification preferences (all/mentions/none).

4. **Direct Messaging** — Click any online user to start a DM. Deterministic slugs (`dm_{lower_id}_{higher_id}`) for idempotent channel creation. DMs listed in sidebar below channels.

5. **Contextual Object References** — Link messages to Parthenon objects (cohorts, concept sets, studies, data sources) via polymorphic `object_references` table. ReferencePicker search modal in composer, colored reference cards on messages.

6. **File Attachments** — Upload images, PDFs, CSVs, XLSX, DOCX (up to 10MB) via Paperclip button. Image thumbnails rendered inline; other files shown as download links. Stored on Laravel public disk.

7. **Request for Review (RFR)** — Peer review workflow for research messages. Request review via message action menu, resolve as approved or changes-requested with comments. Dedicated Reviews tab in right panel.

### Architecture

- **Backend:** 4 new controllers (DirectMessage, ObjectReference, Attachment, ReviewRequest), 3 new models, 3 new migrations
- **Frontend:** 5 new components (ObjectReferenceCard, ReferencePicker, AttachmentDisplay, ReviewList, CreateChannelModal), significant enhancements to MessageComposer, MessageItem, ChannelHeader, RightPanel, ChannelList
- **Right Panel:** 5 tabs (Pinned, Search, Reviews, Members, Settings) with externally controlled tab state synced to header buttons

### Database Tables Added

| Table | Purpose |
|-------|---------|
| `commons_object_references` | Polymorphic message → object links |
| `commons_attachments` | File metadata (path, mime, size) per message |
| `commons_review_requests` | Review workflow with status tracking |

### Key Decisions

- **Attachments linked to messages:** Upload happens after message creation (message_id FK). Files stored on `public` disk for direct serving.
- **Review status model:** Simple three-state (pending → approved/changes_requested) rather than complex workflow. Any channel member can resolve.
- **DM slug pattern:** `dm_{min_id}_{max_id}` ensures exactly one channel per user pair regardless of who initiates.

### Commits

- `e218e9fd` — Contextual object references
- `0d268516` — File attachments
- `370bb44a` — Request-for-review workflow
- Earlier commits: pinned messages, search, members, @mentions, channel creation, settings, DMs

## Gotchas

- `FileText` import from lucide-react conflicts with `FileText` used elsewhere — use aliased imports if needed
- `ReferencePicker` uses `onMouseDown` (not `onClick`) to prevent textarea blur when selecting results
- Right panel tab state must be lifted to CommonsLayout to sync header buttons with panel tabs
