# OpenProject Bidirectional Sync — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Bidirectional sync between OpenProject, GitHub (sudoshi/Parthenon), and GSD `.planning/` files

## Overview

A webhook-driven sync system with scheduled reconciliation, running as n8n workflows in the existing Acropolis stack. OpenProject is the source of truth. Syncs milestones, phases, plans, quick tasks, issues, and PRs across three systems: OpenProject, GitHub, and GSD planning files.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source of truth | OpenProject | Non-engineer-facing project management hub |
| Sync engine | n8n (Acropolis) | Already deployed, webhook-native, visual flows |
| Sync pattern | Hybrid: webhooks + 30-min reconciliation | Real-time for common path, self-healing for missed events |
| Auth | Authentik OAuth2 (client_credentials) | SSO-consistent with existing Acropolis stack |
| Project structure | Parent/child (Parthenon parent, sub-project per milestone) | Per-milestone Gantt + portfolio rollup |
| Initial load | Backfill Parthenon only | Aurora added later as separate sub-project |
| State storage | `sync` schema in host PG17 | Durable, queryable, co-located with Parthenon data |
| GitHub sync | Full lifecycle (Milestones + Issues + PRs) | Complete traceability |

## 1. Data Model Mapping

### Entity Mapping

```
GSD                          OpenProject                  GitHub
--------------------------------------------------------------------
Milestone (v5.4)         ->  Sub-project                  Milestone
Phase (01-setup)         ->  Work Package (type: Phase)   Label (phase:01)
Plan (01-01-PLAN.md)     ->  Child Work Package (Task)    Issue
Quick Task               ->  Work Package (type: Task)    Issue (label: quick)
Requirement (MED-01)     ->  Custom field on WP           Issue label (req:MED-01)
must_have.truth          ->  Acceptance criterion (desc)  Checkbox in Issue body
must_have.artifact       ->  Deliverable attachment/link  -
Phase dependency         ->  OP "follows" relation        -
PR                       ->  Linked in WP description     PR (cross-linked)
```

### Status Mapping

| GSD `ROADMAP.md` | OpenProject | GitHub Issue |
|-------------------|-------------|--------------|
| `pending` | New | Open |
| `executing` | In Progress | Open (label: in-progress) |
| `complete` | Closed | Closed |

### Custom Fields on OpenProject Work Packages

| Field | Type | Purpose |
|-------|------|---------|
| `gsd_phase` | Integer | Phase number |
| `gsd_plan` | Integer | Plan number within phase |
| `gsd_requirement_codes` | Text | Comma-separated REQ codes (MED-01, FOUND-02) |
| `gsd_duration_minutes` | Integer | Execution duration from SUMMARY.md |
| `gsd_commit_hash` | Text | Associated git commit |

### Sync Identity Table

```sql
CREATE SCHEMA IF NOT EXISTS sync;

CREATE TABLE sync.entity_map (
    id SERIAL PRIMARY KEY,
    op_project_id INTEGER,
    op_work_package_id INTEGER,
    github_issue_number INTEGER,
    github_milestone_id INTEGER,
    gsd_path TEXT,
    entity_type TEXT CHECK (entity_type IN ('milestone','phase','plan','quick','requirement')),
    op_updated_at TIMESTAMPTZ,
    gh_updated_at TIMESTAMPTZ,
    gsd_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sync.sync_log (
    id SERIAL PRIMARY KEY,
    workflow TEXT,
    direction TEXT,
    entity_map_id INTEGER REFERENCES sync.entity_map(id),
    action TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entity_map_op ON sync.entity_map(op_work_package_id);
CREATE INDEX idx_entity_map_gh ON sync.entity_map(github_issue_number);
CREATE INDEX idx_entity_map_gsd ON sync.entity_map(gsd_path);
```

## 2. Sync Flow Architecture

Six n8n workflows handle all sync directions.

### Workflow 1: OP -> GitHub (Webhook)

```
OpenProject webhook fires (WP created/updated/deleted)
  -> n8n receives event at /webhook/op-sync
  -> Check loop prevention (skip if update by svc-n8n-sync)
  -> Look up sync.entity_map for existing GitHub Issue
  -> If new WP: create GitHub Issue + labels + assign to Milestone
  -> If updated: update Issue title/body/status/labels
  -> If status -> Closed: close GitHub Issue
  -> Update sync.entity_map with timestamps
  -> Log to sync.sync_log
```

### Workflow 2: OP -> GSD (Webhook)

```
OpenProject webhook fires (WP status changed)
  -> n8n receives event at /webhook/op-sync
  -> Determine GSD path from sync.entity_map
  -> git pull latest main
  -> Update ROADMAP.md progress table (status column)
  -> Update STATE.md (current position, progress counts)
  -> If WP moved to Closed: update phase completion date
  -> git commit + push ("sync: update phase NN status from OpenProject [op-sync]")
  -> Update sync.entity_map
```

### Workflow 3: GitHub -> OP (Webhook/Poll)

```
GitHub webhook or poll detects new/updated Issue
  -> n8n receives event at /webhook/gh-sync
  -> Check loop prevention (skip if label synced-by:n8n on triggering event)
  -> Look up sync.entity_map
  -> If new Issue (no OP match): create WP in correct sub-project
  -> If updated: sync title/description/status to WP
  -> If Issue closed: update WP status to Closed
  -> Update sync.entity_map
```

### Workflow 4: GitHub -> OP (PR Merged)

```
GitHub PR merged event
  -> n8n receives event at /webhook/gh-sync
  -> Extract linked Issue numbers from PR body/branch name
  -> Look up sync.entity_map for each linked Issue
  -> Update linked WP: add PR URL to description, update status
  -> If all linked Issues closed: mark phase WP as Closed
  -> Update sync.entity_map
```

### Workflow 5: GSD -> OP (Git Push)

```
GitHub push webhook (commits to .planning/ files)
  -> n8n receives event at /webhook/gh-push
  -> Check loop prevention (skip commits with [op-sync] in message)
  -> Parse changed files from commit diff
  -> For each changed ROADMAP.md/STATE.md/PLAN.md:
    -> Extract phase/plan metadata
    -> Update corresponding WP in OpenProject
  -> For new PLAN.md files: create child WP
  -> Update sync.entity_map
```

### Workflow 6: Reconciliation (Scheduled, every 30 min)

```
Cron trigger (*/30 * * * *)
  -> Fetch all OP work packages (updated since last run)
  -> Fetch all GitHub Issues (updated since last run)
  -> git pull, parse ROADMAP.md + STATE.md
  -> For each entity in sync.entity_map:
    -> Compare timestamps across all three sources
    -> If OP is newest: push to GitHub + GSD (OP wins)
    -> If GitHub/GSD is newer than last sync but OP unchanged:
        -> Push to OP (no conflict)
    -> If both OP and GitHub/GSD changed since last sync:
        -> OP wins, overwrite others, log conflict
  -> Clean up orphaned sync entries
  -> Log: synced N, conflicts M, errors K
```

## 3. n8n Infrastructure & Authentik Setup

### Authentik Configuration

| Setting | Value |
|---------|-------|
| Application name | `n8n-openproject-sync` |
| Grant type | `client_credentials` |
| Scopes | `openid profile email api` |
| Token lifetime | 3600s |
| Service account | `svc-n8n-sync` |

The `svc-n8n-sync` service account needs admin role in the Parthenon parent project in OpenProject.

### n8n Credentials

| Credential | Type | Purpose |
|------------|------|---------|
| OpenProject API | OAuth2 via Authentik | OP work package CRUD |
| GitHub Parthenon | PAT (repo, issues, pull_requests scopes) | GitHub API access |
| Parthenon Git | SSH key or PAT | git clone/pull/commit/push |
| Parthenon Postgres | Postgres connection | sync schema read/write |

**Auth URLs:**
- Authorization: `https://auth.acumenus.net/application/o/authorize/`
- Token: `https://auth.acumenus.net/application/o/token/`

### Webhook Endpoints

| Webhook | Source | URL |
|---------|--------|-----|
| `/webhook/op-sync` | OpenProject | `https://n8n.acumenus.net/webhook/op-sync` |
| `/webhook/gh-sync` | GitHub (Issues, PRs, Milestones) | `https://n8n.acumenus.net/webhook/gh-sync` |
| `/webhook/gh-push` | GitHub (Push events) | `https://n8n.acumenus.net/webhook/gh-push` |

All webhooks use HMAC secret verification.

### OpenProject Webhook Config

- Settings -> Webhooks -> New
- Events: `work_package:created`, `work_package:updated`
- URL: `https://n8n.acumenus.net/webhook/op-sync`
- Secret: shared HMAC secret

### GitHub Webhook Config (sudoshi/Parthenon)

- Settings -> Webhooks -> New
- Events: Issues, Pull requests, Milestones, Push
- Content type: `application/json`
- Secret: shared HMAC secret

### Sync State Storage

`sync` schema in host PG17 (not Docker PG). n8n accesses via Postgres credential using `claude_dev` superuser or a dedicated `n8n_sync` role.

### n8n Git Working Directory

Clone target: `/data/n8n/parthenon-sync/` (persistent volume on n8n container). Used by Workflow 2 for GSD file updates.

## 4. Backfill Strategy

One-time import of Parthenon history, executed as an n8n workflow before activating live sync.

### Step 1: Create OpenProject Project Hierarchy

```
Parthenon (parent project)
  -> v5.4 - IRSF-NHS OMOP CDM Import (sub-project)
```

Create custom fields and "Phase" work package type on parent project.

### Step 2: Import Phases (12 Work Packages)

For each phase in ROADMAP.md:
- Type: Phase
- Subject: "Phase NN: {goal}"
- Description: Goal + success criteria as checklist
- Status: Closed
- Custom fields: gsd_phase, gsd_requirement_codes
- Relations: "follows" previous phase

### Step 3: Import Plans (24 Child Work Packages)

For each PLAN.md:
- Type: Task (child of Phase WP)
- Subject: "NN-NN: {objective}"
- Description: Objective + must_have truths as acceptance criteria
- Status: Closed
- Custom fields: gsd_plan, gsd_duration_minutes, gsd_commit_hash

### Step 4: Import Quick Tasks (19 Work Packages)

For each quick task in STATE.md:
- Type: Task (direct child of v5.4 sub-project)
- Tags: "quick-task"
- Status: Closed

### Step 5: Import Requirements as WP Metadata

Requirements from REQUIREMENTS.md become descriptions on Phase WPs. The `gsd_requirement_codes` field provides traceability.

### Step 6: Create GitHub Milestones + Issues

- 1 GitHub Milestone: "v5.4 - IRSF-NHS OMOP CDM Import" (state: closed)
- 55 GitHub Issues: 12 phases + 24 plans + 19 quick tasks
- Labels: `phase:NN`, `req:CODE-NN`, `quick`
- All closed (matching OP status)

### Step 7: Populate sync.entity_map

Every entity gets a row mapping OP WP ID <-> GitHub Issue # <-> GSD path.

### Step 8: Activate Webhooks

1. Enable OpenProject webhook
2. Enable GitHub webhooks
3. Enable reconciliation cron
4. Run manual reconciliation to verify zero drift

Backfill is idempotent: checks sync.entity_map before creating, re-running skips existing entities.

## 5. Error Handling & Observability

### Error Recovery

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| OpenProject API down | Webhook fails / poll returns 5xx | Retry 3x exponential backoff, queue for reconciliation |
| GitHub API rate limited | 403 + X-RateLimit-Remaining: 0 | Pause, resume after X-RateLimit-Reset |
| Authentik token expired | 401 from OP API | Auto-refresh via client_credentials, retry |
| Git push conflict | Push rejected (non-fast-forward) | git pull --rebase, retry, if fails -> log and alert |
| Webhook missed | Reconciliation detects drift | Corrected within 30 min |
| Duplicate creation | Race between webhook and reconciliation | UNIQUE constraint on sync.entity_map, upsert on conflict |
| GSD file parse failure | Malformed ROADMAP.md or STATE.md | Log error with content, skip entity, alert |

### Loop Prevention

| System | Marker | Detection |
|--------|--------|-----------|
| Git commits | `[op-sync]` in commit message | Workflow 5 skips these commits |
| GitHub Issues | `synced-by:n8n` label | Workflows 3/4 skip triggering events with this label |
| OpenProject WPs | `<!-- n8n-sync -->` in description | Workflows 1/2 skip updates by service account |

### Observability

**n8n dashboard:** Execution history per workflow at `https://n8n.acumenus.net`.

**sync.sync_log queries:**
```sql
-- Recent activity
SELECT workflow, direction, action, details->>'subject', created_at
FROM sync.sync_log ORDER BY created_at DESC LIMIT 50;

-- Conflicts last 24h
SELECT * FROM sync.sync_log
WHERE action = 'conflict_resolved'
AND created_at > NOW() - INTERVAL '24 hours';
```

**Alerting:** n8n error workflow sends email to `admin@acumenus.net` via Resend after 3 consecutive failures.

**Health check endpoint** at `/webhook/sync-health`:
```json
{
  "last_reconciliation": "2026-04-15T18:30:00Z",
  "entities_tracked": 55,
  "conflicts_last_24h": 0,
  "errors_last_24h": 0,
  "status": "healthy"
}
```

**Tracked metrics:**
- Sync latency (webhook received -> all targets updated)
- Conflicts per day
- API call volume (GitHub rate limit headroom)
- Entity drift (reconciliation corrections per run, should trend to zero)

## Implementation Order

1. Create sync schema + tables in host PG17
2. Provision Authentik service account + OAuth2 app
3. Create OpenProject parent project + sub-project + custom fields
4. Build and test backfill workflow (Workflows 1-5 logic reused)
5. Run backfill: OP project structure + WPs + GitHub Milestones/Issues
6. Populate sync.entity_map
7. Build Workflow 1 (OP -> GitHub) + Workflow 2 (OP -> GSD)
8. Build Workflow 3 (GitHub -> OP) + Workflow 4 (PR merged)
9. Build Workflow 5 (GSD -> OP via push)
10. Build Workflow 6 (Reconciliation)
11. Configure webhooks on OP and GitHub
12. Activate live sync, run manual reconciliation, verify zero drift
13. Build health check endpoint + alerting
