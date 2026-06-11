---
doc_type: runbook
status: active
date: 2026-06-11
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_06_11_140000_add_source_to_publication_drafts.php
  - backend/app/Services/Publication/ManuscriptDraftFactory.php
  - backend/app/Http/Controllers/Api/V1/StudyManuscriptController.php
related_prs: []
related_adr: docs/lineage/decisions/adr/adr-0020-protocol-to-publication-pipeline.md
---
# Migration + bridge: seed a /publish draft from the composed manuscript

## What

Coordinated Studies ↔ Publish improvement, phases 1–2.

Schema (migration `2026_06_11_140000_add_source_to_publication_drafts.php`):
adds a nullable `publication_drafts.source` column. `NULL`/`manual` = built in
the /publish wizard; `study_manuscript` = seeded from a study's composed
ManuscriptComposer output. Gives the "Open in Publisher" hand-off idempotency
(find-or-create) and provenance.

Bridge:
- `ManuscriptDraftFactory` composes a study's manuscript (gate-aware,
  withheld estimates already blinded), maps the six STROBE/RECORD sections into
  the publish `DocumentJson` (`abstract`/`introduction`→introduction,
  `methods`→methods, `results`→results, `limitations`/`provenance`→discussion),
  and persists a study-linked, `visibility=study` draft. Idempotent per user.
- `POST /studies/{study}/manuscript/draft` (`permission:studies.view`) returns
  the draft id. The Studies "Open in Publisher" button now calls it and opens
  `/publish/library/{id}` pre-filled — previously it navigated to
  `/publish?studyId=`, whose query string was dropped by the `/publish`→library
  redirect, so the hand-off lost study context entirely.
- `PublicationController::draftPayload` now exposes `study_slug`/`study_title`
  (eager-loaded in `listDrafts` to avoid N+1) so `/publish` can render a
  "Back to study" return link → `/studies/{slug}?tab=manuscript`.

Shared foundation (frontend): a gold `.btn-publish` variant (the "publishing"
accent) + `components/manuscript/` primitives (`ManuscriptSectionRenderer`,
`AuthorByline`, `ExportMenu`, one `downloadBlob` helper) + a canonical
`ManuscriptDocument`/`Section` type shared by Studies and /publish.

## Why

The composer (Studies Manuscript tab) and `/publish` were two independent
publication pipelines sharing only the export sink (`PublicationService`). The
composer's curated, gate-blinded output was discarded on hand-off and the one
nav link was broken. This wires the real data bridge so the editorial workspace
starts from the gate-respecting first draft.

## Production verification (study 165)

`findOrCreate(study 165, admin)` → draft #21, `source=study_manuscript`,
`visibility=study`, 6 sections mapped (Results = 3,549 chars of gate-aware
prose). Route `POST api/v1/studies/{study}/manuscript/draft` registered.

## Rollback

`migrate:rollback` drops `publication_drafts.source`. Seeded drafts remain valid
(they just lose the provenance marker; the hand-off falls back to creating a new
draft each time).
