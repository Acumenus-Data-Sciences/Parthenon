# Parthenon Installer

Python-based Rich TUI installer for guided Parthenon deployment.

## Usage

```bash
python3 install.py
```

Desktop launcher:

```bash
python3 clickme.py
```

The browser-based installer now begins with a required onboarding gate:

- `Beginner` or `Experienced` OHDSI/OMOP user
- `UMLS Key` for vocabulary-import workflows

Edition rules:

- `Beginner` users are routed to `Community Edition`
- `Experienced` users can choose `Community Edition` or `Enterprise Edition`
- `Enterprise Edition` requires an `Enterprise Key`

Windows launcher notes:

- The GUI can run on Windows and hand off installation to WSL via `wsl.exe`.
- On Windows, provide either:
  - a Windows checkout path in `Parthenon repo path`, or
  - a direct Linux path in `WSL repo path`
- Optional environment overrides:
  - `PARTHENON_REPO_PATH`
  - `PARTHENON_WSL_DISTRO`
  - `PARTHENON_WSL_REPO_PATH`

Headless install from a pre-seeded config:

```bash
python3 install.py --defaults-file my-config.json --non-interactive
```

Useful `defaults-file` fields for headless installs:

- `experience`
- `edition`
- `enterprise_key`
- `umls_api_key`
- `vocab_zip_path`

Build desktop artifacts with PyInstaller:

```bash
python3 -m venv .venv-packaging
. .venv-packaging/bin/activate
python -m pip install pyinstaller rich questionary
python scripts/build_clickme.py --clean
```

On Linux, the built launcher is written to:

```bash
dist/ParthenonInstaller
```

## Modules

- `bootstrap.py`
- `cli.py`
- `config.py`
- `demo_data.py`
- `docker_ops.py`
- `etl_mbu_patient.py`
- `eunomia.py`
- `preflight.py`
- `utils.py`

## What It Does

1. **Preflight checks** — Docker, Docker Compose, ports, disk space
2. **Environment setup** — generates `.env` files with secure defaults, including `UMLS_API_KEY`
3. **Container orchestration** — builds and starts all Docker services
4. **Database initialization** — runs migrations, seeds admin user
5. **Health verification** — waits for all services to report healthy
