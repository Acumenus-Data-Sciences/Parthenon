---
doc_type: runbook
status: active
date: 2026-07-22
owner: acumenus
module: omop-vocabulary
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_07_23_020000_harden_vocabulary_import_audit.php
  - backend/app/Services/Vocabulary/VocabularyImportService.php
  - backend/app/Jobs/Vocabulary/VocabularyImportJob.php
  - backend/app/Console/Commands/Omop/LoadVocabularyCommand.php
  - backend/config/vocabulary.php
related_prs: []
---

# OMOP Vocabulary Import Audit Hardening

## Change

The vocabulary import audit now records the omitted-vocabulary decision, a
hash/count/version manifest, checkpointed downstream statuses, and the verified
pre-import backup path. Database completion is represented as
`awaiting_downstreams` until hierarchy, VSAC, BGE, Solr, Chroma, and Hecate
checkpoints are complete; it is no longer reported as a false end-to-end
success.

The shared import service replaces live `TRUNCATE ... CASCADE` loading with an
isolated staging schema, full file/reference validation, fail-closed local
vocabulary preservation, and one transactional merge. It requires a readable
directory-format `pg_dump` containing `toc.dat` before changing a non-empty
vocabulary schema.

## Migration

`2026_07_23_020000_harden_vocabulary_import_audit.php` adds four columns to
`app.vocabulary_imports`:

- `remove_omitted` boolean, default false;
- `manifest` JSONB;
- `downstream_status` JSONB;
- `backup_path` string.

The change is additive. Its `down()` removes only those four columns.

## Apply

Apply this migration by its exact path with the migrator role, then deploy PHP
caches. Do not use a broad database deploy when unrelated pending migrations
or fixture exports are present.

Before enabling uploads, mount the chosen verified backup directory read-only
at `/var/backups/vocabulary` in both PHP and Horizon and set
`VOCABULARY_IMPORT_BACKUP_PATH=/var/backups/vocabulary`. Confirm `toc.dat` is
readable inside both containers.

## Acceptance

1. Migration status reports this migration as ran.
2. A non-empty target without readable backup evidence fails before staging or
   live writes.
3. Preflight creates, loads, validates, and drops staging without changing live
   counts.
4. Omitted `IRSF-NHS` concepts, relationships, and source maps remain exact.
5. A completed manual refresh has one truthful audit row whose downstream
   statuses are all complete.

The broader refresh evidence and rollback assets are governed by
`docs/lineage/plans/open/2026-07-22-omop-vocabulary-refresh-irsf-preservation.md`.
