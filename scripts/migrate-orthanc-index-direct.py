#!/usr/bin/env python3
"""Direct SQLite → PostgreSQL index migration for Orthanc.

Streams rows from the SQLite index directly into PostgreSQL using COPY.
No DICOM file I/O — only index metadata is migrated.

Usage:
    python3 scripts/migrate-orthanc-index-direct.py
"""

import base64
import io
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.request

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Tables in dependency order
TABLES = [
    "Resources",
    "AttachedFiles",
    "MainDicomTags",
    "DicomIdentifiers",
    "Metadata",
    "Changes",
    "ExportedResources",
    "Labels",
    "GlobalProperties",
    "GlobalIntegers",
]

# SQLite → PG column name mappings (where they differ)
COLUMN_MAP = {
    "attachedfiles": {
        "uncompressedmd5": "uncompressedhash",
        "compressedmd5": "compressedhash",
    },
}

# Tables to skip entirely (PG manages these itself)
SKIP_TABLES = {"GlobalProperties", "GlobalIntegers"}

# Extra PG columns not in SQLite (will be set to NULL)
EXTRA_PG_COLUMNS = {
    "resources": ["childcount"],
}

PG_HOST = os.environ.get("DB_HOST", "pgsql.acumenus.net")
PG_PORT = os.environ.get("DB_PORT", "5432")
PG_DB = os.environ.get("DB_DATABASE", "parthenon")
PG_USER = os.environ.get("DB_USERNAME", "smudoshi")
PG_PASS = os.environ.get("DB_PASSWORD", "acumenus")
SQLITE_PATH = "/media/smudoshi/DATA/orthanc-data/index"


def pg_env():
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASS
    return env


def psql(sql: str):
    return subprocess.run(
        ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", PG_DB, "-q", "-c", sql],
        capture_output=True, text=True, env=pg_env(),
    )


def migrate_table(conn: sqlite3.Connection, table: str) -> int:
    """Stream a SQLite table into PG via psql COPY. Returns row count."""
    pg_table = table.lower()

    # Get columns from SQLite and map to PG names
    cursor = conn.execute(f"PRAGMA table_info({table})")
    sqlite_columns = [row[1].lower() for row in cursor.fetchall()]

    if not sqlite_columns:
        return 0

    mapping = COLUMN_MAP.get(pg_table, {})
    columns = [mapping.get(c, c) for c in sqlite_columns]

    # Add extra PG-only columns (will append NULL values)
    extra_cols = EXTRA_PG_COLUMNS.get(pg_table, [])
    columns.extend(extra_cols)

    col_list = ", ".join(columns)
    copy_cmd = f"\\copy public.{pg_table} ({col_list}) FROM STDIN WITH (FORMAT csv, NULL '\\N', QUOTE '\"')"

    # Use a pipe to stream data
    proc = subprocess.Popen(
        ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", PG_DB, "-q", "-c", copy_cmd],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, env=pg_env(),
    )

    row_count = 0
    cursor = conn.execute(f"SELECT * FROM {table}")

    for row in cursor:
        values = []
        for v in row:
            if v is None:
                values.append("\\N")
            elif isinstance(v, str):
                values.append('"' + v.replace('"', '""').replace('\n', '\\n').replace('\r', '\\r') + '"')
            elif isinstance(v, bytes):
                values.append('"\\\\x' + v.hex() + '"')
            else:
                values.append(str(v))
        # Append NULLs for extra PG-only columns
        for _ in extra_cols:
            values.append("\\N")

        try:
            proc.stdin.write(",".join(values) + "\n")
        except BrokenPipeError:
            _, stderr = proc.communicate()
            print(f"    ✗ Broken pipe for {table} at row {row_count}: {stderr.strip()[:300]}")
            return -1
        row_count += 1

        if row_count % 100000 == 0:
            print(f"      ... {row_count:,} rows streamed")

    try:
        proc.stdin.close()
    except BrokenPipeError:
        pass
    proc.wait()
    stderr = proc.stderr.read()

    if proc.returncode != 0:
        print(f"    ✗ COPY failed for {table}: {stderr.strip()[:300]}")
        return -1

    return row_count


def main():
    print()
    print("=" * 60)
    print("  Orthanc SQLite → PostgreSQL Direct Index Migration")
    print("=" * 60)
    print()

    if not os.path.exists(SQLITE_PATH):
        print(f"  ✗ SQLite index not found: {SQLITE_PATH}")
        sys.exit(1)

    size_mb = os.path.getsize(SQLITE_PATH) / (1024 * 1024)
    print(f"  ✓ SQLite index: {SQLITE_PATH} ({size_mb:.0f} MB)")

    # Quick resource count (just the top-level count, not per-table)
    conn = sqlite3.connect(f"file:{SQLITE_PATH}?mode=ro", uri=True)
    quick_count = conn.execute("SELECT count(*) FROM Resources WHERE resourceType = 3").fetchone()[0]
    print(f"  ✓ Instance count (from Resources): ~{quick_count:,}")

    # Check for resume mode — skip already-loaded tables
    resume_mode = False
    loaded_tables = set()
    for table in TABLES:
        r = psql(f"SELECT count(*) FROM public.{table.lower()};")
        try:
            cnt = int(r.stdout.strip().split("\n")[2].strip())
            if cnt > 0:
                loaded_tables.add(table)
        except (IndexError, ValueError):
            pass

    if loaded_tables:
        resume_mode = True
        print(f"\n  ⚡ Resume mode — already loaded: {', '.join(loaded_tables)}")
        print(f"     Remaining: {', '.join(t for t in TABLES if t not in loaded_tables)}")

    print()
    if resume_mode:
        print("  Will STOP Orthanc, load remaining tables, and RESTART.")
    print()

    start_time = time.time()

    # Step 1: Stop Orthanc
    print("  [1/6] Stopping Orthanc...")
    subprocess.run(["docker", "compose", "stop", "orthanc"], capture_output=True)
    print("  ✓ Orthanc stopped")

    # Step 2: Truncate PG tables (skip already-loaded in resume mode)
    if not resume_mode:
        print("  [2/6] Truncating PG index tables...")
        skip_lower = {t.lower() for t in SKIP_TABLES}
        all_pg_tables = [t.lower() for t in reversed(TABLES) if t not in SKIP_TABLES] + ["invalidchildcounts", "globalintegerschanges", "auditlogs"]
        for t in all_pg_tables:
            r = psql(f"TRUNCATE TABLE public.{t} CASCADE;")
            if r.returncode != 0 and "does not exist" not in r.stderr:
                print(f"    ⚠ {t}: {r.stderr.strip()[:100]}")
        print("  ✓ Tables truncated")
    else:
        print("  [2/6] Skipping truncate (resume mode)")

    # Step 3: Disable triggers
    print("  [3/6] Disabling triggers...")
    for t in [t.lower() for t in TABLES]:
        psql(f"ALTER TABLE public.{t} DISABLE TRIGGER ALL;")
    print("  ✓ Triggers disabled")

    # Step 4: Bulk migrate each table
    print("  [4/6] Migrating tables...")
    print()
    total_rows = 0
    for table in TABLES:
        if table in SKIP_TABLES:
            print(f"    {table}... skipped (PG-managed)")
            continue
        if resume_mode and table in loaded_tables:
            print(f"    {table}... skipped (already loaded)")
            continue
        t0 = time.time()
        print(f"    {table}...", end=" ")

        count = migrate_table(conn, table)
        elapsed = time.time() - t0

        if count >= 0:
            rate = count / max(elapsed, 0.01)
            print(f"{count:,} rows ({elapsed:.1f}s, {rate:,.0f}/s)")
            total_rows += count
        else:
            print("FAILED")

    print(f"\n    Total: {total_rows:,} rows")

    # Step 5: Re-enable triggers and reset sequences
    print("\n  [5/6] Re-enabling triggers and resetting sequences...")
    for t in [t.lower() for t in TABLES]:
        psql(f"ALTER TABLE public.{t} ENABLE TRIGGER ALL;")

    psql("SELECT setval('resources_internalid_seq', (SELECT COALESCE(MAX(internalid), 0) + 1 FROM public.resources));")
    psql("SELECT setval('changes_seq_seq', (SELECT COALESCE(MAX(seq), 0) + 1 FROM public.changes));")
    print("  ✓ Done")

    # Step 6: Restart Orthanc
    print("  [6/6] Starting Orthanc...")
    subprocess.run(["docker", "compose", "up", "-d", "orthanc"], capture_output=True)

    print("  → Waiting for healthy...")
    for _ in range(30):
        r = subprocess.run(
            ["docker", "compose", "ps", "orthanc", "--format", "{{.Status}}"],
            capture_output=True, text=True,
        )
        if "healthy" in r.stdout:
            break
        time.sleep(3)

    conn.close()
    total_elapsed = time.time() - start_time

    # Verify via REST API
    try:
        user = os.environ.get("ORTHANC_USER", "parthenon")
        passwd = os.environ.get("ORTHANC_PASSWORD", "")
        auth = "Basic " + base64.b64encode(f"{user}:{passwd}".encode()).decode()
        req = urllib.request.Request("http://localhost:8042/statistics", headers={"Authorization": auth})
        with urllib.request.urlopen(req, timeout=30) as resp:
            stats = json.loads(resp.read())

        print()
        print("=" * 60)
        print(f"  Patients:   {stats['CountPatients']:,}")
        print(f"  Studies:    {stats['CountStudies']:,}")
        print(f"  Series:     {stats['CountSeries']:,}")
        print(f"  Instances:  {stats['CountInstances']:,}")
        print(f"  Disk:       {stats['TotalDiskSizeMB']:,} MB")
        print(f"  Duration:   {total_elapsed:.0f}s ({total_elapsed/60:.1f} min)")
        print("=" * 60)
    except Exception as e:
        print(f"\n  ⚠ Verify manually: curl -u $ORTHANC_USER:$ORTHANC_PASSWORD http://localhost:8042/statistics")
        print(f"    Error: {e}")

    print(f"\n  ✓ Migration complete! Duration: {total_elapsed/60:.1f} minutes")
    print(f"    SQLite index preserved at: {SQLITE_PATH}")


if __name__ == "__main__":
    main()
