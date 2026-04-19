# Parthenon Installer

Python-based Rich TUI installer for guided Parthenon deployment.

## Usage

```bash
python3 install.py
```

Source bootstrap from a fresh host:

```bash
curl -fsSL https://parthenon.acumenus.net/install.sh | sh
```

Pinned source bootstrap:

```bash
curl -fsSL https://parthenon.acumenus.net/install.sh | sh -s -- --version v1.0.6
```

Desktop launcher:

```bash
python3 clickme.py
```

## Release Packaging Policy

GitHub Actions may publish temporary workflow artifacts for the Rust GUI
packages and the source-backed Community bootstrap bundle. Do not attach
PyInstaller, Cosmopolitan, Rust GUI, `.deb`, `.snap`, Winget, or checksum assets
as GitHub Release assets until those installers are signed, reproducible, and
covered by install smoke tests. The supported remote install path remains
`installer/install.sh`, which obtains the requested source ref and runs the
in-repo Python installer.

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

Community MVP install:

```bash
python3 install.py --community
```

The Community MVP path enables Eunomia, the OHDSI Phenotype Library, Solr,
Hecate, and Qdrant. Hecate requires both `output/hecate-bootstrap` files and
prepared Qdrant storage. On a machine where Hecate already works, package those
assets for release:

```bash
scripts/package-hecate-bootstrap.py
```

Installers can consume that bundle with either:

- `PARTHENON_HECATE_BOOTSTRAP_URL`
- `PARTHENON_HECATE_BOOTSTRAP_ARCHIVE`
- `PARTHENON_HECATE_BOOTSTRAP_SHA256` for optional checksum verification

Desktop packaging experiments can remain local, but they are not release
assets until they satisfy the packaging policy above.

## Shared Contract

Installer shells should use the Python contract instead of reimplementing
installer rules:

```bash
python3 install.py --contract defaults --community --contract-redact
python3 install.py --contract validate --community --contract-redact
python3 install.py --contract plan --community --contract-redact
python3 install.py --contract preflight --community --contract-redact
python3 install.py --contract data-check --community --contract-redact
python3 install.py --contract bundle-manifest --community --contract-redact
```

`bundle-manifest` expands `installer/installer_manifest.json` into the current
file list, sizes, SHA-256 hashes, validation results, and bundle digest. It is
the source of truth for the Rust app's no-repo bootstrapper work.

Create and verify the Community runtime installer bundle artifact with:

```bash
python3 -m installer.bundle_manifest --validate --bundle-dir dist/installer-bundle
mkdir -p /tmp/parthenon-installer-bundle-check
tar -xzf dist/installer-bundle/parthenon-community-bootstrap-*.tar.gz \
  -C /tmp/parthenon-installer-bundle-check
python3 -m installer.bundle_manifest \
  --manifest /tmp/parthenon-installer-bundle-check/installer-bundle-manifest.json \
  --repo-root /tmp/parthenon-installer-bundle-check \
  --validate
```

The Rust desktop installer can consume the resulting `.tar.gz` from a local
path or URL, verify it, and run the Python installer from the extracted bundle.
Bundle-based installs set `PARTHENON_RUNTIME_PROFILE=community-release`, which
selects `docker-compose.community.yml` and uses prebuilt Community runtime
images instead of backend/frontend source bind mounts.

## Modules

- `bootstrap.py`
- `bundle_manifest.py`
- `cli.py`
- `config.py`
- `contract.py`
- `data_probe.py`
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
