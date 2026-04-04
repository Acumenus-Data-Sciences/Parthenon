#!/usr/bin/env python3
"""Generate enterprise license keys for Acropolis.

Generates cryptographically secure license keys in ACRO-XXXX-XXXX-XXXX format,
inserts SHA-256 hashes into app.enterprise_licenses in host PG17,
and writes plaintext keys to a secure file for distribution.

Usage:
    python3 acropolis/scripts/generate_license_keys.py [--count 50] [--tier enterprise]
"""
from __future__ import annotations

import argparse
import hashlib
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

# Base32 alphabet minus ambiguous characters (0, O, 1, I, L)
KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

# Output file for plaintext keys (chmod 600)
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / ".enterprise-keys"


def generate_key() -> str:
    """Generate one license key in ACRO-XXXX-XXXX-XXXX format."""
    segments = []
    for _ in range(3):
        segment = "".join(secrets.choice(KEY_ALPHABET) for _ in range(4))
        segments.append(segment)
    return f"ACRO-{'-'.join(segments)}"


def hash_key(key: str) -> str:
    """SHA-256 hash a license key (normalized to uppercase)."""
    return hashlib.sha256(key.strip().upper().encode("utf-8")).hexdigest()


def get_db_connection(
    host: str = "localhost",
    port: int = 5432,
    dbname: str = "parthenon",
    user: str = "claude_dev",
) -> psycopg2.extensions.connection:
    """Connect to host PG17 using ~/.pgpass credentials."""
    return psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        options="-c search_path=app",
    )


def ensure_table(conn: psycopg2.extensions.connection) -> None:
    """Create the enterprise_licenses table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS app.enterprise_licenses (
                id              serial PRIMARY KEY,
                key_hash        char(64) NOT NULL UNIQUE,
                key_prefix      char(4) NOT NULL,
                tier            varchar(20) NOT NULL DEFAULT 'enterprise',
                org_name        varchar(255),
                activated_at    timestamptz,
                expires_at      timestamptz,
                created_at      timestamptz NOT NULL DEFAULT now()
            );

            COMMENT ON TABLE app.enterprise_licenses IS
                'Hashed enterprise license keys for Acropolis installer validation';
            COMMENT ON COLUMN app.enterprise_licenses.key_hash IS
                'SHA-256 hash of the plaintext license key';
            COMMENT ON COLUMN app.enterprise_licenses.key_prefix IS
                'Last 4 characters of plaintext key for support lookups';
        """)
    conn.commit()


def insert_keys(
    conn: psycopg2.extensions.connection,
    keys: list[str],
    tier: str,
) -> int:
    """Insert hashed keys into the database. Returns count inserted."""
    inserted = 0
    with conn.cursor() as cur:
        for key in keys:
            key_hashed = hash_key(key)
            key_prefix = key[-4:]  # last 4 chars of plaintext
            try:
                cur.execute(
                    """
                    INSERT INTO app.enterprise_licenses (key_hash, key_prefix, tier)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (key_hash) DO NOTHING
                    """,
                    (key_hashed, key_prefix, tier),
                )
                if cur.rowcount > 0:
                    inserted += 1
            except psycopg2.Error as e:
                print(f"Error inserting key ...{key_prefix}: {e}", file=sys.stderr)
    conn.commit()
    return inserted


def write_keys_file(keys: list[str], output_path: Path) -> None:
    """Write plaintext keys to a secure file (chmod 600)."""
    lines = [
        "# Acropolis Enterprise License Keys",
        f"# Generated: {datetime.now(timezone.utc).isoformat()}",
        f"# Count: {len(keys)}",
        "# CONFIDENTIAL — do not commit to version control",
        "#",
        "# Format: ACRO-XXXX-XXXX-XXXX",
        "# Distribute one key per customer/deployment.",
        "",
    ]
    for i, key in enumerate(keys, 1):
        lines.append(f"{i:3d}. {key}")

    output_path.write_text("\n".join(lines) + "\n")
    os.chmod(output_path, 0o600)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Acropolis enterprise license keys")
    parser.add_argument("--count", type=int, default=50, help="Number of keys to generate (default: 50)")
    parser.add_argument("--tier", default="enterprise", help="License tier (default: enterprise)")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output file for plaintext keys")
    parser.add_argument("--dry-run", action="store_true", help="Generate keys without DB insert")
    args = parser.parse_args()

    print(f"Generating {args.count} {args.tier} license keys...")

    # Generate unique keys
    keys: list[str] = []
    seen_hashes: set[str] = set()
    while len(keys) < args.count:
        key = generate_key()
        h = hash_key(key)
        if h not in seen_hashes:
            seen_hashes.add(h)
            keys.append(key)

    if args.dry_run:
        print("Dry run — skipping DB insert")
        for i, key in enumerate(keys, 1):
            print(f"  {i:3d}. {key}")
    else:
        print("Connecting to host PG17...")
        conn = get_db_connection()
        try:
            ensure_table(conn)
            inserted = insert_keys(conn, keys, args.tier)
            print(f"Inserted {inserted} keys into app.enterprise_licenses")
        finally:
            conn.close()

    # Write plaintext keys to secure file
    write_keys_file(keys, args.output)
    print(f"Plaintext keys written to {args.output} (chmod 600)")
    print("Done.")


if __name__ == "__main__":
    main()
