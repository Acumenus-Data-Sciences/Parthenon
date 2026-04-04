"""Enterprise license key validation against app.enterprise_licenses in host PG17.

Shared by both the Parthenon installer (installer/config.py) and
the Acropolis installer (acropolis/installer/editions.py).

Keys use the format ACRO-XXXX-XXXX-XXXX (base32, no ambiguous chars).
The database stores SHA-256 hashes only — plaintext keys are never persisted.
"""
from __future__ import annotations

import hashlib
import re

LICENSE_PATTERN = re.compile(r"^ACRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")


def validate_format(key: str) -> bool:
    """Check if a key matches the ACRO-XXXX-XXXX-XXXX format."""
    return bool(LICENSE_PATTERN.match(key.strip().upper()))


def hash_key(key: str) -> str:
    """SHA-256 hash a license key (normalized to uppercase)."""
    return hashlib.sha256(key.strip().upper().encode("utf-8")).hexdigest()


def validate_against_db(
    key: str,
    *,
    db_host: str = "localhost",
    db_port: int = 5432,
    db_name: str = "parthenon",
    db_user: str = "claude_dev",
) -> tuple[bool, str]:
    """Validate a license key against app.enterprise_licenses.

    Returns (valid, message) where message explains the result.
    On success, marks the key as activated if not already.
    Falls back to format-only validation if DB is unreachable.
    """
    if not validate_format(key):
        return False, "Invalid license key format. Expected: ACRO-XXXX-XXXX-XXXX"

    try:
        import psycopg2
    except ImportError:
        return True, "License format valid (DB validation skipped — psycopg2 not installed)"

    key_hashed = hash_key(key.strip().upper())
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            options="-c search_path=app",
        )
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, activated_at FROM app.enterprise_licenses WHERE key_hash = %s",
                    (key_hashed,),
                )
                row = cur.fetchone()
                if row is None:
                    return False, "License key not recognized. Contact support."

                license_id, activated_at = row
                if activated_at is not None:
                    # Already activated — allow reuse (reinstall scenario)
                    return True, "License key validated (previously activated)"

                # Mark as activated
                cur.execute(
                    "UPDATE app.enterprise_licenses SET activated_at = now() WHERE id = %s AND activated_at IS NULL",
                    (license_id,),
                )
            conn.commit()
            return True, "License key validated and activated"
        finally:
            conn.close()
    except Exception as exc:
        # DB unreachable — fail open with format-only
        return True, f"License format valid (DB check skipped: {exc})"
