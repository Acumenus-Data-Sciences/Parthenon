# Parthenon Ingestion Templates — Phase 3, Plan 0: `sql_node` `sql_file://` Reader

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the deferred Phase 0 follow-up — `sql_node` learns to read SQL bodies from `sql_file://manifests/<id>/sql/<filename>.sql` references with `${parameters.*}` expansion (Phase 3 spec Q10 = b). This unblocks the testcontainers E2Es from Phase 2 Plan 4 (MIMIC-IV ETL) and Plan 5 (ARTEMIS), both of which were merged with their full E2E gated until this reader landed.

**Architecture:** Today `sql_node` accepts a literal `sql:` body in the manifest. We add a second source mode: when `params.sql_file` is set (e.g. `sql_file: sql_file://sql/00_bootstrap.sql`), the runner resolves the path relative to the manifest directory, reads the file, expands `${parameters.cdm_schema}`-style placeholders against the run's parameter dict, and executes the result. Both modes coexist; precedence is `sql_file > sql` (loud error if both are set).

**Tech Stack:** Python 3.12, Phase 0 + 1 + 2 toolchain. No new deps.

**Depends on:** Phase 0 `sql_node` (`templates/runtime/nodes/sql_node.py`) and the Phase 0 `runtime/registry/manifest.py` JSON-Schema validator.

**Unblocks:**
- Phase 2 Plan 4 — `tests/e2e/test_load_mimic_iv_omop.py::test_full_pipeline_against_synthetic_postgres` (currently `pytest.skip`).
- Phase 2 Plan 5 — `tests/e2e/test_artemis_chemo_regimens.py::test_full_pipeline_against_synthetic_postgres` (same skip).
- Phase 3 Plans 1–7 manifests reference `sql_file://` for any non-trivial multi-statement SQL.

---

## Conventions used throughout this plan

- **Working directory** for all `uv run` commands: `/home/smudoshi/Github/Parthenon/templates`.
- **Working directory** for all `git` commands: `/home/smudoshi/Github/Parthenon`.
- **All Python tests** use `pytest` with `pytest-asyncio` (mode `auto`).
- **All code must pass** `ruff check`, `black --check --line-length 100`, and `mypy --strict` against `templates/runtime/` before commit.
- **Branch model:** sequential commits on `feature/phase-3-plan-0-sql-file-reader`.
- **Type names:** `SqlFileReadError`, `SqlFileReference`, `SqlFileResolver`.

---

## Task index (6 tasks)

1. JSON Schema — allow `sql_file` alongside `sql` in `sql_node` params
2. `SqlFileReference` Pydantic model + `SqlFileResolver` core
3. `sql_node` consumer wiring — `sql_file > sql` precedence + error on both
4. `${parameters.*}` expansion (re-using existing parameter substitution)
5. Activate Plan 4 + Plan 5 E2E (un-skip + run testcontainers)
6. ADR 0015 — `sql_file://` reader scope and security posture

---

## Task 1: JSON Schema allows `sql_file`

**Files:**
- Modify: `templates/runtime/registry/schema/template.v1.json`
- Modify: `templates/tests/unit/test_manifest_schema.py`

- [ ] **Step 1 — failing test:**

```python
def test_sql_node_accepts_sql_file_param() -> None:
    schema = _load_schema()
    sql_node = next(n for n in schema["...nodes..."] if n["type"] == "sql")
    # Must accept either sql or sql_file
    assert "sql_file" in sql_node["properties"]["params"]["properties"]
```

- [ ] **Steps 2–5:** Add `sql_file` (string, pattern `^sql_file://`) to the `sql` node's `params` allowed properties. Either `sql` or `sql_file` is required (oneOf). **Commit:** `feat(templates): sql_node manifest schema allows sql_file:// references`.

---

## Task 2: `SqlFileResolver` core

**Files:**
- Create: `templates/runtime/sql_files/__init__.py`
- Create: `templates/runtime/sql_files/resolver.py`
- Create: `templates/runtime/sql_files/exceptions.py`
- Create: `templates/tests/unit/test_sql_file_resolver.py`

- [ ] **Step 1 — failing test:**

```python
def test_resolver_reads_relative_path(tmp_path: Path) -> None:
    sql = tmp_path / "manifests" / "demo" / "sql" / "00_bootstrap.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text("SELECT 1;", encoding="utf-8")

    resolver = SqlFileResolver(manifest_dir=sql.parent.parent)
    body = resolver.resolve("sql_file://sql/00_bootstrap.sql", parameters={})
    assert body == "SELECT 1;"


def test_resolver_expands_parameters(tmp_path: Path) -> None:
    sql = tmp_path / "sql" / "01.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text("CREATE SCHEMA ${parameters.cdm_schema};", encoding="utf-8")

    resolver = SqlFileResolver(manifest_dir=tmp_path)
    body = resolver.resolve("sql_file://sql/01.sql", parameters={"cdm_schema": "omop"})
    assert "CREATE SCHEMA omop;" == body


def test_resolver_rejects_path_traversal(tmp_path: Path) -> None:
    resolver = SqlFileResolver(manifest_dir=tmp_path)
    with pytest.raises(SqlFileReadError):
        resolver.resolve("sql_file://../../../etc/passwd", parameters={})
```

- [ ] **Steps 2–5:** Implement `SqlFileResolver` with:
  - URI parsing: strip `sql_file://`, treat the rest as a relative path under `manifest_dir`.
  - Security: `(manifest_dir / rel).resolve()` must remain inside `manifest_dir` (no `..` escape, no absolute paths). Raise `SqlFileReadError` on violation.
  - Parameter expansion: reuse the existing `${parameters.X}` substitution helper from `runtime/registry/manifest.py` (or extract it if not already a function).
  - Read file as UTF-8; raise `SqlFileReadError` on `FileNotFoundError`/`PermissionError`.

**Commit:** `feat(templates): SqlFileResolver core with parameter expansion + traversal guard`.

---

## Task 3: `sql_node` consumer wiring

**Files:**
- Modify: `templates/runtime/nodes/sql_node.py`
- Modify: `templates/tests/unit/test_sql_node.py`
- Modify: `templates/tests/integration/test_sql_node_with_files.py` (NEW)

- [ ] **Step 1 — failing test:**

```python
def test_sql_node_executes_sql_file(tmp_path: Path) -> None:
    sql = tmp_path / "sql" / "init.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text("CREATE TABLE t (id INT);", encoding="utf-8")

    node = SqlNode()
    ctx = NodeContext(run_id="r1", node_id="n1", manifest_dir=tmp_path, ...)
    result = node.run(ctx, {"sql_file": "sql_file://sql/init.sql", "cdm_schema": "omop"})
    assert result.status == NodeStatus.SUCCESS


def test_sql_node_rejects_both_sql_and_sql_file() -> None:
    node = SqlNode()
    result = node.run(_ctx(), {"sql": "SELECT 1;", "sql_file": "sql_file://x.sql"})
    assert result.status == NodeStatus.FAILED
    assert "exactly one of" in (result.error_message or "").lower()
```

- [ ] **Steps 2–5:** Branch in `SqlNode.run`:
  - If `params.sql_file` is set and `params.sql` is set → fail with clear error.
  - If `params.sql_file` → use `SqlFileResolver(manifest_dir=ctx.manifest_dir).resolve(...)`.
  - Else → existing `params.sql` path.

  `NodeContext` must already carry `manifest_dir`; if not, plumb it through. **Commit:** `feat(templates): sql_node accepts sql_file:// with parameter expansion`.

---

## Task 4: Parameter expansion shared helper

**Files:**
- Modify: `templates/runtime/registry/manifest.py` (extract `_expand_parameters` helper if inlined)
- Modify: `templates/runtime/sql_files/resolver.py` (use the shared helper)
- Modify: `templates/tests/unit/test_manifest.py` (assert helper is exported)

- [ ] **Step 1 — failing test:** Assert the helper produces identical output to whatever inline expansion code currently lives in the manifest loader for a known fixture.

- [ ] **Steps 2–5:** If the existing code is inline, extract to `templates/runtime/registry/parameters.py::expand`. Both consumers import the same function. **Commit:** `refactor(templates): extract parameter expansion helper, reuse in sql_file resolver`.

---

## Task 5: Activate Phase 2 Plan 4 + Plan 5 E2E

**Files:**
- Modify: `templates/tests/e2e/test_load_mimic_iv_omop.py` (un-skip)
- Modify: `templates/tests/e2e/test_artemis_chemo_regimens.py` (un-skip + add testcontainers full path)
- Modify: `templates/manifests/load_mimic_iv_omop/manifest.yaml` (use `sql_file://` for the bootstrap stages if not already)
- Modify: `templates/manifests/artemis_chemo_regimens/manifest.yaml` (use `sql_file://` for the episode bootstrap)

- [ ] **Step 1 — failing test:** Un-skip the testcontainers E2Es. They will fail because the manifests reference `sql_file://` paths that the runner couldn't resolve (now they can).

- [ ] **Steps 2–5:** Verify the manifests already reference `sql_file://` (Phase 2 plans wrote them that way; the gating note in those plans confirms this). Run the un-skipped E2Es locally against testcontainers Postgres. Both must pass within their existing acceptance windows (±2% MIMIC, ≥80% recall ARTEMIS). **Commit:** `test(templates): activate Plan 4 + Plan 5 testcontainers E2Es via sql_file reader`.

---

## Task 6: ADR 0015

**Files:**
- Create: `docs/architecture/adr-0015-sql-file-reader.md`

ADR records:
- **Context:** Phase 2 Plan 4 + 5 manifests need multi-stage SQL bootstrap files; inline `sql:` blocks are unwieldy beyond ~50 lines and lose syntax highlighting.
- **Decision:** Add `sql_file://` resolution to `sql_node` per Phase 3 Q10 = (b). Resolution is relative-only, traversal-guarded, and inherits `${parameters.*}` expansion from the manifest loader.
- **Consequences:** Manifests ship SQL alongside YAML; future `claims_to_omop`, `registry_to_omop`, `lis_lab_to_omop` templates depend on this reader. Phase 4 can layer on-disk caching if profiling shows repeated reads matter.
- **Alternatives considered:** Heredoc-style YAML multi-line strings (loses linting); separate `parthenon-sql` build step (over-engineered).
- **Open follow-ups:** SQL caching for re-runs (Phase 4); per-file `cdm_version` gating; a `sql_lint` pre-commit hook.

**Commit:** `docs(adr): ADR 0015 — sql_file:// reader scope and security posture`.

---

## Done

After Task 6 lands, Plan 0 is complete. The `sql_file://` reader unblocks every downstream Phase 3 plan, and Phase 2's Plan 4 + Plan 5 testcontainers E2Es run end-to-end for the first time.
