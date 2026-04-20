#!/usr/bin/env python3
"""Precompute Orthanc DICOMweb series metadata cache for all studies.

The DICOMweb plugin can generate series metadata lazily, but large CT/MR studies
make OHIF users pay that cost during first view. This script calls Orthanc's
internal `/studies/{id}/update-dicomweb-cache` endpoint ahead of time and stores
progress in SQLite so it can resume after interruption.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


sys.stdout.reconfigure(line_buffering=True)


def build_auth_header(args: argparse.Namespace) -> str | None:
    if args.auth_header:
        return args.auth_header
    if args.username and args.password is not None:
        token = base64.b64encode(f"{args.username}:{args.password}".encode()).decode()
        return f"Basic {token}"
    return os.environ.get("ORTHANC_AUTH_HEADER")


def request_json(url: str, auth_header: str | None, timeout: int = 60):
    request = urllib.request.Request(url)
    if auth_header:
        request.add_header("Authorization", auth_header)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def post_empty(url: str, auth_header: str | None, timeout: int) -> tuple[int, str]:
    request = urllib.request.Request(url, method="POST", data=b"")
    if auth_header:
        request.add_header("Authorization", auth_header)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response.read()
            return response.status, ""
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        return exc.code, detail


def connect_state(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("pragma journal_mode=wal")
    conn.execute("pragma synchronous=normal")
    conn.execute(
        """
        create table if not exists studies (
            study_id text primary key,
            status text not null default 'pending',
            duration_seconds real,
            detail text,
            updated_at real not null
        )
        """
    )
    conn.execute("create index if not exists studies_status_idx on studies(status)")
    conn.commit()
    return conn


def record_studies(conn: sqlite3.Connection, study_ids: list[str]) -> None:
    now = time.time()
    conn.executemany(
        """
        insert or ignore into studies(study_id, status, updated_at)
        values (?, 'pending', ?)
        """,
        [(study_id, now) for study_id in study_ids],
    )
    conn.commit()


def pending_studies(conn: sqlite3.Connection, limit: int | None) -> list[str]:
    sql = "select study_id from studies where status != 'success' order by study_id"
    params: tuple[int, ...] = ()
    if limit:
        sql += " limit ?"
        params = (limit,)
    return [row[0] for row in conn.execute(sql, params)]


def update_result(
    conn: sqlite3.Connection,
    study_id: str,
    status: str,
    duration: float,
    detail: str,
) -> None:
    conn.execute(
        """
        update studies
        set status = ?, duration_seconds = ?, detail = ?, updated_at = ?
        where study_id = ?
        """,
        (status, duration, detail, time.time(), study_id),
    )
    conn.commit()


def prewarm_one(
    target: str,
    auth_header: str | None,
    study_id: str,
    timeout: int,
) -> tuple[str, str, float, str]:
    started = time.time()
    url = f"{target.rstrip('/')}/studies/{study_id}/update-dicomweb-cache"
    code, detail = post_empty(url, auth_header, timeout)
    duration = time.time() - started
    if code == 200:
        return study_id, "success", duration, ""
    return study_id, "failed", duration, f"HTTP {code}: {detail}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", default="http://127.0.0.1:8042")
    parser.add_argument(
        "--state",
        default="/mnt/md0/orthanc-rebuild/dicomweb-cache-prewarm.sqlite",
        help="SQLite progress database",
    )
    parser.add_argument("--auth-header", default=os.environ.get("ORTHANC_AUTH_HEADER"))
    parser.add_argument("--username", default=os.environ.get("ORTHANC_USER"))
    parser.add_argument("--password", default=os.environ.get("ORTHANC_PASSWORD"))
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--refresh-study-list", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    auth_header = build_auth_header(args)
    state_path = Path(args.state)
    conn = connect_state(state_path)

    known = conn.execute("select count(*) from studies").fetchone()[0]
    if known == 0 or args.refresh_study_list:
        print(f"Loading study list from {args.target}...")
        study_ids = request_json(f"{args.target.rstrip('/')}/studies", auth_header)
        record_studies(conn, study_ids)
        print(f"Recorded {len(study_ids):,} studies in {state_path}")

    pending = pending_studies(conn, args.limit)
    total = conn.execute("select count(*) from studies").fetchone()[0]
    completed = conn.execute(
        "select count(*) from studies where status = 'success'"
    ).fetchone()[0]
    print(f"State: {state_path}")
    print(f"Studies: {completed:,}/{total:,} already complete; {len(pending):,} pending")

    if not pending:
        return 0

    started = time.time()
    done = 0
    failures = 0
    last_report = started
    durations: list[float] = []

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [
            pool.submit(prewarm_one, args.target, auth_header, study_id, args.timeout)
            for study_id in pending
        ]
        for future in as_completed(futures):
            study_id, status, duration, detail = future.result()
            update_result(conn, study_id, status, duration, detail)
            done += 1
            durations.append(duration)
            if status != "success":
                failures += 1
                print(f"FAILED {study_id}: {detail}")

            now = time.time()
            if now - last_report >= 30:
                elapsed = now - started
                rate = done / max(elapsed, 1)
                avg_duration = sum(durations) / max(len(durations), 1)
                remaining = len(pending) - done
                eta = remaining / max(rate, 0.01)
                print(
                    f"  {done:,}/{len(pending):,} processed; "
                    f"{failures:,} failed; {rate:.2f} studies/sec; "
                    f"avg {avg_duration:.1f}s; ETA {eta / 3600:.1f}h"
                )
                last_report = now

    print()
    print(f"Processed: {done:,}")
    print(f"Failed:    {failures:,}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
