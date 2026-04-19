# Parthenon Installer GUI

Rust/Tauri desktop shell for the Parthenon Community installer.

This MVP keeps the existing Python installer as the source of installation
truth. The Rust app collects Community inputs, asks the Python installer
contract to normalize them, writes the resulting temporary defaults JSON, and
launches:

```bash
python3 install.py --defaults-file <generated.json> --non-interactive
```

and streams stdout/stderr back into the GUI.

Plan summary, dry run, validation, machine preflight, and OMOP data readiness
checks use the Python installer contract so the desktop shell does not
duplicate installer rules.

## Data Setup Direction

The next installer revision treats database setup as a first-class wizard path.
The user can choose:

- an existing database server that still needs OMOP CDM DDL and vocabulary work,
- an existing, already-prepared OMOP CDM, or
- a local PostgreSQL OMOP database managed by the installer.

The current UI captures those choices and sends them through the shared Python
contract as a plain-language setup plan. The readiness step now adds
non-destructive OMOP checks, including PostgreSQL probes when possible and clear
warnings for DBMSs that will route through the HADES DatabaseConnector helper.
The shared contract also exposes a versioned bundle manifest with file
checksums as the foundation for no-repo downloads. OMOP DDL installation,
Athena vocabulary import, and bundle download execution are tracked in
`docs/devlog/process/rust-installer-v2-bootstrapper-todo.md`.

## Run

```bash
cd installer/rust-gui
cargo run
```

Dry run is enabled by default in the UI. A real install requires clearing the
dry-run toggle and confirming that Docker services will be started.

Dry-run output is a plain-language install summary. The installer process still
receives the full generated defaults file during a real install.

## Verify

```bash
cargo fmt --check
cargo test
cargo test python_contract_ -- --ignored
cargo clippy --all-targets -- -D warnings
cargo build
```

The ignored `python_contract_` tests are intentional smoke tests: they invoke
the real Python installer contract from the repo checkout.

## Bundle

```bash
cargo install tauri-cli --version '^2' --locked
cargo tauri build
```

On Linux, the build emits `.deb`, `.rpm`, and `.AppImage` artifacts under
`target/release/bundle/`. Native release uploads still require signing,
reproducibility, and platform smoke tests before distribution.

GitHub Actions workflow `.github/workflows/build-rust-installer-gui.yml` builds
Linux x64, macOS Intel, macOS Apple Silicon, and Windows x64 packages. Run it
manually from Actions with the desired ref, or publish a GitHub release to
produce archived workflow artifacts named:

- `parthenon-installer-linux-x64`
- `parthenon-installer-macos-x64`
- `parthenon-installer-macos-arm64`
- `parthenon-installer-windows-x64`

## Linux Prerequisites

Tauri uses the system WebView stack on Linux. On Ubuntu/Debian hosts, install
the GTK/WebKit development packages before building:

```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

If `cargo check` fails on `pango.pc`, the GTK/Pango development packages are
not yet installed.

## Windows MVP Path

The installer remains Linux/Docker-oriented. On Windows, this app expects WSL 2:

- Docker Desktop with WSL integration enabled
- a Linux checkout path such as `/home/user/Parthenon`
- `python3`, Docker, and Docker Compose available inside that WSL distro

The Rust app launches `wsl.exe bash -lc ...` and writes the generated defaults
JSON inside the WSL command before calling the Python installer.
