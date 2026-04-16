-- scripts/openproject-sync/schema.sql
-- Sync state for OpenProject ↔ GitHub ↔ GSD bidirectional sync

CREATE SCHEMA IF NOT EXISTS sync;

CREATE TABLE sync.entity_map (
    id SERIAL PRIMARY KEY,
    op_project_id INTEGER,
    op_work_package_id INTEGER,
    op_version_id INTEGER,
    github_issue_number INTEGER,
    github_milestone_number INTEGER,
    gsd_path TEXT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('milestone','phase','plan','quick','requirement','version')),
    op_updated_at TIMESTAMPTZ,
    gh_updated_at TIMESTAMPTZ,
    gsd_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_entity_map_op_wp ON sync.entity_map(op_work_package_id) WHERE op_work_package_id IS NOT NULL;
CREATE UNIQUE INDEX idx_entity_map_gh_issue ON sync.entity_map(github_issue_number) WHERE github_issue_number IS NOT NULL;
CREATE UNIQUE INDEX idx_entity_map_gsd ON sync.entity_map(gsd_path) WHERE gsd_path IS NOT NULL;
CREATE INDEX idx_entity_map_type ON sync.entity_map(entity_type);

CREATE TABLE sync.sync_log (
    id SERIAL PRIMARY KEY,
    workflow TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('op->gh','op->gsd','gh->op','gsd->op','reconcile')),
    entity_map_id INTEGER REFERENCES sync.entity_map(id),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_created ON sync.sync_log(created_at DESC);
CREATE INDEX idx_sync_log_workflow ON sync.sync_log(workflow);

-- Health check view
CREATE OR REPLACE VIEW sync.health AS
SELECT
    (SELECT MAX(created_at) FROM sync.sync_log WHERE workflow = 'reconcile') AS last_reconciliation,
    (SELECT COUNT(*) FROM sync.entity_map) AS entities_tracked,
    (SELECT COUNT(*) FROM sync.sync_log WHERE action = 'conflict_resolved' AND created_at > NOW() - INTERVAL '24 hours') AS conflicts_last_24h,
    (SELECT COUNT(*) FROM sync.sync_log WHERE action = 'error' AND created_at > NOW() - INTERVAL '24 hours') AS errors_last_24h;
