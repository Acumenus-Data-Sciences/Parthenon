from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from installer.webapp import InstallerBackend


def test_bootstrap_exposes_python_community_contract(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = InstallerBackend().bootstrap()

    community = payload["community_defaults"]
    plan = payload["community_plan"]
    assert community["edition"] == "Community Edition"
    assert community["experience"] == "Beginner"
    assert community["modules"] == ["research", "ai_knowledge", "infrastructure"]
    assert community["datasets"] == ["eunomia", "phenotype-library"]
    assert community["enable_hecate"] is True
    assert community["enable_blackrabbit"] is False
    assert "hecate" in plan["compose_services"]
    assert "blackrabbit" not in plan["compose_services"]


def test_validate_launch_context_accepts_windows_wsl_only_path(monkeypatch):
    backend = InstallerBackend()

    monkeypatch.setattr("installer.webapp.launcher.is_windows_host", lambda: True)

    context = backend.validate_launch_context(
        {
            "repo_path": "",
            "wsl_distro": "Ubuntu-24.04",
            "wsl_repo_path": "/home/user/Parthenon",
        }
    )

    assert context == {
        "repo_path": "",
        "wsl_distro": "Ubuntu-24.04",
        "wsl_repo_path": "/home/user/Parthenon",
    }


def test_web_installer_launch_step_includes_windows_fields():
    app_js = (Path(__file__).resolve().parents[1] / "web" / "app.js").read_text()

    assert '{ key: "wsl_distro", label: "WSL distro" }' in app_js
    assert '{ key: "wsl_repo_path", label: "WSL repo path" }' in app_js
    assert 'await api("/api/validate-launch", "POST"' in app_js
    assert "wsl_distro: payload.wsl_distro" in app_js
    assert "wsl_repo_path: payload.wsl_repo_path" in app_js


def test_onboarding_modal_uses_modal_dry_run_and_does_not_block_on_umls():
    web_dir = Path(__file__).resolve().parents[1] / "web"
    index_html = (web_dir / "index.html").read_text()
    app_js = (web_dir / "app.js").read_text()

    assert "onboarding-dry-run" not in index_html
    assert "Continue with Dry Run" not in index_html
    assert "onboarding-dry-run" not in app_js
    assert "onboarding-dry-continue" not in app_js
    assert 'Enter the UMLS API Key before continuing.' not in app_js
    assert "UMLS API Key" not in index_html
    assert "onboarding-umls-key" not in index_html
    assert "onboarding-umls-key" not in app_js
    assert 'id="onboarding-continue" type="button"' in index_html
    assert 'id="modal-dry-run-toggle"' in index_html
    assert 'payload.dry_run = Boolean(state.currentValues.dry_run);' in app_js
    assert 'Dry run mode enabled. Step blocking checks are bypassed until you turn it off.' in app_js


def test_web_installer_is_community_mvp_only():
    web_dir = Path(__file__).resolve().parents[1] / "web"
    index_html = (web_dir / "index.html").read_text()
    app_js = (web_dir / "app.js").read_text()

    assert "Enterprise Edition" not in index_html
    assert "Acropolis Enterprise" not in app_js
    assert "enable_authentik" not in app_js
    assert "enable_superset" not in app_js
    assert "frontier_api_key" not in app_js
    assert "install_ollama" not in app_js
    assert 'edition: "Community Edition"' in app_js
    assert "state.bootstrap?.community_defaults" in app_js
    assert 'datasets: ["eunomia", "phenotype-library"]' not in app_js


def test_install_landing_pages_match_release_bootstrap_regime():
    root = Path(__file__).resolve().parents[2]
    public_install = (root / "frontend" / "public" / "install" / "index.html").read_text()
    public_bootstrap = (root / "frontend" / "public" / "install.sh").read_text()
    installer_bootstrap = (root / "installer" / "install.sh").read_text()
    packaged_install = (root / "installer" / "web" / "install-landing.html").read_text()
    wizard_index = (root / "installer" / "web" / "index.html").read_text()

    for html in (public_install, packaged_install):
        assert "curl -fsSL https://parthenon.acumenus.net/install.sh | sh" in html
        assert "--version v1.0.6" in html
        assert "--cli -- --community" in html
        assert "Source-only releases" in html
        assert "GitHub releases provide source code archives only" in html

        assert "brew install" not in html
        assert "sudo snap install" not in html
        assert "winget install" not in html
        assert "Package Manager" not in html
        assert "acropolis-install-linux.tar.gz" not in html
        assert "acropolis-install-macos.zip" not in html
        assert "acropolis-install-win.exe" not in html
        assert "parthenon-installer-gui-linux-x86_64.tar.gz" not in html
        assert "Download Rust GUI" not in html
        assert "checksums.sha256" not in html

    assert "Remote Community Install" in wizard_index
    assert "brew, snap, or winget" not in wizard_index

    assert public_bootstrap == installer_bootstrap
    assert public_bootstrap.startswith("#!/bin/sh")
    assert "archive/refs/tags" in public_bootstrap
    assert "git clone --depth 1 --branch" in public_bootstrap
    assert "exec \"$PYTHON\" install.py --webapp \"$@\"" in public_bootstrap
    assert "acropolis-install-linux.tar.gz" not in public_bootstrap
    assert "checksums.sha256" not in public_bootstrap


def test_status_pill_removed_and_alerts_live_at_top():
    web_dir = Path(__file__).resolve().parents[1] / "web"
    index_html = (web_dir / "index.html").read_text()

    assert 'id="status"' not in index_html
    assert '<div class="banner" id="banner" hidden></div>\n              <div class="content-head">' in index_html


def test_validate_launch_context_rejects_empty_windows_paths(monkeypatch):
    backend = InstallerBackend()

    monkeypatch.setattr("installer.webapp.launcher.is_windows_host", lambda: True)

    try:
        backend.validate_launch_context({"repo_path": "", "wsl_distro": "", "wsl_repo_path": ""})
    except ValueError as exc:
        assert str(exc) == "repo_path or wsl_repo_path is required on Windows"
    else:
        raise AssertionError("Expected empty Windows launch context to be rejected")
