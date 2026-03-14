# Commons Phase 3: Notifications, Activity Feed & Phenotype Library

**Date:** 2026-03-14
**Status:** Complete

## What Was Built

Phase 3 completes the Commons collaboration suite with real-time notification infrastructure, a per-channel activity feed, and populates the Phenotype Library with all 1,100 OHDSI phenotype definitions.

### Features Delivered

1. **In-App Notification System** — Bell icon in Commons sidebar with unread badge (capped at 9+). Dropdown shows 20 most recent notifications with actor avatars, type-specific icons, and relative timestamps. Mark individual or all-as-read. Notification types: mention, direct_message, thread_reply, review_assigned, review_resolved.

2. **Notification Service** — Backend `NotificationService` with dedicated methods for each trigger: `notifyMentions()`, `notifyDirectMessage()`, `notifyThreadReply()`, `notifyReviewRequested()`, `notifyReviewResolved()`. Parses @Name patterns from message body. Prevents self-notifications. Wired into `MessageController::store()` and `ReviewRequestController`.

3. **Activity Feed** — Per-channel and global event logging via `ActivityService::log()`. Right panel Activity tab (Zap icon) shows typed events with color-coded icons: member_joined (green), message_pinned (amber), review_requested (blue), channel_created (purple), etc. Backend controller with optional event_type filtering.

4. **Right Panel Redesign** — Expanded from 5 text-label tabs to 6 icon-only tabs (Pin, Search, Zap, ClipboardCheck, Users, Settings) to fit the additional Activity and Reviews tabs. Tooltip labels on hover.

5. **Phenotype Library Population** — Optimized `phenotype:sync` command to bulk-download the OHDSI/PhenotypeLibrary GitHub repo as a zip instead of making 1,100 individual HTTP requests. Batch upserts (100 rows/batch). All 1,100 phenotypes loaded with full CIRCE JSON expressions, domain classifications, tags, and logic descriptions. Sync time: ~15 seconds (was ~30 minutes).

### Architecture

- **Backend:** 3 new controllers (Notification, Activity, enhanced ReviewRequest), 3 new models, 3 new migrations, 2 new services (NotificationService, ActivityService), optimized PhenotypeSync command
- **Frontend:** 3 new components (NotificationBell, ActivityFeed, ReviewList), enhanced RightPanel with icon tabs, enhanced MessageComposer with file upload
- **API Endpoints Added:**
  - `GET /api/v1/commons/notifications` — paginated user notifications
  - `GET /api/v1/commons/notifications/unread-count` — badge count
  - `POST /api/v1/commons/notifications/mark-read` — mark by IDs or all
  - `GET /api/v1/commons/activity` — global activity feed
  - `GET /api/v1/commons/channels/{slug}/activity` — per-channel activity

### Database Tables Added

| Table | Purpose |
|-------|---------|
| `commons_notifications` | User notifications with type, actor, channel/message refs |
| `commons_activities` | Channel event log with typed events and jsonb metadata |
| `commons_review_requests` | Peer review workflow (from Phase 2, wired to notifications) |

### Phenotype Sync Optimization

| Metric | Before | After |
|--------|--------|-------|
| HTTP requests | 1,101 (1 CSV + 1,100 JSONs) | 2 (1 CSV + 1 zip) |
| DB operations | 1,100 individual upserts | 11 batch upserts (100/batch) |
| Duration | ~30 minutes | ~15 seconds |
| Error rate | High (GitHub rate limiting) | 0 errors |

Key changes to `PhenotypeSync`:
- Downloads entire repo as zip, extracts JSONs from `inst/cohorts/`
- Domain normalization from `domainsInEntryEvents` CSV column (e.g., `ConditionOccurrence` → `Condition`)
- Tags parsed from `hashTag` column (comma-separated `#tag` format)
- `--metadata-only` flag to skip JSON downloads
- Temp directory cleanup after extraction

### Commits

- `e88bbc1d` — In-app notification system
- `a8fda8fe` — Activity feed with per-channel and global event logging
- `3022dd49` — .gitignore updates (ai/models, chroma, script caches)
- `d35144ef` — Commons workspace spec and Abby AI component designs
- `124a2c62` — Database backup/restore scripts
- `eff9d57f` — Optimized phenotype sync (bulk zip, batch upserts)

## Gotchas

- **Right panel 6 tabs:** Text labels don't fit — switched to icon-only with title tooltips
- **Notification self-suppression:** Must check `user_id !== sender_id` to avoid notifying the author of their own message
- **Mention parsing:** Regex `/@(\w+\s\w+)/` matches `@First Last` patterns; breaks after first match per user to avoid duplicates
- **Phenotype CSV BOM:** OHDSI CSVs include UTF-8 BOM (`\xEF\xBB\xBF`) — must strip before parsing headers
- **Phenotype tags column:** CSV uses `hashTag` (not `tags`) with `#Symptoms, #respiratory` format — need to strip `#` and split on comma
- **Phenotype domains:** CSV uses `domainsInEntryEvents` with raw OMOP table names (`ConditionOccurrence`, `DrugExposure`) — normalize to friendly labels

## Commons Feature Completion

| Feature | Phase | Status |
|---------|-------|--------|
| Channels & messaging | 1 | Done |
| Threads & replies | 1 | Done |
| Reactions | 1 | Done |
| Pins & search | 2 | Done |
| Members & @mentions | 2 | Done |
| Direct messages | 2 | Done |
| Object references | 2 | Done |
| File attachments | 2 | Done |
| Request-for-review | 2 | Done |
| Notifications | 3 | Done |
| Activity feed | 3 | Done |
| Announcement board | 3 | Done |
| Knowledge base wiki | 3 | Done |
| Federation | — | Skipped |
