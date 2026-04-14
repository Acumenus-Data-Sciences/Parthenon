from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from installer.webapp import InstallerBackend


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
