"""Loader for the OMOP Vocabulary (Athena ZIP)."""
from __future__ import annotations

import os
import subprocess
import shlex
from pathlib import Path

from rich.console import Console

from datasets.loaders import REPO_ROOT, _exec_php, _query_count


def _resolve_umls_api_key() -> str:
    env_value = os.environ.get("UMLS_API_KEY", "").strip()
    if env_value:
        return env_value

    env_file = REPO_ROOT / ".env"
    if not env_file.exists():
        return ""

    for raw_line in env_file.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "UMLS_API_KEY":
            return value.strip().strip('"').strip("'")
    return ""


def is_loaded() -> bool:
    """Return True if omop.concept contains at least one row."""
    return _query_count("SELECT COUNT(*) FROM omop.concept") > 0


def load(
    *,
    console: Console,
    downloads_dir: Path,
    zip_path: "Path | None" = None,
) -> bool:
    """Load OMOP Vocabulary from an Athena-downloaded ZIP.

    If *zip_path* is not provided the user is prompted for the file path.
    Typing ``skip`` at the prompt aborts without error.

    Steps:
    1. Prompt for ZIP path (if needed).
    2. Copy ZIP into the PHP container.
    3. Run ``parthenon:load-vocabularies`` with streaming output.
    4. Remove the copied ZIP from the container.
    """
    try:
        import questionary  # type: ignore[import-untyped]
    except ImportError:
        console.print(
            "[red]questionary is not installed.  "
            "Run: pip install questionary[/red]"
        )
        return False

    # ------------------------------------------------------------------
    # Resolve zip_path
    # ------------------------------------------------------------------
    if zip_path is None:
        answer = questionary.text(
            "Path to Athena vocabulary ZIP file (or 'skip' to abort):",
            validate=lambda v: (
                True
                if v.strip().lower() == "skip"
                else (
                    "File not found."
                    if not Path(v.strip()).expanduser().is_file()
                    else True
                )
            ),
        ).ask()

        if answer is None or answer.strip().lower() == "skip":
            console.print("[yellow]Vocabulary load skipped.[/yellow]")
            return False

        zip_path = Path(answer.strip()).expanduser().resolve()

    zip_path = Path(zip_path).expanduser().resolve()
    if not zip_path.is_file():
        console.print(f"[red]ZIP file not found: {zip_path}[/red]")
        return False

    umls_api_key = _resolve_umls_api_key()
    if not umls_api_key:
        console.print(
            "[red]UMLS_API_KEY is not configured. Vocabulary imports require a UMLS key "
            "for CPT-4 and related vocabulary workflows.[/red]"
        )
        return False

    # ------------------------------------------------------------------
    # Copy ZIP into container
    # ------------------------------------------------------------------
    container_zip = "/var/www/html/storage/app/vocab-import.zip"
    console.print(
        f"[cyan]Copying {zip_path.name} into PHP container…[/cyan]"
    )
    cp_args = shlex.split(
        f"docker compose cp {zip_path} php:{container_zip}"
    )
    try:
        subprocess.run(
            cp_args,
            cwd=str(REPO_ROOT),
            check=True,
            timeout=300,
        )
    except subprocess.CalledProcessError as exc:
        console.print(f"[red]Failed to copy ZIP into container: {exc}[/red]")
        return False
    except subprocess.TimeoutExpired:
        console.print("[red]Timed out copying ZIP into container.[/red]")
        return False

    # ------------------------------------------------------------------
    # Run artisan command
    # ------------------------------------------------------------------
    console.print("[bold cyan]Loading OMOP Vocabulary…[/bold cyan]")
    rc = _exec_php(
        f"php artisan parthenon:load-vocabularies "
        f"--zip={container_zip} --no-interaction",
        stream=True,
    )

    # ------------------------------------------------------------------
    # Clean up ZIP from container regardless of outcome
    # ------------------------------------------------------------------
    try:
        _exec_php(f"rm -f {container_zip}", check=False, stream=False)
    except Exception:
        pass  # best-effort cleanup

    if rc == 0:
        console.print("[green]✓[/green] OMOP Vocabulary loaded successfully.")
        return True
    console.print(f"[red]✗ Vocabulary load failed (exit code {rc}).[/red]")
    return False
