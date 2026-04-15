# Parthenon Installer GUI

Rust/Tauri desktop shell for the Parthenon Community installer.

This MVP keeps the existing Python installer as the source of installation
truth. The Rust app collects Community defaults, writes a temporary defaults
JSON, launches:

```bash
python3 install.py --defaults-file <generated.json> --non-interactive
```

and streams stdout/stderr back into the GUI.

## Run

```bash
cd installer/rust-gui
cargo run
```

Dry run is enabled by default in the UI. A real install requires clearing the
dry-run toggle and confirming that Docker services will be started.

Defaults preview and dry-run output redact secrets before rendering them in
the GUI log. The installer process still receives the full generated defaults
file during a real install.

## Verify

```bash
cargo fmt --check
cargo test
cargo clippy --all-targets -- -D warnings
cargo build
```

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
