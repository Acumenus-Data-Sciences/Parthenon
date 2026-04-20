#!/usr/bin/env python3
"""Repair Orthanc storage UUID mismatches using hardlinks.

This is for the SQLite fallback case where an Orthanc index references attachment
UUIDs from one storage tree, while the mounted storage tree contains the same
files under different UUIDs from a reimport.

The script does not rewrite Orthanc's database and does not duplicate DICOM
bytes. It creates hardlinks at the paths the active index expects.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sqlite3
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path


SKIP_FILES = {"index", "index-shm", "index-wal", ".gitkeep"}

sys.stdout.reconfigure(line_buffering=True)


@dataclass(frozen=True)
class Attachment:
    public_id: str
    resource_type: int
    file_type: int
    uuid: str
    size: int
    md5: str


@dataclass(frozen=True)
class LinkPlan:
    attachment: Attachment
    source: Path
    target: Path
    reason: str


def storage_rel(uuid: str) -> Path:
    return Path(uuid[:2]) / uuid[2:4] / uuid


def md5_file(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def open_index(index_path: Path) -> sqlite3.Connection:
    uri = f"file:{index_path}?mode=ro&immutable=1"
    return sqlite3.connect(uri, uri=True)


def load_attachments(index_path: Path, study_id: str | None) -> list[Attachment]:
    with open_index(index_path) as conn:
        if study_id:
            rows = conn.execute(
                """
                select r.publicId, r.resourceType, a.fileType, a.uuid,
                       a.compressedSize, a.compressedMD5
                from AttachedFiles a
                join Resources r on r.internalId = a.id
                where r.internalId = (select internalId from Resources where publicId = ?)
                   or r.parentId = (select internalId from Resources where publicId = ?)
                   or r.parentId in (
                        select internalId from Resources
                        where parentId = (select internalId from Resources where publicId = ?)
                          and resourceType = 3
                   )
                order by r.resourceType, r.internalId, a.fileType
                """,
                (study_id, study_id, study_id),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                select r.publicId, r.resourceType, a.fileType, a.uuid,
                       a.compressedSize, a.compressedMD5
                from AttachedFiles a
                join Resources r on r.internalId = a.id
                order by r.resourceType, r.internalId, a.fileType
                """
            ).fetchall()

    return [
        Attachment(
            public_id=str(public_id),
            resource_type=int(resource_type),
            file_type=int(file_type),
            uuid=str(uuid),
            size=int(size),
            md5=str(md5),
        )
        for public_id, resource_type, file_type, uuid, size, md5 in rows
    ]


def walk_candidate_files(root: Path, needed_sizes: set[int]):
    for dirpath, _, filenames in os.walk(root):
        base = Path(dirpath)
        for name in filenames:
            if name in SKIP_FILES:
                continue
            path = base / name
            try:
                stat = path.stat()
            except FileNotFoundError:
                continue
            if stat.st_size in needed_sizes:
                yield path


def build_hash_sources(
    hash_roots: list[Path],
    needed_by_size: dict[int, set[str]],
    workers: int,
) -> dict[str, Path]:
    needed_hashes = {digest for digests in needed_by_size.values() for digest in digests}
    found: dict[str, Path] = {}
    candidates: list[Path] = []
    needed_sizes = set(needed_by_size)

    print(f"Scanning hash roots for {len(needed_hashes):,} missing content hashes...")
    started = time.time()
    last_report = started

    for root in hash_roots:
        for path in walk_candidate_files(root, needed_sizes):
            candidates.append(path)
            now = time.time()
            if now - last_report >= 30:
                print(f"  collected {len(candidates):,} candidate files...")
                last_report = now

    print(f"Hash candidates: {len(candidates):,}")

    def hash_candidate(path: Path) -> tuple[str, Path]:
        return md5_file(path), path

    hashed = 0
    last_report = time.time()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(hash_candidate, path) for path in candidates]
        for future in as_completed(futures):
            digest, path = future.result()
            hashed += 1
            if digest in needed_by_size.get(path.stat().st_size, set()) and digest not in found:
                found[digest] = path
            now = time.time()
            if now - last_report >= 30:
                print(
                    f"  hashed {hashed:,}/{len(candidates):,}; "
                    f"found {len(found):,}/{len(needed_hashes):,}"
                )
                last_report = now

    print(f"Hash matches found: {len(found):,}/{len(needed_hashes):,}")
    return found


def plan_links(
    attachments: list[Attachment],
    active_root: Path,
    exact_roots: list[Path],
    hash_roots: list[Path],
    workers: int,
) -> tuple[list[LinkPlan], list[Attachment], int]:
    already_ok = 0
    plans: list[LinkPlan] = []
    needs_hash: list[tuple[Attachment, Path]] = []

    for attachment in attachments:
        target = active_root / storage_rel(attachment.uuid)
        if target.is_file():
            already_ok += 1
            continue

        exact_source = None
        for root in exact_roots:
            candidate = root / storage_rel(attachment.uuid)
            if candidate.is_file():
                exact_source = candidate
                break

        if exact_source:
            plans.append(LinkPlan(attachment, exact_source, target, "exact"))
        else:
            needs_hash.append((attachment, target))

    needed_by_size: dict[int, set[str]] = defaultdict(set)
    for attachment, _ in needs_hash:
        needed_by_size[attachment.size].add(attachment.md5)

    hash_sources = build_hash_sources(hash_roots, needed_by_size, workers) if needs_hash else {}

    missing: list[Attachment] = []
    for attachment, target in needs_hash:
        source = hash_sources.get(attachment.md5)
        if source:
            plans.append(LinkPlan(attachment, source, target, "hash"))
        else:
            missing.append(attachment)

    return plans, missing, already_ok


def apply_links(plans: list[LinkPlan]) -> tuple[int, int]:
    linked = 0
    skipped = 0
    last_report = time.time()

    for index, plan in enumerate(plans, start=1):
        plan.target.parent.mkdir(parents=True, exist_ok=True)
        if plan.target.exists():
            skipped += 1
            continue
        os.link(plan.source, plan.target)
        linked += 1

        now = time.time()
        if now - last_report >= 30:
            print(f"  linked {index:,}/{len(plans):,} targets...")
            last_report = now

    return linked, skipped


def write_missing_report(path: Path, missing: list[Attachment]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        handle.write("public_id\tresource_type\tfile_type\tuuid\tsize\tmd5\n")
        for item in missing:
            handle.write(
                f"{item.public_id}\t{item.resource_type}\t{item.file_type}\t"
                f"{item.uuid}\t{item.size}\t{item.md5}\n"
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--active", default="/mnt/md0/orthanc-data-pg", help="Active Orthanc storage root")
    parser.add_argument("--index", default=None, help="SQLite index path; defaults to ACTIVE/index")
    parser.add_argument(
        "--exact-root",
        action="append",
        default=["/mnt/md0/orthanc-data"],
        help="Storage root to search by exact UUID path; can be repeated",
    )
    parser.add_argument(
        "--hash-root",
        action="append",
        default=None,
        help="Storage root to search by content hash; defaults to ACTIVE",
    )
    parser.add_argument("--study-id", default=None, help="Optional Orthanc study public ID to repair")
    parser.add_argument("--workers", type=int, default=8, help="Parallel MD5 workers")
    parser.add_argument("--apply", action="store_true", help="Create hardlinks")
    parser.add_argument(
        "--missing-report",
        default="/tmp/orthanc-hardlink-missing.tsv",
        help="Where to write unresolved attachment rows",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    active = Path(args.active)
    index = Path(args.index) if args.index else active / "index"
    exact_roots = [Path(root) for root in args.exact_root]
    hash_roots = [Path(root) for root in (args.hash_root or [str(active)])]

    if os.geteuid() != 0 and args.apply:
        print("Run with sudo/root for --apply; many reimported files are root-owned.", file=sys.stderr)
        return 2

    print(f"Active storage: {active}")
    print(f"SQLite index:   {index}")
    print(f"Exact roots:    {', '.join(map(str, exact_roots))}")
    print(f"Hash roots:     {', '.join(map(str, hash_roots))}")
    if args.study_id:
        print(f"Study scope:    {args.study_id}")
    print()

    attachments = load_attachments(index, args.study_id)
    print(f"Attachments in scope: {len(attachments):,}")

    plans, missing, already_ok = plan_links(
        attachments=attachments,
        active_root=active,
        exact_roots=exact_roots,
        hash_roots=hash_roots,
        workers=args.workers,
    )

    by_reason: dict[str, int] = defaultdict(int)
    for plan in plans:
        by_reason[plan.reason] += 1

    print()
    print(f"Already present: {already_ok:,}")
    print(f"Link plans:      {len(plans):,}")
    print(f"  exact UUID:    {by_reason['exact']:,}")
    print(f"  hash matched:  {by_reason['hash']:,}")
    print(f"Unresolved:      {len(missing):,}")

    missing_report = Path(args.missing_report)
    write_missing_report(missing_report, missing)
    print(f"Missing report:  {missing_report}")

    if not args.apply:
        print()
        print("Dry run only. Re-run with --apply to create hardlinks.")
        return 0

    print()
    print("Creating hardlinks...")
    linked, skipped = apply_links(plans)
    print(f"Linked:          {linked:,}")
    print(f"Skipped existing:{skipped:,}")
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
