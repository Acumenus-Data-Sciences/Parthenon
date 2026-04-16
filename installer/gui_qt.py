"""PySide6 desktop installer shell for Parthenon."""
from __future__ import annotations

import json
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path

from . import config, launcher, preflight, utils

try:
    from PySide6.QtCore import QObject, QThread, Qt, Signal
    from PySide6.QtGui import QPixmap
    from PySide6.QtWidgets import (
        QApplication,
        QCheckBox,
        QComboBox,
        QFileDialog,
        QFrame,
        QGridLayout,
        QHBoxLayout,
        QLabel,
        QLineEdit,
        QMainWindow,
        QMessageBox,
        QPlainTextEdit,
        QPushButton,
        QScrollArea,
        QStackedWidget,
        QVBoxLayout,
        QWidget,
    )

    QT_IMPORT_ERROR: ModuleNotFoundError | None = None
except ModuleNotFoundError as exc:  # pragma: no cover - environment dependent
    QT_IMPORT_ERROR = exc
    QApplication = None
    QCheckBox = None
    QComboBox = None
    QFileDialog = None
    QFrame = None
    QGridLayout = None
    QHBoxLayout = None
    QLabel = None
    QLineEdit = None
    QMainWindow = None
    QMessageBox = None
    QPlainTextEdit = None
    QPushButton = None
    QScrollArea = None
    QStackedWidget = None
    QVBoxLayout = None
    QWidget = None
    QObject = None
    QThread = None
    Qt = None
    Signal = None
    QPixmap = None


if QT_IMPORT_ERROR is None:
    class InstallWorker(QObject):
        line = Signal(str)
        status = Signal(str)
        success = Signal(dict)
        finished = Signal()

        def __init__(self, normalized: dict[str, object], launch_context: dict[str, str], upgrade: bool) -> None:
            super().__init__()
            self.normalized = normalized
            self.launch_context = launch_context
            self.upgrade = upgrade

        def run(self) -> None:
            temp_path: str | None = None
            try:
                with tempfile.NamedTemporaryFile("w", suffix=".json", prefix="parthenon-installer-", delete=False) as handle:
                    json.dump(self.normalized, handle, indent=2)
                    temp_path = handle.name

                cmd, cwd = launcher.build_install_command(
                    defaults_path=temp_path,
                    upgrade=self.upgrade,
                    repo_path=self.launch_context["repo_path"],
                    wsl_distro=self.launch_context["wsl_distro"],
                    wsl_repo_path=self.launch_context["wsl_repo_path"],
                )
                proc = subprocess.Popen(
                    cmd,
                    cwd=cwd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                )
                assert proc.stdout is not None
                for line in proc.stdout:
                    self.line.emit(line.rstrip("\n"))
                rc = proc.wait()
                if rc == 0:
                    self.status.emit("Installation complete")
                    self.success.emit(self.normalized)
                else:
                    self.status.emit(f"Installer failed with status {rc}")
            except Exception as exc:  # pragma: no cover - runtime path
                self.line.emit(f"Launcher error: {exc}")
                self.status.emit(f"Launcher failed: {exc}")
            finally:
                if temp_path:
                    Path(temp_path).unlink(missing_ok=True)
                self.finished.emit()


    class MacInstallerWindow(QMainWindow):
        STEP_KEYS = ["launch", "preflight", "basics", "credentials", "modules", "review"]
        STEP_META = {
            "launch": ("1. Launch", "Repo and runtime context"),
            "preflight": ("2. Preflight", "System readiness checks"),
            "basics": ("3. Basics", "Deployment defaults"),
            "credentials": ("4. Access", "Admin and database secrets"),
            "modules": ("5. Modules", "Capabilities, services, and ports"),
            "review": ("6. Review", "Validate and launch"),
        }

        def __init__(self) -> None:
            super().__init__()
            self.setWindowTitle("Parthenon Installer")
            self.resize(1440, 920)

            defaults = config.build_config_defaults()
            self.thread: QThread | None = None
            self.worker: InstallWorker | None = None
            self.current_step_index = 0
            self.last_preflight_results: list[preflight.CheckResult] = []
            self.nav_cards: dict[str, QFrame] = {}
            self.form_widgets: dict[str, object] = {}

            self.setStyleSheet(self._stylesheet())
            self._build_ui(defaults)
            self._refresh_dependencies()
            self._show_step(0)

        def _stylesheet(self) -> str:
            return """
            QMainWindow, QWidget#root { background: #08060A; color: #F3EFE7; }
            QLabel#heroTitle { font-size: 44px; font-weight: 700; color: #F6F2EB; }
            QLabel#heroSubtitle { font-size: 18px; color: #D8CDC0; }
            QLabel#heroBody { font-size: 14px; color: #C7BEB4; line-height: 1.5; }
            QFrame#divider { background: #C3273F; min-width: 2px; max-width: 2px; }
            QFrame#rightShell { background: rgba(14, 14, 17, 242); }
            QFrame#glassPanel {
              background: rgba(18, 18, 23, 212);
              border: 1px solid rgba(255, 255, 255, 0.10);
              border-radius: 24px;
            }
            QFrame#navCard {
              background: rgba(23, 23, 29, 230);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 18px;
            }
            QFrame#navCard[active="true"] {
              background: rgba(127, 21, 38, 245);
              border: 1px solid rgba(255, 255, 255, 0.16);
            }
            QLabel#navTitle { font-size: 15px; font-weight: 700; color: #EDE5DA; }
            QLabel#navSubtitle { font-size: 12px; color: #9F958A; }
            QLabel#navTitle[active="true"], QLabel#navSubtitle[active="true"] { color: white; }
            QLabel#pageTitle { font-size: 28px; font-weight: 700; color: #F6F2EB; }
            QLabel#pageSubtitle { font-size: 13px; color: #BEB5AA; }
            QLabel#fieldLabel { font-size: 12px; font-weight: 700; color: #C8BFB4; text-transform: uppercase; }
            QLineEdit, QComboBox, QPlainTextEdit {
              background: rgba(7, 7, 10, 210);
              border: 1px solid rgba(255,255,255,0.12);
              border-radius: 14px;
              padding: 10px 12px;
              color: #F3EFE7;
              selection-background-color: #7F1526;
            }
            QComboBox::drop-down { border: none; }
            QComboBox QAbstractItemView {
              background: #121217;
              color: #F3EFE7;
              border: 1px solid rgba(255,255,255,0.12);
            }
            QCheckBox { spacing: 10px; color: #E8E0D3; }
            QCheckBox::indicator {
              width: 18px; height: 18px; border-radius: 9px;
              border: 1px solid rgba(255,255,255,0.16); background: rgba(7,7,10,210);
            }
            QCheckBox::indicator:checked { background: #7F1526; border: 1px solid #B52741; }
            QPushButton {
              border-radius: 16px;
              padding: 12px 18px;
              font-weight: 700;
              border: 1px solid rgba(255,255,255,0.08);
            }
            QPushButton#primaryButton {
              background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #8E1730, stop:1 #C3273F);
              color: white;
              border: 1px solid rgba(255,255,255,0.14);
            }
            QPushButton#secondaryButton {
              background: rgba(26, 26, 34, 230);
              color: #E7DFD5;
            }
            QPushButton:disabled {
              background: rgba(74, 36, 48, 220);
              color: #CBBCC0;
            }
            QLabel#statusPill {
              background: rgba(255,255,255,0.05);
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 12px;
              padding: 8px 12px;
              color: #D1C7BB;
            }
            QScrollArea { border: none; background: transparent; }
            """

        def _build_ui(self, defaults: dict[str, object]) -> None:
            root = QWidget()
            root.setObjectName("root")
            self.setCentralWidget(root)
            outer = QHBoxLayout(root)
            outer.setContentsMargins(0, 0, 0, 0)
            outer.setSpacing(0)

            outer.addWidget(self._build_hero(), 11)

            divider = QFrame()
            divider.setObjectName("divider")
            outer.addWidget(divider)

            right = QFrame()
            right.setObjectName("rightShell")
            outer.addWidget(right, 13)
            right_layout = QVBoxLayout(right)
            right_layout.setContentsMargins(28, 28, 28, 28)

            glass = QFrame()
            glass.setObjectName("glassPanel")
            right_layout.addWidget(glass)
            glass_layout = QVBoxLayout(glass)
            glass_layout.setContentsMargins(22, 22, 22, 22)
            glass_layout.setSpacing(16)

            title = QLabel("Install Parthenon")
            title.setObjectName("pageTitle")
            subtitle = QLabel("A polished onboarding shell for configuring and launching the installer.")
            subtitle.setObjectName("pageSubtitle")
            glass_layout.addWidget(title)
            glass_layout.addWidget(subtitle)

            body = QHBoxLayout()
            body.setSpacing(18)
            glass_layout.addLayout(body, 1)

            body.addWidget(self._build_sidebar(), 0)

            main = QWidget()
            main_layout = QVBoxLayout(main)
            main_layout.setContentsMargins(0, 0, 0, 0)
            main_layout.setSpacing(16)
            body.addWidget(main, 1)

            self.page_title = QLabel("")
            self.page_title.setObjectName("pageTitle")
            self.page_subtitle = QLabel("")
            self.page_subtitle.setObjectName("pageSubtitle")
            main_layout.addWidget(self.page_title)
            main_layout.addWidget(self.page_subtitle)

            self.stack = QStackedWidget()
            main_layout.addWidget(self.stack, 1)

            self.stack.addWidget(self._scroll_page(self._page_launch()))
            self.stack.addWidget(self._scroll_page(self._page_preflight()))
            self.stack.addWidget(self._scroll_page(self._page_basics(defaults)))
            self.stack.addWidget(self._scroll_page(self._page_credentials(defaults)))
            self.stack.addWidget(self._scroll_page(self._page_modules(defaults)))
            self.stack.addWidget(self._scroll_page(self._page_review()))

            self.log_edit = self._plain_panel("Installer Output")
            self.success_edit = self._plain_panel("Installation Complete")

            actions = self._build_actions()
            main_layout.addWidget(actions)

        def _build_hero(self) -> QWidget:
            container = QWidget()
            stack = QStackedWidget(container)
            layout = QVBoxLayout(container)
            layout.setContentsMargins(0, 0, 0, 0)
            layout.addWidget(stack)

            bg = QLabel()
            bg.setScaledContents(True)
            bg.setPixmap(QPixmap(str(launcher.resource_path("frontend/public/parthenon-login-bg.png"))))
            stack.addWidget(bg)

            overlay = QWidget()
            overlay.setStyleSheet("background: rgba(8, 6, 10, 0.40);")
            overlay_layout = QVBoxLayout(overlay)
            overlay_layout.setContentsMargins(110, 120, 0, 0)

            card = QFrame()
            card.setMaximumWidth(520)
            card.setStyleSheet(
                "background: rgba(11, 10, 10, 0.58); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px;"
            )
            card_layout = QVBoxLayout(card)
            card_layout.setContentsMargins(34, 34, 34, 34)
            accent = QFrame()
            accent.setFixedHeight(4)
            accent.setFixedWidth(66)
            accent.setStyleSheet("background: #C3273F; border-radius: 2px;")
            title = QLabel("Parthenon")
            title.setObjectName("heroTitle")
            subtitle = QLabel("Unified Outcomes Research Platform")
            subtitle.setObjectName("heroSubtitle")
            body = QLabel(
                "This installer should feel like a product, not a script wrapper. "
                "The wizard on the right walks through launch context, preflight, deployment defaults, "
                "credentials, capabilities, and final review."
            )
            body.setWordWrap(True)
            body.setObjectName("heroBody")
            chips = QLabel("Cohorts   Characterization   Estimation   Prediction   Imaging   GIS")
            chips.setStyleSheet("color: #AFA59A; font-family: monospace; font-size: 12px;")
            chips.setWordWrap(True)
            card_layout.addWidget(accent, 0, Qt.AlignmentFlag.AlignLeft)
            card_layout.addSpacing(10)
            card_layout.addWidget(title)
            card_layout.addWidget(subtitle)
            card_layout.addWidget(body)
            card_layout.addStretch(1)
            card_layout.addWidget(chips)
            overlay_layout.addWidget(card)
            overlay_layout.addStretch(1)
            stack.addWidget(overlay)
            return container

        def _build_sidebar(self) -> QWidget:
            wrap = QFrame()
            wrap.setObjectName("glassPanel")
            wrap.setMinimumWidth(230)
            layout = QVBoxLayout(wrap)
            layout.setContentsMargins(16, 16, 16, 16)
            layout.setSpacing(12)
            heading = QLabel("Setup Flow")
            heading.setObjectName("pageTitle")
            heading.setStyleSheet("font-size: 20px;")
            sub = QLabel("Step through the install in the same order the backend installer expects.")
            sub.setObjectName("pageSubtitle")
            sub.setWordWrap(True)
            layout.addWidget(heading)
            layout.addWidget(sub)
            for key in self.STEP_KEYS:
                title, desc = self.STEP_META[key]
                card = QFrame()
                card.setObjectName("navCard")
                card.setCursor(Qt.CursorShape.PointingHandCursor)
                card_layout = QVBoxLayout(card)
                card_layout.setContentsMargins(14, 12, 14, 12)
                title_label = QLabel(title)
                title_label.setObjectName("navTitle")
                subtitle_label = QLabel(desc)
                subtitle_label.setObjectName("navSubtitle")
                card_layout.addWidget(title_label)
                card_layout.addWidget(subtitle_label)
                card.mousePressEvent = lambda _event, step_key=key: self._jump_to_step(step_key)
                self.nav_cards[key] = card
                layout.addWidget(card)
            layout.addStretch(1)
            return wrap

        def _build_actions(self) -> QWidget:
            wrap = QFrame()
            wrap.setObjectName("glassPanel")
            layout = QHBoxLayout(wrap)
            layout.setContentsMargins(16, 14, 16, 14)
            layout.setSpacing(10)

            self.upgrade = QCheckBox("Upgrade existing installation")
            layout.addWidget(self.upgrade)
            layout.addStretch(1)

            self.status_label = QLabel("Ready")
            self.status_label.setObjectName("statusPill")
            layout.addWidget(self.status_label)

            self.back_button = QPushButton("Back")
            self.back_button.setObjectName("secondaryButton")
            self.back_button.clicked.connect(self._go_prev_step)
            layout.addWidget(self.back_button)

            self.next_button = QPushButton("Next")
            self.next_button.setObjectName("secondaryButton")
            self.next_button.clicked.connect(self._go_next_step)
            layout.addWidget(self.next_button)

            self.validate_button = QPushButton("Validate")
            self.validate_button.setObjectName("secondaryButton")
            self.validate_button.clicked.connect(self._validate_all)
            layout.addWidget(self.validate_button)

            self.install_button = QPushButton("Start Installation")
            self.install_button.setObjectName("primaryButton")
            self.install_button.clicked.connect(self._start_install)
            layout.addWidget(self.install_button)
            return wrap

        def _scroll_page(self, content: QWidget) -> QWidget:
            scroll = QScrollArea()
            scroll.setWidgetResizable(True)
            scroll.setWidget(content)
            return scroll

        def _page_wrap(self) -> tuple[QWidget, QVBoxLayout]:
            page = QWidget()
            layout = QVBoxLayout(page)
            layout.setContentsMargins(0, 0, 0, 0)
            layout.setSpacing(14)
            return page, layout

        def _plain_panel(self, title: str) -> QPlainTextEdit:
            page, layout = self._page_wrap()
            panel = self._glass_section(title)
            edit = QPlainTextEdit()
            edit.setReadOnly(True)
            panel.layout().addWidget(edit)
            layout.addWidget(panel)
            self.stack.addWidget(page)
            return edit

        def _glass_section(self, title: str) -> QFrame:
            frame = QFrame()
            frame.setObjectName("glassPanel")
            layout = QVBoxLayout(frame)
            layout.setContentsMargins(16, 16, 16, 16)
            header = QLabel(title)
            header.setObjectName("pageTitle")
            header.setStyleSheet("font-size: 18px;")
            layout.addWidget(header)
            return frame

        def _field(self, label: str, widget: QWidget, parent_layout: QGridLayout, row: int) -> None:
            caption = QLabel(label)
            caption.setObjectName("fieldLabel")
            parent_layout.addWidget(caption, row, 0)
            parent_layout.addWidget(widget, row, 1)

        def _page_launch(self) -> QWidget:
            page, layout = self._page_wrap()
            panel = self._glass_section("Launch Context")
            grid = QGridLayout()
            repo = QLineEdit(launcher.default_repo_path())
            self.form_widgets["repo_path"] = repo
            self._field("Parthenon repo path", repo, grid, 0)
            browse = QPushButton("Browse")
            browse.setObjectName("secondaryButton")
            browse.clicked.connect(self._browse_repo_path)
            grid.addWidget(browse, 0, 2)
            if launcher.is_windows_host():
                distro = QLineEdit(launcher.default_wsl_distro())
                repo_linux = QLineEdit(launcher.default_wsl_repo_path())
            else:
                distro = QLineEdit("")
                repo_linux = QLineEdit("")
            self.form_widgets["wsl_distro"] = distro
            self.form_widgets["wsl_repo_path"] = repo_linux
            if launcher.is_windows_host():
                self._field("WSL distro", distro, grid, 1)
                self._field("WSL repo path", repo_linux, grid, 2)
            panel.layout().addLayout(grid)
            layout.addWidget(panel)
            layout.addStretch(1)
            return page

        def _page_preflight(self) -> QWidget:
            page, layout = self._page_wrap()
            panel = self._glass_section("System Readiness")
            row = QHBoxLayout()
            run = QPushButton("Run Preflight Checks")
            run.setObjectName("secondaryButton")
            run.clicked.connect(self._run_preflight_checks)
            row.addWidget(run)
            self.preflight_status = QLabel("Checks have not been run yet.")
            self.preflight_status.setObjectName("statusPill")
            row.addWidget(self.preflight_status)
            row.addStretch(1)
            panel.layout().addLayout(row)
            self.preflight_text = QPlainTextEdit()
            self.preflight_text.setReadOnly(True)
            panel.layout().addWidget(self.preflight_text)
            layout.addWidget(panel)
            return page

        def _page_basics(self, defaults: dict[str, object]) -> QWidget:
            page, layout = self._page_wrap()
            basic = self._glass_section("Deployment Defaults")
            grid = QGridLayout()
            exp = QComboBox()
            exp.addItems(config.EXPERIENCE_CHOICES)
            exp.setCurrentText(str(defaults["experience"]))
            exp.currentTextChanged.connect(self._refresh_dependencies)
            self.form_widgets["experience"] = exp
            self._field("Experience", exp, grid, 0)
            cdm = QComboBox()
            cdm.addItems(config.CDM_DIALECT_CHOICES)
            cdm.setCurrentText(str(defaults["cdm_dialect"]))
            self.form_widgets["cdm_dialect"] = cdm
            self._field("CDM database", cdm, grid, 1)
            for row, (key, label) in enumerate([("app_url", "App URL"), ("timezone", "Timezone"), ("ollama_url", "Ollama URL")], start=2):
                field = QLineEdit(str(defaults[key]))
                self.form_widgets[key] = field
                self._field(label, field, grid, row)
            env = QComboBox()
            env.addItems(config.ENV_CHOICES)
            env.setCurrentText(str(defaults["env"]))
            self.form_widgets["env"] = env
            self._field("Environment", env, grid, 5)
            demo = QCheckBox("Load Eunomia demo CDM")
            demo.setChecked(bool(defaults["include_eunomia"]))
            self.form_widgets["include_eunomia"] = demo
            grid.addWidget(demo, 6, 0, 1, 2)
            basic.layout().addLayout(grid)
            layout.addWidget(basic)

            vocab = self._glass_section("Vocabulary")
            vgrid = QGridLayout()
            vocab_zip = QLineEdit(str(defaults.get("vocab_zip_path") or ""))
            self.form_widgets["vocab_zip_path"] = vocab_zip
            self._field("Athena vocabulary ZIP", vocab_zip, vgrid, 0)
            vbrowse = QPushButton("Browse")
            vbrowse.setObjectName("secondaryButton")
            vbrowse.clicked.connect(self._browse_vocab_zip)
            vgrid.addWidget(vbrowse, 0, 2)
            vocab.layout().addLayout(vgrid)
            layout.addWidget(vocab)
            layout.addStretch(1)
            return page

        def _page_credentials(self, defaults: dict[str, object]) -> QWidget:
            page, layout = self._page_wrap()
            panel = self._glass_section("Credentials")
            grid = QGridLayout()
            for row, (key, label, secret) in enumerate(
                [("admin_email", "Admin email", False), ("admin_name", "Admin name", False), ("admin_password", "Admin password", True), ("db_password", "DB password", True)]
            ):
                field = QLineEdit(str(defaults[key]))
                if secret:
                    field.setEchoMode(QLineEdit.EchoMode.Password)
                self.form_widgets[key] = field
                self._field(label, field, grid, row)
            panel.layout().addLayout(grid)
            row = QHBoxLayout()
            regen_admin = QPushButton("Generate Admin Password")
            regen_admin.setObjectName("secondaryButton")
            regen_admin.clicked.connect(lambda: self.form_widgets["admin_password"].setText(config._generate_password(16)))
            regen_db = QPushButton("Generate DB Password")
            regen_db.setObjectName("secondaryButton")
            regen_db.clicked.connect(lambda: self.form_widgets["db_password"].setText(config._generate_password(24)))
            row.addWidget(regen_admin)
            row.addWidget(regen_db)
            row.addStretch(1)
            panel.layout().addLayout(row)
            layout.addWidget(panel)
            layout.addStretch(1)
            return page

        def _page_modules(self, defaults: dict[str, object]) -> QWidget:
            page, layout = self._page_wrap()
            modules = self._glass_section("Modules")
            mgrid = QGridLayout()
            for idx, key in enumerate(["research", "commons", "ai_knowledge", "data_pipeline", "infrastructure"]):
                box = QCheckBox(key.replace("_", " ").title())
                box.setChecked(key in defaults["modules"])
                box.stateChanged.connect(self._refresh_dependencies)
                self.form_widgets[key] = box
                mgrid.addWidget(box, idx // 2, idx % 2)
            modules.layout().addLayout(mgrid)
            layout.addWidget(modules)

            options = self._glass_section("Optional Services")
            ogrid = QGridLayout()
            for idx, (key, label) in enumerate(
                [
                    ("enable_study_agent", "Study Designer"),
                    ("enable_hecate", "Hecate"),
                    ("enable_blackrabbit", "BlackRabbit"),
                    ("enable_fhir_to_cdm", "FHIR-to-CDM"),
                    ("enable_orthanc", "Orthanc"),
                    ("enable_livekit", "LiveKit"),
                    ("enable_solr", "Apache Solr"),
                ]
            ):
                box = QCheckBox(label)
                box.setChecked(bool(defaults[key]))
                box.stateChanged.connect(self._refresh_dependencies)
                self.form_widgets[key] = box
                ogrid.addWidget(box, idx // 2, idx % 2)
            options.layout().addLayout(ogrid)
            layout.addWidget(options)

            creds = self._glass_section("Service Credentials")
            cgrid = QGridLayout()
            for row, (key, label, secret) in enumerate(
                [("livekit_url", "LiveKit URL", False), ("livekit_api_key", "LiveKit API key", False), ("livekit_api_secret", "LiveKit API secret", True), ("orthanc_user", "Orthanc user", False), ("orthanc_password", "Orthanc password", True)]
            ):
                field = QLineEdit(str(defaults[key]))
                if secret:
                    field.setEchoMode(QLineEdit.EchoMode.Password)
                self.form_widgets[key] = field
                self._field(label, field, cgrid, row)
            creds.layout().addLayout(cgrid)
            layout.addWidget(creds)

            ports = self._glass_section("Ports")
            pgrid = QGridLayout()
            for row, (key, label) in enumerate(
                [("nginx_port", "NGINX"), ("postgres_port", "Postgres"), ("redis_port", "Redis"), ("ai_port", "AI"), ("solr_port", "Solr"), ("solr_java_mem", "Solr JVM memory")]
            ):
                field = QLineEdit(str(defaults[key]))
                self.form_widgets[key] = field
                self._field(label, field, pgrid, row)
            ports.layout().addLayout(pgrid)
            layout.addWidget(ports)
            layout.addStretch(1)
            return page

        def _page_review(self) -> QWidget:
            page, layout = self._page_wrap()
            review = self._glass_section("Review Configuration")
            self.review_text = QPlainTextEdit()
            self.review_text.setReadOnly(True)
            review.layout().addWidget(self.review_text)
            layout.addWidget(review)
            return page

        def _get_line(self, key: str) -> str:
            return self.form_widgets[key].text().strip()

        def _get_bool(self, key: str) -> bool:
            return bool(self.form_widgets[key].isChecked())

        def _collect_payload(self) -> dict[str, object]:
            modules = [key for key in ["research", "commons", "ai_knowledge", "data_pipeline", "infrastructure"] if self._get_bool(key)]
            return {
                "repo_path": self._get_line("repo_path"),
                "wsl_distro": self._get_line("wsl_distro"),
                "wsl_repo_path": self._get_line("wsl_repo_path"),
                "experience": self.form_widgets["experience"].currentText(),
                "vocab_zip_path": self._get_line("vocab_zip_path") or None,
                "cdm_dialect": self.form_widgets["cdm_dialect"].currentText(),
                "app_url": self._get_line("app_url"),
                "env": self.form_widgets["env"].currentText(),
                "db_password": self._get_line("db_password"),
                "admin_email": self._get_line("admin_email"),
                "admin_name": self._get_line("admin_name"),
                "admin_password": self._get_line("admin_password"),
                "timezone": self._get_line("timezone"),
                "include_eunomia": self._get_bool("include_eunomia"),
                "ollama_url": self._get_line("ollama_url"),
                "modules": modules,
                "enable_study_agent": self._get_bool("enable_study_agent"),
                "enable_blackrabbit": self._get_bool("enable_blackrabbit"),
                "enable_fhir_to_cdm": self._get_bool("enable_fhir_to_cdm"),
                "enable_hecate": self._get_bool("enable_hecate"),
                "enable_orthanc": self._get_bool("enable_orthanc"),
                "enable_livekit": self._get_bool("enable_livekit"),
                "enable_solr": self._get_bool("enable_solr"),
                "livekit_url": self._get_line("livekit_url"),
                "livekit_api_key": self._get_line("livekit_api_key"),
                "livekit_api_secret": self._get_line("livekit_api_secret"),
                "orthanc_user": self._get_line("orthanc_user"),
                "orthanc_password": self._get_line("orthanc_password"),
                "nginx_port": self._get_line("nginx_port"),
                "postgres_port": self._get_line("postgres_port"),
                "redis_port": self._get_line("redis_port"),
                "ai_port": self._get_line("ai_port"),
                "solr_port": self._get_line("solr_port"),
                "solr_java_mem": self._get_line("solr_java_mem"),
            }

        def _validate_launch_context(self, payload: dict[str, object]) -> dict[str, str]:
            repo_path = str(payload.get("repo_path") or "").strip()
            wsl_distro = str(payload.get("wsl_distro") or "").strip()
            wsl_repo_path = str(payload.get("wsl_repo_path") or "").strip()
            if launcher.is_windows_host():
                if not repo_path and not wsl_repo_path:
                    raise ValueError("repo_path or wsl_repo_path is required on Windows")
                return {"repo_path": repo_path, "wsl_distro": wsl_distro, "wsl_repo_path": wsl_repo_path}
            launcher.validate_repo_path(repo_path or launcher.default_repo_path())
            return {"repo_path": repo_path or launcher.default_repo_path(), "wsl_distro": "", "wsl_repo_path": ""}

        @contextmanager
        def _use_repo_root(self, repo_path: str):
            original_repo_root = utils.REPO_ROOT
            try:
                resolved = launcher.validate_repo_path(repo_path or launcher.default_repo_path())
                utils.REPO_ROOT = resolved
                yield resolved
            finally:
                utils.REPO_ROOT = original_repo_root

        def _group_preflight(self, checks: list[preflight.CheckResult]) -> str:
            runtime: list[preflight.CheckResult] = []
            workspace: list[preflight.CheckResult] = []
            ports: list[preflight.CheckResult] = []
            for check in checks:
                if check.name.startswith("Port "):
                    ports.append(check)
                elif check.name in {"Disk space ≥ 5 GB", "Repo complete", "Existing install", "PHP vendor dir", "Hecate bootstrap assets"}:
                    workspace.append(check)
                else:
                    runtime.append(check)

            lines: list[str] = []
            for title, guidance, items in [
                ("Runtime Dependencies", "Fix Docker, Compose, Python, or Linux docker-group issues before installation.", runtime),
                ("Workspace Readiness", "Confirm the repo path, free disk, and whether an existing install is acceptable.", workspace),
                ("Port Availability", "Free these ports or change the mapped ports later in the wizard.", ports),
            ]:
                if not items:
                    continue
                lines.append(title)
                lines.append(f"  Action: {guidance}")
                for item in items:
                    lines.append(f"  [{item.status.upper():>4}] {item.name}: {item.detail}")
                lines.append("")
            return "\n".join(lines).rstrip()

        def _run_preflight_checks(self) -> None:
            payload = self._collect_payload()
            try:
                launch_context = self._validate_launch_context(payload)
                if launcher.is_windows_host():
                    raise ValueError("Windows GUI preflight through WSL is not implemented yet.")
                with self._use_repo_root(launch_context["repo_path"]) as repo_root:
                    checks = preflight.run_checks(payload)
            except Exception as exc:
                QMessageBox.critical(self, "Preflight failed", str(exc))
                self.preflight_status.setText(f"Preflight failed: {exc}")
                self.preflight_text.setPlainText(str(exc))
                return

            self.last_preflight_results = checks
            failures = [check for check in checks if check.status == "fail"]
            warnings = [check for check in checks if check.status == "warn"]
            if failures:
                self.preflight_status.setText(f"{len(failures)} failure(s), {len(warnings)} warning(s)")
            elif warnings:
                self.preflight_status.setText(f"Passed with {len(warnings)} warning(s)")
            else:
                self.preflight_status.setText("All checks passed")
            report = [
                "Preflight Summary",
                f"  Repo root: {repo_root}",
                f"  Checks run: {len(checks)}",
                f"  Failures: {len(failures)}",
                f"  Warnings: {len(warnings)}",
                "",
                self._group_preflight(checks),
            ]
            self.preflight_text.setPlainText("\n".join(report))

        def _refresh_dependencies(self) -> None:
            if "experience" not in self.form_widgets:
                return
            first_time = self.form_widgets["experience"].currentText() == "First-time"
            self.form_widgets["vocab_zip_path"].setEnabled(not first_time)

            research = self._get_bool("research")
            commons = self._get_bool("commons")
            ai = self._get_bool("ai_knowledge")
            pipeline = self._get_bool("data_pipeline")
            infra = self._get_bool("infrastructure")

            if not research:
                self.form_widgets["enable_study_agent"].setChecked(False)
            if not commons:
                self.form_widgets["enable_livekit"].setChecked(False)
            if not ai:
                self.form_widgets["enable_hecate"].setChecked(False)
            if not pipeline:
                self.form_widgets["enable_blackrabbit"].setChecked(False)
                self.form_widgets["enable_fhir_to_cdm"].setChecked(False)
                self.form_widgets["enable_orthanc"].setChecked(False)
            if not infra:
                self.form_widgets["enable_solr"].setChecked(False)

            livekit_enabled = commons and self._get_bool("enable_livekit")
            orthanc_enabled = pipeline and self._get_bool("enable_orthanc")
            solr_enabled = infra and self._get_bool("enable_solr")

            for key in ["livekit_url", "livekit_api_key", "livekit_api_secret"]:
                self.form_widgets[key].setEnabled(livekit_enabled)
            for key in ["orthanc_user", "orthanc_password"]:
                self.form_widgets[key].setEnabled(orthanc_enabled)
            for key in ["solr_port", "solr_java_mem"]:
                self.form_widgets[key].setEnabled(solr_enabled)

        def _populate_review(self) -> None:
            payload = self._collect_payload()
            lines = [
                "Launch context",
                f"  Repo path: {payload['repo_path'] or '(default)'}",
                "",
                "Core setup",
                f"  Experience: {payload['experience']}",
                f"  CDM database: {payload['cdm_dialect']}",
                f"  App URL: {payload['app_url']}",
                f"  Environment: {payload['env']}",
                f"  Timezone: {payload['timezone']}",
                f"  Demo dataset: {'yes' if payload['include_eunomia'] else 'no'}",
                f"  Vocabulary ZIP: {payload['vocab_zip_path'] or 'load later'}",
                "",
                "Credentials",
                f"  Admin email: {payload['admin_email']}",
                f"  Admin name: {payload['admin_name']}",
                f"  Admin password: {'*' * max(8, len(str(payload['admin_password'])))}",
                f"  DB password: {'*' * max(8, len(str(payload['db_password'])))}",
                "",
                "Modules",
                f"  Enabled groups: {', '.join(payload['modules']) or '(none)'}",
                f"  Study Designer: {'on' if payload['enable_study_agent'] else 'off'}",
                f"  Hecate: {'on' if payload['enable_hecate'] else 'off'}",
                f"  BlackRabbit: {'on' if payload['enable_blackrabbit'] else 'off'}",
                f"  FHIR-to-CDM: {'on' if payload['enable_fhir_to_cdm'] else 'off'}",
                f"  Orthanc: {'on' if payload['enable_orthanc'] else 'off'}",
                f"  LiveKit: {'on' if payload['enable_livekit'] else 'off'}",
                f"  Solr: {'on' if payload['enable_solr'] else 'off'}",
                "",
                "Ports",
                f"  NGINX {payload['nginx_port']}  Postgres {payload['postgres_port']}  Redis {payload['redis_port']}",
                f"  AI {payload['ai_port']}  Solr {payload['solr_port']}",
                "",
                "Action",
                f"  Upgrade existing install: {'yes' if self.upgrade.isChecked() else 'no'}",
            ]
            self.review_text.setPlainText("\n".join(lines))

        def _populate_success(self, normalized: dict[str, object]) -> None:
            lines = [
                "Parthenon installed successfully.",
                "",
                f"URL: {normalized.get('app_url', '(see install log)')}",
                f"Admin email: {normalized.get('admin_email', '(see install log)')}",
                "Admin password: saved to .install-credentials",
                "Database password: saved to .install-credentials",
            ]
            if normalized.get("enable_solr"):
                lines.append(f"Solr: http://localhost:{normalized.get('solr_port', 8983)}/solr/")
            if normalized.get("enable_study_agent"):
                lines.append("Study AI: http://localhost:8765")
            if normalized.get("enable_blackrabbit"):
                lines.append("Profiler: http://localhost:8090")
            if normalized.get("enable_fhir_to_cdm"):
                lines.append("FHIR CDM: http://localhost:8091")
            if normalized.get("enable_hecate"):
                lines.append("Hecate: http://localhost:8088")
            self.success_edit.setPlainText("\n".join(lines))

        def _validate_current_step(self) -> bool:
            payload = self._collect_payload()
            try:
                current = self.STEP_KEYS[self.current_step_index]
                if current == "launch":
                    self._validate_launch_context(payload)
                elif current == "preflight":
                    if not self.last_preflight_results:
                        raise ValueError("Run preflight checks before continuing")
                    if any(check.status == "fail" for check in self.last_preflight_results):
                        raise ValueError("Resolve preflight failures before continuing")
                else:
                    self._validate_launch_context(payload)
            except Exception as exc:
                QMessageBox.critical(self, "Step validation failed", str(exc))
                self.status_label.setText(f"Validation failed: {exc}")
                return False
            return True

        def _validate_all(self) -> None:
            payload = self._collect_payload()
            try:
                self._validate_launch_context(payload)
                config.validate_config(payload)
            except Exception as exc:
                QMessageBox.critical(self, "Validation failed", str(exc))
                self.status_label.setText(f"Validation failed: {exc}")
                return
            self.status_label.setText(f"Validated for {payload['app_url']}")
            QMessageBox.information(self, "Configuration valid", "The installer configuration is valid.")

        def _show_step(self, index: int) -> None:
            self.current_step_index = max(0, min(index, len(self.STEP_KEYS) - 1))
            key = self.STEP_KEYS[self.current_step_index]
            self.page_title.setText(self.STEP_META[key][0])
            self.page_subtitle.setText(self.STEP_META[key][1])
            self.stack.setCurrentIndex(self.current_step_index)
            if key == "review":
                self._populate_review()
            for nav_key, card in self.nav_cards.items():
                active = nav_key == key
                card.setProperty("active", active)
                card.style().unpolish(card)
                card.style().polish(card)
                for child in card.findChildren(QLabel):
                    child.setProperty("active", active)
                    child.style().unpolish(child)
                    child.style().polish(child)
            self.back_button.setEnabled(self.current_step_index > 0)
            self.next_button.setEnabled(self.current_step_index < len(self.STEP_KEYS) - 1)
            self.validate_button.setEnabled(key == "review")
            self.install_button.setEnabled(key == "review" and self.thread is None)

        def _go_prev_step(self) -> None:
            if self.current_step_index > 0:
                self._show_step(self.current_step_index - 1)

        def _go_next_step(self) -> None:
            if not self._validate_current_step():
                return
            if self.current_step_index < len(self.STEP_KEYS) - 1:
                self._show_step(self.current_step_index + 1)

        def _jump_to_step(self, step_key: str) -> None:
            target_index = self.STEP_KEYS.index(step_key)
            if target_index == self.current_step_index:
                return
            if target_index > self.current_step_index and not self._validate_current_step():
                return
            self._show_step(target_index)

        def _browse_repo_path(self) -> None:
            path = QFileDialog.getExistingDirectory(self, "Select Parthenon repository root")
            if path:
                self.form_widgets["repo_path"].setText(path)

        def _browse_vocab_zip(self) -> None:
            path, _ = QFileDialog.getOpenFileName(self, "Select Athena vocabulary ZIP", "", "ZIP archives (*.zip);;All files (*)")
            if path:
                self.form_widgets["vocab_zip_path"].setText(path)

        def _append_log(self, text: str) -> None:
            existing = self.log_edit.toPlainText()
            self.log_edit.setPlainText(f"{existing}\n{text}" if existing else text)
            self.log_edit.verticalScrollBar().setValue(self.log_edit.verticalScrollBar().maximum())

        def _start_install(self) -> None:
            payload = self._collect_payload()
            try:
                launch_context = self._validate_launch_context(payload)
                normalized = config.validate_config(payload)
            except Exception as exc:
                QMessageBox.critical(self, "Cannot start install", str(exc))
                self.status_label.setText(f"Validation failed: {exc}")
                return

            self.log_edit.setPlainText("Preparing temporary defaults file...\n")
            self.stack.setCurrentIndex(len(self.STEP_KEYS))
            self.status_label.setText("Starting installer...")
            self.back_button.setEnabled(False)
            self.next_button.setEnabled(False)
            self.validate_button.setEnabled(False)
            self.install_button.setEnabled(False)

            self.thread = QThread(self)
            self.worker = InstallWorker(normalized, launch_context, self.upgrade.isChecked())
            self.worker.moveToThread(self.thread)
            self.thread.started.connect(self.worker.run)
            self.worker.line.connect(self._append_log)
            self.worker.status.connect(self.status_label.setText)
            self.worker.success.connect(self._on_install_success)
            self.worker.finished.connect(self._on_install_finished)
            self.worker.finished.connect(self.thread.quit)
            self.thread.finished.connect(self.thread.deleteLater)
            self.thread.start()

        def _on_install_success(self, normalized: dict[str, object]) -> None:
            self._populate_success(normalized)
            self.stack.setCurrentIndex(len(self.STEP_KEYS) + 1)
            self.status_label.setText("Installation complete")

        def _on_install_finished(self) -> None:
            self.worker = None
            self.thread = None
            self._show_step(self.current_step_index)


else:
    InstallWorker = None
    MacInstallerWindow = None


def main() -> None:
    if QT_IMPORT_ERROR is not None:
        raise SystemExit(
            "PySide6 is not installed. Install it in a virtual environment or packaged build "
            f"before using the Qt launcher ({QT_IMPORT_ERROR})."
        )
    app = QApplication.instance() or QApplication([])
    window = MacInstallerWindow()
    window.show()
    app.exec()
