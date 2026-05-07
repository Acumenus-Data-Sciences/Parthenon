# PostgreSQL 17 OMOP and Vocabulary Optimization Report

Date: 2026-05-07  
Scope: local PostgreSQL 17 cluster, database `parthenon`, schemas `omop` and `vocab`

## Executive Summary

The local `parthenon` PostgreSQL 17 database is tuned for large, read-heavy OHDSI workloads on a high-memory NVMe workstation. The most important cluster-level tuning is active through `postgresql.auto.conf`: `shared_buffers=16GB`, `effective_cache_size=96GB`, aggressive parallelism, NVMe-oriented planner costs, larger WAL/checkpoint windows, WAL archiving, and more aggressive autovacuum/analyze defaults.

The `omop` and `vocab` schemas are also materially optimized with workload-specific indexes rather than full referential integrity. The `omop` schema is 334 GB total, with about 61 GB in indexes across 84 indexes after remediation. The `vocab` schema is 19 GB total, with about 9 GB in indexes across 32 indexes, including a 2.4 GB pgvector IVFFlat index for concept embeddings.

Key findings:

- The PostgreSQL parameter set is generally appropriate for this machine and workload.
- The original broad `parthenon` database-level `work_mem=256MB` was remediated after this review. The database default is now `64MB`, while `smudoshi` keeps an analyst/admin override of `256MB`.
- `parthenon_app` now has role-level guardrails: `work_mem=64MB`, `hash_mem_multiplier=4`, `idle_in_transaction_session_timeout=5min`, and `temp_file_limit=32GB`.
- WAL archiving is active and functioning; `pg_stat_archiver` showed 3,845 successful archives and 1 prior failure since 2026-04-27.
- OMOP indexing is intentionally focused on person/date and concept/person/date access paths for large clinical fact tables.
- The one invalid index found during review, `omop.idx_omop_device_person`, was dropped and rebuilt concurrently; no invalid `omop` or `vocab` indexes remain.
- There are no exact duplicate indexes in `omop` or `vocab`.
- Three smaller prefix indexes are candidates for review because a wider primary key starts with the same column sequence.
- Large OMOP fact tables do not have enforced primary keys or foreign keys. That is common for high-volume OMOP warehouses, but it means integrity is maintained by ETL discipline rather than PostgreSQL constraints.

## Remediation Status

Actions executed on 2026-05-07:

- Rebuilt `omop.idx_omop_device_person` with `DROP INDEX CONCURRENTLY` and `CREATE INDEX CONCURRENTLY`; catalog verification showed `indisvalid=true` and `indisready=true`.
- Restored the live `omop.visit_detail` primary key expected by the Laravel model and migration. `visit_detail_id` was verified non-null and unique across 26,293,435 rows, then attached as `visit_detail_pkey`.
- Lowered the broad `parthenon` database default from `work_mem=256MB` to `work_mem=64MB`.
- Preserved analyst/admin memory for `smudoshi` with `work_mem=256MB` and `hash_mem_multiplier=4`.
- Added `parthenon_app` session guardrails: `work_mem=64MB`, `hash_mem_multiplier=4`, `idle_in_transaction_session_timeout=5min`, and `temp_file_limit=32GB`.
- Enabled `pg_stat_statements`, `track_io_timing`, and `track_wal_io_timing`; PostgreSQL 17 was restarted and verified active under systemd.
- Changed `huge_pages` from `on` to `try` after `pg_stat_statements` pushed shared-memory startup above the available huge-page allocation. This preserves huge-page use when available but allows safe startup fallback.
- Ran targeted `ANALYZE` on the largest `omop` and `vocab` tables.
- Ran the existing backup prune script; no artifacts were eligible for deletion. The backup filesystem remained at about 346 GB free and 91% used.
- Hardened `scripts/pg-host-basebackup.sh` with a default 300 GB free-space preflight, a projected post-backup free-space check, and a post-success prune call.

Still open:

- Collect representative query workload in `pg_stat_statements` before pruning any large zero-scan indexes.
- Let `pg_stat_statements` collect representative workload before adding secondary `visit_detail` indexes.
- Keep `omop.assign_all_visit_ids` heap-only unless future app/runtime evidence shows interactive reads.
- Reduce `/mnt/md0` pressure by adding more capacity, moving older artifacts off-host, or tightening backup retention once recovery requirements are confirmed.

## Environment Snapshot

| Item | Value |
| --- | --- |
| PostgreSQL version | 17.9 (Ubuntu 17.9-0ubuntu0.25.10.1) |
| Database | `parthenon` |
| Database size | 752 GB |
| Connection used for assessment | `127.0.0.1:5432`, user `smudoshi` |
| Data directory | `/var/lib/postgresql/17/main` |
| Config file | `/etc/postgresql/17/main/postgresql.conf` |
| Primary tuned config source | `/var/lib/postgresql/17/main/postgresql.auto.conf` |
| CPU | 32 logical CPUs, Intel Core i9-13900KF |
| Memory | 123 GiB total, 48 GiB available during review |
| Swap | 8.0 GiB total, fully used during review |
| Root/PostgreSQL filesystem | 3.6 TB total, 477 GB free, 87% used |
| Backup filesystem `/mnt/md0` | 3.7 TB total, 346 GB free, 91% used |

The Parthenon source registry maps the active Acumenus OHDSI source as:

| Source key | Source name | Daimon | Schema |
| --- | --- | --- | --- |
| `ACUMENUS` | `OHDSI Acumenus CDM` | `cdm` | `omop` |
| `ACUMENUS` | `OHDSI Acumenus CDM` | `vocabulary` | `vocab` |
| `ACUMENUS` | `OHDSI Acumenus CDM` | `results` | `results` |

## PostgreSQL Parameter Evaluation

### Configuration Hierarchy

Most tuning is cluster-wide through `postgresql.auto.conf`, which means it was likely applied through `ALTER SYSTEM`.

Important role/database settings after remediation:

| Scope | Setting |
| --- | --- |
| `parthenon`, all roles | `work_mem=64MB` |
| `parthenon`, all roles | `hash_mem_multiplier=4` |
| `parthenon`, `smudoshi` | `work_mem=256MB` |
| `parthenon`, `smudoshi` | `hash_mem_multiplier=4` |
| `parthenon`, `parthenon_app` | `work_mem=64MB` |
| `parthenon`, `parthenon_app` | `hash_mem_multiplier=4` |
| `parthenon`, `parthenon_app` | `idle_in_transaction_session_timeout=5min` |
| `parthenon`, `parthenon_app` | `temp_file_limit=32GB` |

The important active memory values are:

| Setting | Cluster file value | Active `parthenon` value | Assessment |
| --- | ---: | ---: | --- |
| `work_mem` | 64 MB | 64 MB default; 256 MB for `smudoshi` | Safer for app/API concurrency while preserving analyst headroom. |
| `hash_mem_multiplier` | 8 | 4 | Caps default hash memory at 256 MB for app traffic and 1 GB for `smudoshi` analytical sessions. |

### Memory and Planner Settings

| Setting | Active value | Source | Evaluation |
| --- | ---: | --- | --- |
| `shared_buffers` | 16 GB | config file | Reasonable. This is about 13% of RAM, leaving the OS page cache room for a 752 GB database. |
| `effective_cache_size` | 96 GB | config file | Reasonable planner hint for a 123 GiB host with substantial OS cache. |
| `work_mem` | 64 MB default; 256 MB for `smudoshi` | database/role | Safer default for application concurrency while preserving analyst sessions. |
| `hash_mem_multiplier` | 4 | database/role | Allows default hash operations up to about 256 MB and `smudoshi` hash operations up to about 1 GB. |
| `maintenance_work_mem` | 1 GB | config file | Good for index creation, vacuum, and bulk maintenance. |
| `huge_pages` | try | config file | Safer after enabling `pg_stat_statements`; uses huge pages when available but allows startup fallback. |
| `default_statistics_target` | 500 | config file | Good for skewed OMOP and vocabulary distributions. Raises analyze cost but improves planner quality. |

Evaluation: memory tuning is strong for a local analytical warehouse. The broad `work_mem=256MB` risk identified during review has been reduced by moving that value to `smudoshi` instead of applying it to every `parthenon` session.

Recommended posture:

- Keep high `work_mem` available only for controlled analytics.
- Keep app/API roles on lower defaults unless a specific background job requires a higher session override.
- Watch `pg_stat_statements` temp block and timing data before making further memory changes.

### CPU and Parallelism

| Setting | Active value | Evaluation |
| --- | ---: | --- |
| `max_worker_processes` | 32 | Matches the 32 logical CPU host. |
| `max_parallel_workers` | 16 | Good cap for mixed workloads; avoids consuming all CPU for parallel query. |
| `max_parallel_workers_per_gather` | 4 | Practical for large table scans and joins. |
| `max_parallel_maintenance_workers` | 4 | Good for index builds and maintenance. |

Evaluation: parallelism is well matched to the host. It is appropriate for local OHDSI analytics and bulk maintenance. If the machine also hosts latency-sensitive services, watch CPU saturation during large analytical scans.

### Storage and Planner Costing

| Setting | Active value | Evaluation |
| --- | ---: | --- |
| `effective_io_concurrency` | 200 | Appropriate for NVMe or high-concurrency SSD storage. |
| `random_page_cost` | 1.25 | Appropriate for SSD/NVMe; encourages index access more than the default `4.0`. |
| `seq_page_cost` | 1.0 | Default; works with the lower random page cost. |

Evaluation: these values fit the local NVMe-backed data directory. They make the planner more willing to use selective indexes on large OMOP tables.

### WAL, Checkpoints, and Backup

| Setting | Active value | Evaluation |
| --- | ---: | --- |
| `archive_mode` | on | Good. Enables continuous WAL archiving. |
| `archive_command` | `scripts/pg-host-archive-wal.sh "%p" "%f"` | Good. Integrated with the repo backup script. |
| `archive_timeout` | 300 s | Good for bounded recovery point lag. |
| `wal_level` | replica | Required for physical backups/replication. |
| `max_wal_senders` | 10 | Fine for backup/replication headroom. |
| `max_wal_size` | 32 GB | Good for reducing checkpoint pressure during large loads. |
| `min_wal_size` | 8 GB | Good for a large warehouse. |
| `checkpoint_timeout` | 15 min | Good for reducing checkpoint frequency. |
| `checkpoint_completion_target` | 0.9 | Good. Keeps checkpoint writes spread out. |
| `wal_compression` | pglz | Useful. Consider testing `lz4` or `zstd` later if available and WAL volume is high. |
| `wal_buffers` | 64 MB | Good for high-write/bulk-load periods. |

Runtime signals:

| Signal | Value |
| --- | ---: |
| `pg_stat_archiver.archived_count` | 3,845 |
| `pg_stat_archiver.failed_count` | 1 |
| Last archived WAL | 2026-05-07 17:30:22-04 |
| Last failed archive | 2026-05-04 13:17:48-04 |
| WAL generated since stats reset | 15 GB |
| `wal_buffers_full` | 0 |
| Timed checkpoints | 968 |
| Requested checkpoints | 13 |
| Checkpointer stats reset | 2026-04-27 12:22:14-04 |

Evaluation: WAL/checkpoint tuning is healthy. Requested checkpoints are low relative to timed checkpoints, and `wal_buffers_full=0` indicates the WAL buffer setting is not currently constraining write throughput.

Operational concern: `/mnt/md0` is 91% used. The backup area held about:

| Backup path | Size |
| --- | ---: |
| `/mnt/md0/postgres-backups/base` | 461 GB |
| `/mnt/md0/postgres-backups/logical` | 72 GB |
| `/mnt/md0/postgres-backups/wal` | 13 GB |

The backup volume needs free-space monitoring and pruning discipline.

### Autovacuum, Analyze, and Statistics

| Setting | Active value | Evaluation |
| --- | ---: | --- |
| `autovacuum_max_workers` | 6 | Good for a large database. |
| `autovacuum_naptime` | 15 s | Aggressive and appropriate for active large tables. |
| `autovacuum_vacuum_cost_delay` | 0 ms | Aggressive. Good for maintenance throughput, but can increase IO pressure. |
| `autovacuum_work_mem` | 512 MB | Good for large table/index cleanup. |
| `default_statistics_target` | 500 | Good for OHDSI skew and vocabulary joins. |

Catalog notes:

- `pg_stats` contains column statistics for the major `omop` and `vocab` tables.
- `pg_stat_user_tables.n_live_tup` is zero for most large imported OMOP tables even though `pg_class.reltuples` has realistic row estimates.
- The large imported tables have no concerning transaction age; the largest `relfrozenxid` ages were about 9 million, far below wraparound risk.

Evaluation: the statistics target is good, and planner stats exist. The table activity counters are not reliable as row-count evidence for most imported OMOP tables, so relation estimates should come from `pg_class.reltuples` or explicit counts when needed. After future bulk loads, run `ANALYZE` on affected tables so planner histograms stay fresh.

### Observability and Guardrails

| Setting | Active value | Evaluation |
| --- | ---: | --- |
| `log_min_duration_statement` | 100 ms | Useful, but potentially noisy on this workload. |
| `track_io_timing` | on | IO timing diagnosis is now available. |
| `track_wal_io_timing` | on | WAL timing diagnosis is now available. |
| `shared_preload_libraries` | `pg_stat_statements` | Query-level workload collection is now active. |
| `statement_timeout` | 0 | No query time limit. OK for admin analytics, risky for application roles. |
| `idle_in_transaction_session_timeout` | 5 min for `parthenon_app`; 0 otherwise | App idle transactions now have a cutoff. |
| `temp_file_limit` | 32 GB for `parthenon_app`; unlimited otherwise | App temp spills now have a ceiling. |

Recommended posture:

- Use `pg_stat_statements` for at least a representative workload cycle before pruning indexes.
- Consider a role-level `statement_timeout` only after confirming it will not interrupt legitimate long-running cohort and export jobs.
- Keep `track_io_timing` enabled unless measurable overhead appears.

## Schema Size and Row Estimates

| Schema | Tables | Total size | Heap/main data | Index size | Estimated rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| `omop` | 55 | 334 GB | 268 GB | 61 GB | 1,549,229,758 |
| `vocab` | 16 | 19 GB | 7,768 MB | 9,061 MB | 138,489,824 |

The `omop` schema is dominated by imported clinical facts. The `vocab` schema is smaller but has a high index-to-table ratio because relationship, ancestry, and vector search paths are heavily indexed.

Largest `omop` tables:

| Table | Estimated rows | Table/heap | Indexes | Total | Index % | Index count |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `measurement` | 711,054,000 | 94 GB | 26 GB | 120 GB | 21.7% | 2 |
| `note` | 52,563,200 | 91 GB | 3,200 MB | 99 GB | 3.2% | 5 |
| `observation` | 343,204,000 | 32 GB | 13 GB | 44 GB | 28.7% | 2 |
| `procedure_occurrence` | 110,893,000 | 9,615 MB | 5,164 MB | 14 GB | 34.9% | 2 |
| `drug_exposure` | 86,085,200 | 10,038 MB | 3,994 MB | 14 GB | 28.5% | 2 |
| `claims` | 26,293,500 | 6,067 MB | 3,142 MB | 9,210 MB | 34.1% | 3 |
| `visit_occurrence` | 52,584,600 | 7,470 MB | 1,360 MB | 8,832 MB | 15.4% | 2 |
| `all_visits` | 26,864,700 | 3,619 MB | 2,291 MB | 5,911 MB | 38.8% | 3 |
| `assign_all_visit_ids` | 28,220,200 | 4,900 MB | 0 bytes | 4,901 MB | 0.0% | 0 |
| `visit_detail` | 26,293,000 | 3,735 MB | 0 bytes | 3,736 MB | 0.0% | 0 |
| `final_visit_ids` | 26,949,200 | 1,968 MB | 1,518 MB | 3,486 MB | 43.5% | 1 |
| `condition_occurrence` | 14,708,400 | 1,419 MB | 742 MB | 2,161 MB | 34.3% | 2 |

Largest `vocab` tables:

| Table | Estimated rows | Table/heap | Indexes | Total | Index % | Index count |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `concept_ancestor` | 78,656,400 | 3,322 MB | 2,881 MB | 6,204 MB | 46.4% | 3 |
| `concept_embedding_bge` | 632,593 | 51 MB | 2,501 MB | 5,063 MB | 49.4% | 3 |
| `concept_relationship` | 40,630,800 | 2,372 MB | 2,643 MB | 5,016 MB | 52.7% | 4 |
| `concept` | 7,077,480 | 1,099 MB | 580 MB | 1,679 MB | 34.5% | 6 |
| `concept_synonym` | 4,159,150 | 359 MB | 59 MB | 418 MB | 14.1% | 1 |
| `concept_tree` | 538,424 | 123 MB | 244 MB | 367 MB | 66.5% | 3 |
| `phoebe` | 3,768,440 | 237 MB | 78 MB | 314 MB | 24.7% | 2 |
| `drug_strength` | 3,020,770 | 205 MB | 75 MB | 279 MB | 26.7% | 2 |

## Index and Key Evaluation

### Index Inventory

| Schema | Indexes | Index size | Primary indexes | Unique non-PK indexes | Non-unique indexes | Invalid/not-ready |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `omop` | 84 | 61 GB | 24 | 1 | 59 | 0 |
| `vocab` | 32 | 9,061 MB | 12 | 0 | 20 | 0 |

Index methods:

| Schema | Method | Count | Size |
| --- | --- | ---: | ---: |
| `omop` | btree | 84 | 61 GB |
| `vocab` | btree | 31 | 6,588 MB |
| `vocab` | ivfflat | 1 | 2,472 MB |

### Key and Constraint Inventory

| Schema | Primary keys | Foreign keys | Notes |
| --- | ---: | ---: | --- |
| `omop` | 24 | 1 | Many high-volume clinical fact tables are intentionally unconstrained; `visit_detail` now has its expected primary key. |
| `vocab` | 12 | 2 | Vocabulary keys are much more fully enforced. |

Foreign keys are indexed on the referencing side:

| Schema | Table | Foreign key | Referencing index coverage |
| --- | --- | --- | --- |
| `omop` | `claims_transactions` | `claimid` references `omop.claims(id)` | Covered |
| `vocab` | `concept_embedding_bge` | `concept_id` references `vocab.concept(concept_id)` | Covered by PK |
| `vocab` | `pgs_score_variants` | `score_id` references `vocab.pgs_scores(score_id)` | Covered by PK prefix and explicit score index |

Large tables without primary keys:

| Schema | Table | Estimated rows | Total size | Index count |
| --- | --- | ---: | ---: | ---: |
| `omop` | `measurement` | 711,054,000 | 120 GB | 2 |
| `omop` | `observation` | 343,204,000 | 44 GB | 2 |
| `omop` | `procedure_occurrence` | 110,893,000 | 14 GB | 2 |
| `omop` | `drug_exposure` | 86,085,200 | 14 GB | 2 |
| `omop` | `visit_occurrence` | 52,584,600 | 8,832 MB | 2 |
| `omop` | `all_visits` | 26,864,700 | 5,911 MB | 3 |
| `omop` | `assign_all_visit_ids` | 28,220,200 | 4,901 MB | 0 |
| `omop` | `final_visit_ids` | 26,949,200 | 3,486 MB | 1 |

Assessment: the lack of primary keys on the largest clinical fact tables is a performance-oriented warehouse choice. It avoids large uniqueness enforcement overhead during bulk loads and analytics, but it also means the database will not prevent duplicate fact IDs or broken OMOP references. If these schemas become write-active or shared with external writers, add validation jobs or staged constraint checks.

### OMOP Index Strategy

The large OMOP fact tables use a consistent analytical pattern:

- Person/date indexes support patient timeline lookups.
- Concept/person/date indexes support cohort and concept-constrained retrieval.
- Descending date order supports "latest first" patient views.

Representative high-value OMOP indexes:

| Table | Index | Size | Scans | Columns |
| --- | --- | ---: | ---: | --- |
| `measurement` | `idx_meas_concept_person_date` | 21 GB | 0 | `(measurement_concept_id, person_id, measurement_date DESC)` |
| `measurement` | `idx_measurement_person_id` | 5,655 MB | 13 | `(person_id, measurement_date DESC)` |
| `observation` | `idx_obs_concept_person_date` | 10 GB | 0 | `(observation_concept_id, person_id, observation_date DESC)` |
| `observation` | `idx_observation_person_id` | 2,689 MB | 0 | `(person_id, observation_date DESC)` |
| `condition_occurrence` | `idx_co_concept_person` | 442 MB | 23 | `(condition_concept_id, person_id, condition_start_date DESC)` |
| `condition_occurrence` | `idx_condition_occ_person_id` | 300 MB | 22 | `(person_id, condition_start_date DESC)` |
| `procedure_occurrence` | `idx_proc_concept_person_date` | 3,333 MB | 0 | `(procedure_concept_id, person_id, procedure_date DESC)` |
| `procedure_occurrence` | `idx_procedure_person_id` | 1,832 MB | 3 | `(person_id, procedure_date DESC)` |
| `drug_exposure` | `idx_drug_concept_person_date` | 2,582 MB | 0 | `(drug_concept_id, person_id, drug_exposure_start_date DESC)` |
| `drug_exposure` | `idx_drug_person_id` | 1,411 MB | 4 | `(person_id, drug_exposure_start_date DESC)` |
| `visit_occurrence` | `idx_visit_person_id` | 995 MB | 0 | `(person_id, visit_start_date DESC)` |

Assessment: this is the right indexing shape for a patient-centric analytics and cohort platform. The zero-scan values should not be treated as proof that the indexes are useless; `idx_scan` depends on the observed workload and stats lifetime. These indexes also protect expensive user-facing paths that may be infrequent but important.

The two largest zero-scan indexes, `measurement` concept/person/date and `observation` concept/person/date, cost about 31 GB together. They are expensive, but they match common cohort/concept filtering patterns. Do not drop them without query-plan evidence from representative cohort, concept set, patient profile, and data explorer workflows.

### Vocab Index Strategy

The vocabulary schema is optimized for concept lookup, ancestry traversal, relationship joins, and vector search.

Largest vocab indexes:

| Table | Index | Method | Size | Scans | Definition summary |
| --- | --- | --- | ---: | ---: | --- |
| `concept_embedding_bge` | `concept_embedding_bge_ivfflat_cos` | ivfflat | 2,472 MB | 4,662 | `embedding vector_cosine_ops WITH (lists=200)` |
| `concept_ancestor` | `concept_ancestor_pkey` | btree | 1,685 MB | 802 | `(ancestor_concept_id, descendant_concept_id)` |
| `concept_relationship` | `concept_relationship_pkey` | btree | 1,607 MB | 0 | `(concept_id_1, concept_id_2, relationship_id)` |
| `concept_ancestor` | `idx_concept_ancestor_1` | btree | 600 MB | 2 | `(ancestor_concept_id)` |
| `concept_ancestor` | `idx_concept_ancestor_2` | btree | 596 MB | 32 | `(descendant_concept_id)` |
| `concept_relationship` | `idx_concept_rel_1` | btree | 382 MB | 4 | `(concept_id_1)` |
| `concept_relationship` | `idx_concept_rel_2` | btree | 382 MB | 4 | `(concept_id_2)` |
| `concept` | `concept_pkey` | btree | 152 MB | 1,258,414 | `(concept_id)` |

Assessment:

- `vocab.concept_pkey` is extremely hot and clearly justified.
- `concept_embedding_bge_ivfflat_cos` is also actively used and is the dominant vector search acceleration path.
- The ancestry and relationship indexes are storage-heavy but appropriate for OHDSI vocabulary traversals.
- `concept_relationship_pkey` has zero scans in the observed stats window, but primary keys are integrity structures first and should not be considered removable.

The vector table has `public.vector(768)` embeddings. Its heap is only 51 MB, but TOAST and index storage dominate the table. That is normal for 768-dimensional vectors plus an ANN index.

### Invalid Index

| Schema | Table | Index | Status | Size | Definition |
| --- | --- | --- | --- | ---: | --- |
| `omop` | `device_exposure` | `idx_omop_device_person` | rebuilt and valid | 56 MB | `btree(person_id)` |

The index was invalid during the initial review. It has since been dropped and rebuilt concurrently.

Recommended repair:

```sql
DROP INDEX CONCURRENTLY IF EXISTS omop.idx_omop_device_person;
CREATE INDEX CONCURRENTLY idx_omop_device_person
    ON omop.device_exposure (person_id);
```

Post-remediation catalog checks showed no invalid or not-ready indexes in `omop` or `vocab`.

### Prefix Index Review Candidates

No exact duplicate indexes were found. These prefix indexes are candidates for review because a wider btree index on the same table starts with the same leading column or columns:

| Schema | Table | Candidate index | Candidate size | Covering index | Covering size | Assessment |
| --- | --- | --- | ---: | --- | ---: | --- |
| `vocab` | `concept_ancestor` | `idx_concept_ancestor_1(ancestor_concept_id)` | 600 MB | `concept_ancestor_pkey(ancestor_concept_id, descendant_concept_id)` | 1,685 MB | Possible redundancy, but the smaller single-column index may still be faster for ancestry fanout queries. Keep until query plans prove otherwise. |
| `vocab` | `concept_relationship` | `idx_concept_rel_1(concept_id_1)` | 382 MB | `concept_relationship_pkey(concept_id_1, concept_id_2, relationship_id)` | 1,607 MB | Possible redundancy. Review with real relationship traversal plans. |
| `vocab` | `pgs_score_variants` | `pgs_score_variants_score_idx(score_id)` | 56 kB | `pgs_score_variants_pkey(score_id, chrom, pos_grch38, effect_allele)` | 448 kB | Technically redundant for left-prefix lookup, but too small to matter. |

Do not remove any of these solely from catalog shape. The single-column indexes are much smaller than their covering primary keys and can be beneficial for cache residency and planner cost.

### Large Tables With Few Or No Secondary Indexes

| Schema | Table | Estimated rows | Total size |
| --- | --- | ---: | ---: |
| `omop` | `assign_all_visit_ids` | 28,220,200 | 4,901 MB |
| `omop` | `visit_detail` | 26,293,000 | 3,736 MB plus 563 MB primary-key index |

Assessment:

- If these are ETL staging/output tables used only in bulk sequential processing, few or no secondary indexes may be intentional.
- `visit_detail` now has its primary key; if it is queried by patient, visit, date, or concept from application code, it may still need secondary indexes.
- Before adding indexes, verify actual access paths. Candidate shapes would likely be `person_id, visit_detail_start_date` or `visit_occurrence_id`, depending on workload.

## Risk Register

| Priority | Risk | Evidence | Recommendation |
| --- | --- | --- | --- |
| Completed | Invalid index on `omop.device_exposure(person_id)` | `idx_omop_device_person` was `indisvalid=false` | Rebuilt concurrently and verified valid. |
| Completed | Database-wide `work_mem=256MB` could overcommit memory | Active source was database-level override for all roles in `parthenon` | Database default lowered to `64MB`; `smudoshi` keeps `256MB`; `parthenon_app` has guardrails. |
| Completed | Query observability was limited | `shared_preload_libraries` was empty and `track_io_timing` was off | Enabled `pg_stat_statements`, `track_io_timing`, and `track_wal_io_timing`. |
| Partially completed | Backup filesystem is tight | `/mnt/md0` is 91% used | Base-backup preflight and post-success prune added; still needs capacity or retention decision. |
| Partially completed | Large low-index tables may be under-indexed if user-facing | `assign_all_visit_ids` is heap-only; `visit_detail` now has PK only | Confirm usage with `pg_stat_statements`; add targeted secondary indexes only if queried interactively. |
| Medium | Some large indexes show zero scans in current stats | Several 1-21 GB indexes have `idx_scan=0` | Do not drop yet; first capture representative workload with `pg_stat_statements`. |
| Low | `wal_compression=pglz` may not be optimal | Active setting is pglz | Benchmark `lz4` or `zstd` only if WAL volume or archive size becomes a problem. |
| Completed | `parthenon_app` lacked session guardrails | `idle_in_transaction_session_timeout=0`, `temp_file_limit=-1` before remediation | Added `idle_in_transaction_session_timeout=5min` and `temp_file_limit=32GB` for `parthenon_app`. |

## Recommended Next Steps

1. Repair the invalid OMOP device index. Completed 2026-05-07.

   ```sql
   DROP INDEX CONCURRENTLY IF EXISTS omop.idx_omop_device_person;
   CREATE INDEX CONCURRENTLY idx_omop_device_person
       ON omop.device_exposure (person_id);
   ```

2. Decide whether `work_mem=256MB` should apply to every role in `parthenon`. Completed 2026-05-07.

   Safer pattern:

   ```sql
   ALTER DATABASE parthenon SET work_mem = '64MB';
   ALTER DATABASE parthenon SET hash_mem_multiplier = 4;
   ALTER ROLE smudoshi IN DATABASE parthenon SET work_mem = '256MB';
   ```

   Adjust role names to match the actual analytical and application users.

3. Add a planned observability restart if deeper index pruning is desired. Completed 2026-05-07.

   ```sql
   ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
   ALTER SYSTEM SET track_io_timing = 'on';
   ```

   Then restart PostgreSQL and create the extension in `parthenon` if needed:

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   ```

4. Reassess zero-scan large indexes only after collecting representative workload data.

   Do not drop the 21 GB `measurement` concept/person/date index or 10 GB `observation` concept/person/date index without query-plan evidence from cohort generation, vocabulary/concept workflows, patient profile, and data explorer paths.

5. Validate access patterns for `omop.visit_detail` and `omop.assign_all_visit_ids`.

   If interactive reads exist, add targeted indexes. If they are ETL artifacts only, document that and leave them heap-only.

6. Keep backup pruning and free-space checks tight.

   `/mnt/md0` at 91% used is the operational pressure point most likely to cause an avoidable failure.

## Appendix A: Active Tuned Parameters

| Setting | Active value | Source |
| --- | ---: | --- |
| `archive_command` | `/home/smudoshi/Github/Parthenon/scripts/pg-host-archive-wal.sh "%p" "%f"` | configuration file |
| `archive_mode` | `on` | configuration file |
| `archive_timeout` | `300s` | configuration file |
| `autovacuum_max_workers` | `6` | configuration file |
| `autovacuum_naptime` | `15s` | configuration file |
| `autovacuum_vacuum_cost_delay` | `0ms` | configuration file |
| `autovacuum_work_mem` | `512MB` | configuration file |
| `bgwriter_delay` | `50ms` | configuration file |
| `bgwriter_lru_maxpages` | `800` | configuration file |
| `bgwriter_lru_multiplier` | `4` | configuration file |
| `checkpoint_completion_target` | `0.9` | default |
| `checkpoint_timeout` | `15min` | configuration file |
| `default_statistics_target` | `500` | configuration file |
| `effective_cache_size` | `96GB` | configuration file |
| `effective_io_concurrency` | `200` | configuration file |
| `hash_mem_multiplier` | `4` | database |
| `huge_pages` | `try` | configuration file |
| `jit_above_cost` | `500000` | configuration file |
| `jit_inline_above_cost` | `500000` | configuration file |
| `jit_optimize_above_cost` | `500000` | configuration file |
| `listen_addresses` | `*` | configuration file |
| `log_min_duration_statement` | `100ms` | configuration file |
| `maintenance_work_mem` | `1GB` | configuration file |
| `max_connections` | `100` | configuration file |
| `max_parallel_maintenance_workers` | `4` | configuration file |
| `max_parallel_workers` | `16` | configuration file |
| `max_parallel_workers_per_gather` | `4` | configuration file |
| `max_wal_senders` | `10` | configuration file |
| `max_wal_size` | `32GB` | configuration file |
| `max_worker_processes` | `32` | configuration file |
| `min_wal_size` | `8GB` | configuration file |
| `random_page_cost` | `1.25` | configuration file |
| `shared_buffers` | `16GB` | configuration file |
| `shared_preload_libraries` | `pg_stat_statements` | configuration file |
| `track_io_timing` | `on` | configuration file |
| `track_wal_io_timing` | `on` | configuration file |
| `wal_buffers` | `64MB` | configuration file |
| `wal_compression` | `pglz` | configuration file |
| `wal_level` | `replica` | configuration file |
| `wal_writer_delay` | `10ms` | configuration file |
| `wal_writer_flush_after` | `4MB` | configuration file |
| `work_mem` | `64MB` default; `256MB` for `smudoshi` | database/role |

## Appendix B: Commands Used

These commands were run against catalog and statistics views only; no data scans or schema changes were performed.

```bash
pg_lsclusters
pg_isready -h 127.0.0.1 -p 5432
psql -h 127.0.0.1 -p 5432 -U smudoshi -d parthenon
```

Primary catalog sources:

```sql
SELECT * FROM pg_settings;
SELECT * FROM pg_file_settings;
SELECT * FROM pg_db_role_setting;
SELECT * FROM pg_stat_archiver;
SELECT * FROM pg_stat_wal;
SELECT * FROM pg_stat_checkpointer;
SELECT * FROM pg_stat_user_tables;
SELECT * FROM pg_stat_user_indexes;
SELECT * FROM pg_class;
SELECT * FROM pg_index;
SELECT * FROM pg_constraint;
SELECT * FROM pg_stats;
```
