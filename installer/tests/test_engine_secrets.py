# installer/tests/test_engine_secrets.py
from __future__ import annotations
import os
import stat
from pathlib import Path
import pytest
import keyring
from keyring.backend import KeyringBackend
from installer.engine.secrets import SecretManager, SERVICE_NAME


class MemoryKeyring(KeyringBackend):
    """Simple in-memory keyring for testing."""

    priority = 1

    def __init__(self) -> None:
        self._storage: dict[str, dict[str, str]] = {}

    def set_password(self, service: str, username: str, password: str) -> None:
        if service not in self._storage:
            self._storage[service] = {}
        self._storage[service][username] = password

    def get_password(self, service: str, username: str) -> str | None:
        return self._storage.get(service, {}).get(username)

    def delete_password(self, service: str, username: str) -> None:
        if service in self._storage and username in self._storage[service]:
            del self._storage[service][username]


@pytest.fixture(autouse=True)
def memory_keyring_fixture():
    """Use in-memory keyring for all tests — no system keychain interaction."""
    keyring.set_keyring(MemoryKeyring())
    yield


@pytest.fixture
def mgr(tmp_path: Path) -> SecretManager:
    return SecretManager(fallback_dir=tmp_path / "fallback")


def test_set_and_get_roundtrip(mgr: SecretManager):
    mgr.set("DB_PASSWORD", "supersecret")
    assert mgr.get("DB_PASSWORD") == "supersecret"


def test_get_missing_key_returns_none(mgr: SecretManager):
    assert mgr.get("NONEXISTENT") is None


def test_delete_removes_key(mgr: SecretManager):
    mgr.set("APP_KEY", "base64:abc123")
    mgr.delete("APP_KEY")
    assert mgr.get("APP_KEY") is None


def test_write_docker_secrets_creates_files(mgr: SecretManager, tmp_path: Path):
    mgr.set("DB_PASSWORD", "dbpass")
    mgr.set("REDIS_PASSWORD", "redispass")
    secrets_dir = tmp_path / ".secrets"
    mgr.write_docker_secrets(["DB_PASSWORD", "REDIS_PASSWORD"], secrets_dir)
    db_file = secrets_dir / "DB_PASSWORD"
    assert db_file.exists()
    assert db_file.read_text() == "dbpass"
    mode = oct(stat.S_IMODE(db_file.stat().st_mode))
    assert mode == "0o600"


def test_write_docker_secrets_creates_dir_chmod_700(mgr: SecretManager, tmp_path: Path):
    mgr.set("DB_PASSWORD", "dbpass")
    secrets_dir = tmp_path / ".secrets"
    mgr.write_docker_secrets(["DB_PASSWORD"], secrets_dir)
    assert secrets_dir.is_dir()
    mode = oct(stat.S_IMODE(secrets_dir.stat().st_mode))
    assert mode == "0o700"


def test_write_docker_secrets_skips_missing_keys(mgr: SecretManager, tmp_path: Path):
    mgr.set("DB_PASSWORD", "dbpass")
    secrets_dir = tmp_path / ".secrets"
    mgr.write_docker_secrets(["DB_PASSWORD", "NONEXISTENT"], secrets_dir)
    assert (secrets_dir / "DB_PASSWORD").exists()
    assert not (secrets_dir / "NONEXISTENT").exists()


def test_export_credentials_file(mgr: SecretManager, tmp_path: Path):
    mgr.set("DB_PASSWORD", "dbpass")
    mgr.set("ADMIN_PASSWORD", "adminpass")
    out = tmp_path / ".install-credentials"
    mgr.export_credentials_file(out, ["DB_PASSWORD", "ADMIN_PASSWORD"])
    content = out.read_text()
    assert "DB_PASSWORD=dbpass" in content
    assert "ADMIN_PASSWORD=adminpass" in content
    mode = oct(stat.S_IMODE(out.stat().st_mode))
    assert mode == "0o600"
