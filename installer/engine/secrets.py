# installer/engine/secrets.py
from __future__ import annotations

import os
import stat
from pathlib import Path

import keyring
import keyring.errors

SERVICE_NAME = "parthenon-installer"


class SecretManager:
    """Stores and retrieves secrets via the OS keychain (keyring).

    Falls back to a plaintext file store in ~/.parthenon-secrets/ on
    headless systems where no keyring daemon is available (CI runners).
    """

    def __init__(self, fallback_dir: Path | None = None) -> None:
        self._fallback_dir = fallback_dir or (Path.home() / ".parthenon-secrets")
        self._use_keyring = self._probe_keyring()

    def _probe_keyring(self) -> bool:
        try:
            keyring.set_password(SERVICE_NAME, "__probe__", "1")
            keyring.delete_password(SERVICE_NAME, "__probe__")
            return True
        except Exception:
            return False

    def set(self, key: str, value: str) -> None:
        if self._use_keyring:
            keyring.set_password(SERVICE_NAME, key, value)
        else:
            self._fb_write(key, value)

    def get(self, key: str) -> str | None:
        if self._use_keyring:
            return keyring.get_password(SERVICE_NAME, key)
        return self._fb_read(key)

    def delete(self, key: str) -> None:
        if self._use_keyring:
            try:
                keyring.delete_password(SERVICE_NAME, key)
            except keyring.errors.PasswordDeleteError:
                pass
        else:
            (self._fallback_dir / key).unlink(missing_ok=True)

    def write_docker_secrets(self, keys: list[str], secrets_dir: Path) -> None:
        """Write each secret as a file in secrets_dir (chmod 600, dir chmod 700)."""
        secrets_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        for key in keys:
            value = self.get(key)
            if value is None:
                continue
            path = secrets_dir / key
            path.write_text(value)
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)

    def export_credentials_file(self, path: Path, keys: list[str]) -> None:
        """Write KEY=VALUE lines for each key to path (chmod 600)."""
        lines = [f"{k}={v}" for k in keys if (v := self.get(k)) is not None]
        path.write_text("\n".join(lines) + "\n")
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)

    def _fb_write(self, key: str, value: str) -> None:
        self._fallback_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        path = self._fallback_dir / key
        path.write_text(value)
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)

    def _fb_read(self, key: str) -> str | None:
        path = self._fallback_dir / key
        return path.read_text().strip() if path.exists() else None
