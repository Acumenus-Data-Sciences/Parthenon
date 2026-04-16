"""Simple desktop launcher for the Parthenon installer."""
from __future__ import annotations

import json
import queue
import subprocess
import sys
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, StringVar, BooleanVar, Tk, PhotoImage
    from tkinter import scrolledtext
    from tkinter import ttk
    TK_IMPORT_ERROR: ModuleNotFoundError | None = None
except ModuleNotFoundError as exc:
    tk = None
    filedialog = None
    messagebox = None
    StringVar = None
    BooleanVar = None
    Tk = None
    PhotoImage = None
    scrolledtext = None
    ttk = None
    TK_IMPORT_ERROR = exc

from . import config, launcher, preflight, utils


class InstallerGui:
    def __init__(self, root: Tk) -> None:
        self.root = root
        self.root.title("Parthenon Installer")
        self.root.geometry("1080x900")

        self.log_queue: queue.Queue[str] = queue.Queue()
        self.install_thread: threading.Thread | None = None
        self.install_running = False
        self.entry_widgets: dict[str, ttk.Entry] = {}
        self.step_frames: dict[str, ttk.Frame] = {}
        self.step_nav_labels: dict[str, tk.Label] = {}
        self.step_order = ["launch", "preflight", "basics", "credentials", "capabilities", "review"]
        self.step_titles = {
            "launch": "1. Launch",
            "preflight": "2. Preflight",
            "basics": "3. Basics",
            "credentials": "4. Access",
            "capabilities": "5. Modules",
            "review": "6. Review",
        }
        self.step_subtitles = {
            "launch": "Repo and runtime context",
            "preflight": "System readiness checks",
            "basics": "Deployment defaults",
            "credentials": "Admin and database secrets",
            "capabilities": "Modules, services, ports",
            "review": "Validate and launch",
        }
        self.current_step_index = 0
        self.last_preflight_results: list[preflight.CheckResult] = []
        self.last_install_summary: dict[str, object] | None = None

        defaults = config.build_config_defaults()
        self.vars = self._build_vars(defaults)
        self.module_vars = {
            "research": BooleanVar(value="research" in defaults["modules"]),
            "commons": BooleanVar(value="commons" in defaults["modules"]),
            "ai_knowledge": BooleanVar(value="ai_knowledge" in defaults["modules"]),
            "data_pipeline": BooleanVar(value="data_pipeline" in defaults["modules"]),
            "infrastructure": BooleanVar(value="infrastructure" in defaults["modules"]),
        }

        self._configure_styles()
        self._build_layout()
        self._bind_refresh_hooks()
        self._refresh_dependencies()
        self.root.after(150, self._poll_log_queue)

    def _build_vars(self, defaults: dict[str, object]) -> dict[str, StringVar | BooleanVar]:
        return {
            "repo_path": StringVar(value=launcher.default_repo_path()),
            "wsl_distro": StringVar(value=launcher.default_wsl_distro()),
            "wsl_repo_path": StringVar(value=launcher.default_wsl_repo_path()),
            "experience": StringVar(value=str(defaults["experience"])),
            "vocab_zip_path": StringVar(value=str(defaults.get("vocab_zip_path") or "")),
            "cdm_dialect": StringVar(value=str(defaults["cdm_dialect"])),
            "app_url": StringVar(value=str(defaults["app_url"])),
            "env": StringVar(value=str(defaults["env"])),
            "db_password": StringVar(value=str(defaults["db_password"])),
            "admin_email": StringVar(value=str(defaults["admin_email"])),
            "admin_name": StringVar(value=str(defaults["admin_name"])),
            "admin_password": StringVar(value=str(defaults["admin_password"])),
            "timezone": StringVar(value=str(defaults["timezone"])),
            "include_eunomia": BooleanVar(value=bool(defaults["include_eunomia"])),
            "ollama_url": StringVar(value=str(defaults["ollama_url"])),
            "enable_study_agent": BooleanVar(value=bool(defaults["enable_study_agent"])),
            "enable_blackrabbit": BooleanVar(value=bool(defaults["enable_blackrabbit"])),
            "enable_fhir_to_cdm": BooleanVar(value=bool(defaults["enable_fhir_to_cdm"])),
            "enable_hecate": BooleanVar(value=bool(defaults["enable_hecate"])),
            "enable_orthanc": BooleanVar(value=bool(defaults["enable_orthanc"])),
            "enable_livekit": BooleanVar(value=bool(defaults["enable_livekit"])),
            "enable_solr": BooleanVar(value=bool(defaults["enable_solr"])),
            "livekit_url": StringVar(value=str(defaults["livekit_url"])),
            "livekit_api_key": StringVar(value=str(defaults["livekit_api_key"])),
            "livekit_api_secret": StringVar(value=str(defaults["livekit_api_secret"])),
            "orthanc_user": StringVar(value=str(defaults["orthanc_user"])),
            "orthanc_password": StringVar(value=str(defaults["orthanc_password"])),
            "nginx_port": StringVar(value=str(defaults["nginx_port"])),
            "postgres_port": StringVar(value=str(defaults["postgres_port"])),
            "redis_port": StringVar(value=str(defaults["redis_port"])),
            "ai_port": StringVar(value=str(defaults["ai_port"])),
            "solr_port": StringVar(value=str(defaults["solr_port"])),
            "solr_java_mem": StringVar(value=str(defaults["solr_java_mem"])),
            "upgrade": BooleanVar(value=False),
        }

    def _configure_styles(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")

        self.root.configure(background="#08060A")

        style.configure("App.TFrame", background="#08060A")
        style.configure("Hero.TFrame", background="#08060A")
        style.configure("Panel.TFrame", background="#0E0E11")
        style.configure("Glass.TLabelframe", background="#121217", bordercolor="#3A3A42", relief="solid")
        style.configure("Glass.TLabelframe.Label", background="#121217", foreground="#F3EFE7", font=("Helvetica", 11, "bold"))
        style.configure("Muted.TLabel", background="#121217", foreground="#B6AEA5")
        style.configure("HeroTitle.TLabel", background="#0E0E11", foreground="#F6F2EB", font=("Helvetica", 26, "bold"))
        style.configure("HeroBody.TLabel", background="#0E0E11", foreground="#D9D1C7", font=("Helvetica", 11))
        style.configure("Field.TLabel", background="#121217", foreground="#B6AEA5", font=("Helvetica", 9, "bold"))
        style.configure("Status.TLabel", background="#121217", foreground="#C7C0B6", font=("Helvetica", 10))
        style.configure("SectionTitle.TLabel", background="#121217", foreground="#F4EEE6", font=("Helvetica", 16, "bold"))
        style.configure("SectionBody.TLabel", background="#121217", foreground="#BEB5AA", font=("Helvetica", 10))
        style.configure("Glass.TCheckbutton", background="#121217", foreground="#E8E0D3")
        style.map("Glass.TCheckbutton", background=[("active", "#121217")], foreground=[("active", "#F6F2EB")])
        style.configure("Glass.TButton", background="#7F1526", foreground="#FFFFFF", bordercolor="#A91C34", focusthickness=0, padding=(10, 8))
        style.map(
            "Glass.TButton",
            background=[("active", "#98192D"), ("disabled", "#4A2430")],
            foreground=[("disabled", "#D8C8CC")],
        )
        style.configure("Secondary.TButton", background="#1A1A22", foreground="#E7DFD5", bordercolor="#474752", focusthickness=0, padding=(10, 8))
        style.map("Secondary.TButton", background=[("active", "#23232C")], foreground=[("disabled", "#8F8A84")])
        style.configure("Glass.TEntry", fieldbackground="#0B0B10", foreground="#F6F2EB", bordercolor="#41414E", insertcolor="#F6F2EB", padding=6)
        style.configure("Glass.TCombobox", fieldbackground="#0B0B10", foreground="#F6F2EB", bordercolor="#41414E", arrowsize=14, padding=6)
        style.map("Glass.TCombobox", fieldbackground=[("readonly", "#0B0B10")], foreground=[("readonly", "#F6F2EB")])
        style.configure("Glass.TNotebook", background="#121217", borderwidth=0)
        style.configure("Glass.TNotebook.Tab", background="#17171D", foreground="#BFB7AD", padding=(12, 8))
        style.map("Glass.TNotebook.Tab", background=[("selected", "#7F1526")], foreground=[("selected", "#FFFFFF")])

    def _load_background_image(self) -> PhotoImage | None:
        image_path = launcher.resource_path("frontend/public/parthenon-login-bg.png")
        if not image_path.exists():
            return None
        try:
            return PhotoImage(file=str(image_path))
        except Exception:
            return None

    def _build_layout(self) -> None:
        outer = ttk.Frame(self.root, style="App.TFrame", padding=0)
        outer.pack(fill="both", expand=True)
        outer.columnconfigure(0, weight=11)
        outer.columnconfigure(1, weight=0)
        outer.columnconfigure(2, weight=13)
        outer.rowconfigure(0, weight=1)

        hero = tk.Canvas(outer, highlightthickness=0, bg="#08060A")
        hero.grid(row=0, column=0, sticky="nsew")
        self.hero_canvas = hero
        self.hero_background = self._load_background_image()
        if self.hero_background is not None:
            hero.create_image(0, 0, image=self.hero_background, anchor="nw")
        hero.create_rectangle(0, 0, 1200, 1200, fill="#08060A", stipple="gray50", outline="")
        hero.create_rectangle(0, 0, 1200, 1200, fill="#0F2134", stipple="gray75", outline="")
        hero.create_rectangle(120, 120, 620, 760, fill="#111010", stipple="gray50", outline="#4D4D56", width=1)
        hero.create_line(150, 170, 205, 170, fill="#C3273F", width=4)
        hero.create_text(150, 215, text="Parthenon", anchor="nw", fill="#F7F1E8", font=("Helvetica", 30, "bold"))
        hero.create_text(150, 265, text="Unified Outcomes Research Platform", anchor="nw", fill="#D8CDC0", font=("Helvetica", 14))
        hero.create_text(
            150,
            315,
            text=(
                "A researcher-facing installer with the same atmosphere as the login page:\n"
                "hero image, dark glass panels, and a single guided path into deployment."
            ),
            anchor="nw",
            fill="#C7BEB4",
            font=("Helvetica", 11),
            width=410,
        )
        hero.create_text(
            150,
            420,
            text="Cohorts  •  Characterization  •  Estimation  •  Prediction  •  Imaging  •  GIS",
            anchor="nw",
            fill="#AEA59A",
            font=("Courier", 10),
            width=410,
        )

        divider = tk.Frame(outer, bg="#C3273F", width=2)
        divider.grid(row=0, column=1, sticky="ns")

        right_shell = tk.Frame(outer, bg="#0E0E11", highlightthickness=0)
        right_shell.grid(row=0, column=2, sticky="nsew")
        right_shell.grid_columnconfigure(0, weight=1)
        right_shell.grid_rowconfigure(0, weight=1)

        right_glow = tk.Canvas(right_shell, highlightthickness=0, bg="#0E0E11")
        right_glow.place(relx=1.0, rely=0.0, anchor="ne", width=320, height=280)
        right_glow.create_oval(-30, -180, 360, 220, fill="#7F1526", outline="", stipple="gray50")

        card = ttk.Frame(right_shell, style="Panel.TFrame", padding=18)
        card.grid(row=0, column=0, sticky="nsew", padx=28, pady=28)
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(1, weight=1)

        card_header = ttk.Frame(card, style="Panel.TFrame")
        card_header.grid(row=0, column=0, sticky="ew", pady=(0, 14))
        ttk.Label(card_header, text="Install Parthenon", style="HeroTitle.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(card_header, text="Configure, validate, and launch the installer from a glassmorphic control surface.", style="HeroBody.TLabel").grid(row=1, column=0, sticky="w", pady=(6, 0))

        notebook = ttk.Notebook(card, style="Glass.TNotebook")
        notebook.grid(row=1, column=0, sticky="nsew")
        self.notebook = notebook

        config_tab = ttk.Frame(notebook, style="Panel.TFrame", padding=8)
        config_tab.columnconfigure(0, weight=1)
        config_tab.rowconfigure(0, weight=1)
        notebook.add(config_tab, text="Configuration")
        self.config_tab = config_tab

        install_tab = ttk.Frame(notebook, style="Panel.TFrame", padding=8)
        install_tab.columnconfigure(0, weight=1)
        install_tab.rowconfigure(0, weight=1)
        notebook.add(install_tab, text="Install Output")
        self.install_tab = install_tab

        success_tab = ttk.Frame(notebook, style="Panel.TFrame", padding=8)
        success_tab.columnconfigure(0, weight=1)
        success_tab.rowconfigure(0, weight=1)
        notebook.add(success_tab, text="Success")
        self.success_tab = success_tab

        self._build_wizard(config_tab)

        log_frame = ttk.LabelFrame(install_tab, text="Installer Output", style="Glass.TLabelframe", padding=12)
        log_frame.grid(row=0, column=0, sticky="nsew")
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)

        self.log_widget = scrolledtext.ScrolledText(
            log_frame,
            wrap="word",
            state="disabled",
            height=18,
            background="#0B0B10",
            foreground="#F3EDE4",
            insertbackground="#F3EDE4",
            borderwidth=0,
            relief="flat",
            font=("Courier", 10),
            padx=12,
            pady=12,
        )
        self.log_widget.grid(row=0, column=0, sticky="nsew")

        success_frame = ttk.LabelFrame(success_tab, text="Installation Complete", style="Glass.TLabelframe", padding=12)
        success_frame.grid(row=0, column=0, sticky="nsew")
        success_frame.columnconfigure(0, weight=1)
        success_frame.rowconfigure(0, weight=1)
        self.success_widget = scrolledtext.ScrolledText(
            success_frame,
            wrap="word",
            state="disabled",
            height=18,
            background="#0B0B10",
            foreground="#F3EDE4",
            insertbackground="#F3EDE4",
            borderwidth=0,
            relief="flat",
            font=("Courier", 10),
            padx=12,
            pady=12,
        )
        self.success_widget.grid(row=0, column=0, sticky="nsew")

    def _build_wizard(self, parent: ttk.Frame) -> None:
        shell = ttk.Frame(parent, style="Panel.TFrame")
        shell.grid(row=0, column=0, sticky="nsew")
        shell.columnconfigure(0, weight=0)
        shell.columnconfigure(1, weight=1)
        shell.rowconfigure(0, weight=1)

        sidebar = tk.Frame(shell, bg="#121217", width=210, highlightthickness=1, highlightbackground="#3A3A42")
        sidebar.grid(row=0, column=0, sticky="nsw", padx=(0, 18))
        sidebar.grid_propagate(False)

        tk.Label(
            sidebar,
            text="Setup Flow",
            bg="#121217",
            fg="#F4EEE6",
            font=("Helvetica", 15, "bold"),
            anchor="w",
            padx=18,
            pady=18,
        ).pack(fill="x")
        tk.Label(
            sidebar,
            text="Move step by step, validate at review, then launch installation.",
            bg="#121217",
            fg="#AFA79D",
            font=("Helvetica", 10),
            justify="left",
            wraplength=170,
            anchor="w",
            padx=18,
            pady=0,
        ).pack(fill="x")

        for step in self.step_order:
            card = tk.Frame(sidebar, bg="#17171D", highlightthickness=1, highlightbackground="#2B2B34", padx=12, pady=10)
            card.pack(fill="x", padx=14, pady=8)
            title = tk.Label(card, text=self.step_titles[step], bg="#17171D", fg="#EDE5DA", font=("Helvetica", 11, "bold"), anchor="w")
            title.pack(fill="x")
            subtitle = tk.Label(card, text=self.step_subtitles[step], bg="#17171D", fg="#988F84", font=("Helvetica", 9), anchor="w")
            subtitle.pack(fill="x", pady=(3, 0))
            self.step_nav_labels[step] = card

        content_shell = ttk.Frame(shell, style="Panel.TFrame")
        content_shell.grid(row=0, column=1, sticky="nsew")
        content_shell.columnconfigure(0, weight=1)
        content_shell.rowconfigure(1, weight=1)
        content_shell.rowconfigure(2, weight=0)

        header = ttk.Frame(content_shell, style="Panel.TFrame")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 14))
        self.step_title_var = StringVar(value="")
        self.step_body_var = StringVar(value="")
        ttk.Label(header, textvariable=self.step_title_var, style="SectionTitle.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(header, textvariable=self.step_body_var, style="SectionBody.TLabel").grid(row=1, column=0, sticky="w", pady=(4, 0))

        content = ttk.Frame(content_shell, style="Panel.TFrame")
        content.grid(row=1, column=0, sticky="nsew")
        content.columnconfigure(0, weight=1)
        content.rowconfigure(0, weight=1)
        self.step_content = content

        self._build_step_launch(content)
        self._build_step_preflight(content)
        self._build_step_basics(content)
        self._build_step_credentials(content)
        self._build_step_capabilities(content)
        self._build_step_review(content)

        actions = ttk.LabelFrame(content_shell, text="Actions", style="Glass.TLabelframe", padding=10)
        actions.grid(row=2, column=0, sticky="ew", pady=(16, 0))
        actions.columnconfigure(0, weight=1)

        ttk.Checkbutton(actions, text="Upgrade existing installation", variable=self.vars["upgrade"], style="Glass.TCheckbutton").grid(row=0, column=0, sticky="w")

        button_row = ttk.Frame(actions, style="Panel.TFrame")
        button_row.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        self.back_button = ttk.Button(button_row, text="Back", command=self._go_prev_step, style="Secondary.TButton")
        self.back_button.pack(side="left")
        self.next_button = ttk.Button(button_row, text="Next", command=self._go_next_step, style="Secondary.TButton")
        self.next_button.pack(side="left", padx=(8, 0))
        self.validate_button = ttk.Button(button_row, text="Validate", command=self._validate_only, style="Secondary.TButton")
        self.validate_button.pack(side="left", padx=(20, 0))
        self.start_button = ttk.Button(button_row, text="Start Installation", command=self._start_install, style="Glass.TButton")
        self.start_button.pack(side="left", padx=(8, 0))

        self.status_var = StringVar(value="Ready")
        ttk.Label(actions, textvariable=self.status_var, style="Status.TLabel").grid(row=2, column=0, sticky="w", pady=(10, 0))
        self._show_step(0)

    def _build_step_frame(self, parent: ttk.Frame, key: str) -> ttk.Frame:
        frame = ttk.Frame(parent, style="Panel.TFrame", padding=0)
        frame.grid(row=0, column=0, sticky="nsew")
        frame.columnconfigure(0, weight=1)
        self.step_frames[key] = frame
        return frame

    def _build_step_launch(self, parent: ttk.Frame) -> None:
        frame = self._build_step_frame(parent, "launch")
        launch = ttk.LabelFrame(frame, text="Launch Context", style="Glass.TLabelframe", padding=12)
        launch.grid(row=0, column=0, sticky="ew")
        self._add_labeled_entry(launch, "Parthenon repo path", "repo_path", 0)
        ttk.Button(launch, text="Browse", command=self._browse_repo_path, style="Secondary.TButton").grid(row=0, column=2, sticky="e", padx=(8, 0))
        if launcher.is_windows_host():
            self._add_labeled_entry(launch, "WSL distro", "wsl_distro", 1)
            self._add_labeled_entry(launch, "WSL repo path", "wsl_repo_path", 2)

    def _build_step_basics(self, parent: ttk.Frame) -> None:
        frame = self._build_step_frame(parent, "basics")
        basics = ttk.LabelFrame(frame, text="Deployment Defaults", style="Glass.TLabelframe", padding=12)
        basics.grid(row=0, column=0, sticky="ew")
        self._add_labeled_combobox(basics, "Experience", "experience", config.EXPERIENCE_CHOICES, 0)
        self._add_labeled_combobox(basics, "CDM database", "cdm_dialect", config.CDM_DIALECT_CHOICES, 1)
        self._add_labeled_entry(basics, "App URL", "app_url", 2)
        self._add_labeled_combobox(basics, "Environment", "env", config.ENV_CHOICES, 3)
        self._add_labeled_entry(basics, "Timezone", "timezone", 4)
        self._add_labeled_entry(basics, "Ollama URL", "ollama_url", 5)
        ttk.Checkbutton(
            basics,
            text="Load Eunomia demo CDM",
            variable=self.vars["include_eunomia"],
            style="Glass.TCheckbutton",
        ).grid(row=6, column=0, columnspan=2, sticky="w", pady=(8, 0))

        vocab = ttk.LabelFrame(frame, text="Vocabulary", style="Glass.TLabelframe", padding=12)
        vocab.grid(row=1, column=0, sticky="ew", pady=(14, 0))
        ttk.Label(vocab, text="Athena vocabulary ZIP", style="Field.TLabel").grid(row=0, column=0, sticky="w")
        vocab_entry = ttk.Entry(vocab, textvariable=self.vars["vocab_zip_path"], style="Glass.TEntry")
        vocab_entry.grid(row=0, column=1, sticky="ew", padx=(8, 8))
        self.entry_widgets["vocab_zip_path"] = vocab_entry
        ttk.Button(vocab, text="Browse", command=self._browse_vocab_zip, style="Secondary.TButton").grid(row=0, column=2, sticky="e")
        vocab.columnconfigure(1, weight=1)
        self.vocab_frame = vocab

    def _build_step_preflight(self, parent: ttk.Frame) -> None:
        frame = self._build_step_frame(parent, "preflight")
        toolbar = ttk.Frame(frame, style="Panel.TFrame")
        toolbar.grid(row=0, column=0, sticky="ew", pady=(0, 12))
        ttk.Button(toolbar, text="Run Preflight Checks", command=self._run_preflight_checks, style="Secondary.TButton").pack(side="left")
        self.preflight_status_var = StringVar(value="Checks have not been run yet.")
        ttk.Label(toolbar, textvariable=self.preflight_status_var, style="Status.TLabel").pack(side="left", padx=(12, 0))

        summary = ttk.LabelFrame(frame, text="System Readiness", style="Glass.TLabelframe", padding=12)
        summary.grid(row=1, column=0, sticky="nsew")
        summary.columnconfigure(0, weight=1)
        summary.rowconfigure(0, weight=1)
        self.preflight_widget = scrolledtext.ScrolledText(
            summary,
            wrap="word",
            state="disabled",
            height=20,
            background="#0B0B10",
            foreground="#F3EDE4",
            insertbackground="#F3EDE4",
            borderwidth=0,
            relief="flat",
            font=("Courier", 10),
            padx=12,
            pady=12,
        )
        self.preflight_widget.grid(row=0, column=0, sticky="nsew")

    def _build_step_credentials(self, parent: ttk.Frame) -> None:
        frame = self._build_step_frame(parent, "credentials")
        credentials = ttk.LabelFrame(frame, text="Credentials", style="Glass.TLabelframe", padding=12)
        credentials.grid(row=0, column=0, sticky="ew")
        self._add_labeled_entry(credentials, "Admin email", "admin_email", 0)
        self._add_labeled_entry(credentials, "Admin name", "admin_name", 1)
        self._add_labeled_entry(credentials, "Admin password", "admin_password", 2, show="*")
        self._add_labeled_entry(credentials, "DB password", "db_password", 3, show="*")
        button_bar = ttk.Frame(credentials, style="Panel.TFrame")
        button_bar.grid(row=4, column=0, columnspan=2, sticky="w", pady=(8, 0))
        ttk.Button(button_bar, text="Generate Admin Password", command=self._regen_admin_password, style="Secondary.TButton").pack(side="left")
        ttk.Button(button_bar, text="Generate DB Password", command=self._regen_db_password, style="Secondary.TButton").pack(side="left", padx=(8, 0))

    def _build_step_capabilities(self, parent: ttk.Frame) -> None:
        frame = self._build_step_frame(parent, "capabilities")

        modules = ttk.LabelFrame(frame, text="Modules", style="Glass.TLabelframe", padding=12)
        modules.grid(row=0, column=0, sticky="ew")
        ttk.Checkbutton(modules, text="Research", variable=self.module_vars["research"], style="Glass.TCheckbutton").grid(row=0, column=0, sticky="w")
        ttk.Checkbutton(modules, text="Commons", variable=self.module_vars["commons"], style="Glass.TCheckbutton").grid(row=0, column=1, sticky="w")
        ttk.Checkbutton(modules, text="AI & Knowledge", variable=self.module_vars["ai_knowledge"], style="Glass.TCheckbutton").grid(row=1, column=0, sticky="w")
        ttk.Checkbutton(modules, text="Data Pipeline", variable=self.module_vars["data_pipeline"], style="Glass.TCheckbutton").grid(row=1, column=1, sticky="w")
        ttk.Checkbutton(modules, text="Infrastructure", variable=self.module_vars["infrastructure"], style="Glass.TCheckbutton").grid(row=2, column=0, sticky="w")

        features = ttk.LabelFrame(frame, text="Optional Services", style="Glass.TLabelframe", padding=12)
        features.grid(row=1, column=0, sticky="ew", pady=(14, 0))
        ttk.Checkbutton(features, text="Study Designer", variable=self.vars["enable_study_agent"], style="Glass.TCheckbutton").grid(row=0, column=0, sticky="w")
        ttk.Checkbutton(features, text="Hecate", variable=self.vars["enable_hecate"], style="Glass.TCheckbutton").grid(row=0, column=1, sticky="w")
        ttk.Checkbutton(features, text="BlackRabbit", variable=self.vars["enable_blackrabbit"], style="Glass.TCheckbutton").grid(row=1, column=0, sticky="w")
        ttk.Checkbutton(features, text="FHIR-to-CDM", variable=self.vars["enable_fhir_to_cdm"], style="Glass.TCheckbutton").grid(row=1, column=1, sticky="w")
        ttk.Checkbutton(features, text="Orthanc", variable=self.vars["enable_orthanc"], style="Glass.TCheckbutton").grid(row=2, column=0, sticky="w")
        ttk.Checkbutton(features, text="LiveKit", variable=self.vars["enable_livekit"], style="Glass.TCheckbutton").grid(row=2, column=1, sticky="w")
        ttk.Checkbutton(features, text="Apache Solr", variable=self.vars["enable_solr"], style="Glass.TCheckbutton").grid(row=3, column=0, sticky="w")

        integrations = ttk.LabelFrame(frame, text="Service Credentials", style="Glass.TLabelframe", padding=12)
        integrations.grid(row=2, column=0, sticky="ew", pady=(14, 0))
        self._add_labeled_entry(integrations, "LiveKit URL", "livekit_url", 0)
        self._add_labeled_entry(integrations, "LiveKit API key", "livekit_api_key", 1)
        self._add_labeled_entry(integrations, "LiveKit API secret", "livekit_api_secret", 2, show="*")
        self._add_labeled_entry(integrations, "Orthanc user", "orthanc_user", 3)
        self._add_labeled_entry(integrations, "Orthanc password", "orthanc_password", 4, show="*")
        self.livekit_fields = ["livekit_url", "livekit_api_key", "livekit_api_secret"]
        self.orthanc_fields = ["orthanc_user", "orthanc_password"]

        ports = ttk.LabelFrame(frame, text="Ports", style="Glass.TLabelframe", padding=12)
        ports.grid(row=3, column=0, sticky="ew", pady=(14, 0))
        self._add_labeled_entry(ports, "NGINX", "nginx_port", 0)
        self._add_labeled_entry(ports, "Postgres", "postgres_port", 1)
        self._add_labeled_entry(ports, "Redis", "redis_port", 2)
        self._add_labeled_entry(ports, "AI", "ai_port", 3)
        self._add_labeled_entry(ports, "Solr", "solr_port", 4)
        self._add_labeled_entry(ports, "Solr JVM memory", "solr_java_mem", 5)
        self.solr_widgets = [ports.grid_slaves(row=4, column=1)[0], ports.grid_slaves(row=4, column=0)[0], ports.grid_slaves(row=5, column=1)[0], ports.grid_slaves(row=5, column=0)[0]]

    def _build_step_review(self, parent: ttk.Frame) -> None:
        frame = self._build_step_frame(parent, "review")
        summary = ttk.LabelFrame(frame, text="Review Configuration", style="Glass.TLabelframe", padding=12)
        summary.grid(row=0, column=0, sticky="nsew")
        summary.columnconfigure(0, weight=1)
        summary.rowconfigure(0, weight=1)
        self.review_widget = scrolledtext.ScrolledText(
            summary,
            wrap="word",
            state="disabled",
            height=22,
            background="#0B0B10",
            foreground="#F3EDE4",
            insertbackground="#F3EDE4",
            borderwidth=0,
            relief="flat",
            font=("Courier", 10),
            padx=12,
            pady=12,
        )
        self.review_widget.grid(row=0, column=0, sticky="nsew")

    def _show_step(self, index: int) -> None:
        self.current_step_index = max(0, min(index, len(self.step_order) - 1))
        current_key = self.step_order[self.current_step_index]
        self.step_frames[current_key].tkraise()

        self.step_title_var.set(self.step_titles[current_key])
        self.step_body_var.set(self.step_subtitles[current_key])
        self._update_step_nav()
        self._update_navigation_buttons()
        if current_key == "review":
            self._populate_review()

    def _update_step_nav(self) -> None:
        current_key = self.step_order[self.current_step_index]
        for idx, key in enumerate(self.step_order):
            card = self.step_nav_labels[key]
            if key == current_key:
                bg = "#7F1526"
                title_fg = "#FFFFFF"
                subtitle_fg = "#F0D6DB"
            elif idx < self.current_step_index:
                bg = "#1B2028"
                title_fg = "#E8DED2"
                subtitle_fg = "#AA9F93"
            else:
                bg = "#17171D"
                title_fg = "#EDE5DA"
                subtitle_fg = "#988F84"
            card.configure(bg=bg, highlightbackground="#3A3A42")
            for child in card.winfo_children():
                child.configure(bg=bg)
            card.winfo_children()[0].configure(fg=title_fg)
            card.winfo_children()[1].configure(fg=subtitle_fg)

    def _update_navigation_buttons(self) -> None:
        current_key = self.step_order[self.current_step_index]
        self.back_button.state(["disabled"] if self.current_step_index == 0 else ["!disabled"])
        if current_key == "review":
            self.next_button.state(["disabled"])
            self.validate_button.state(["!disabled"])
            self.start_button.state(["!disabled"] if not self.install_running else ["disabled"])
        else:
            self.next_button.state(["!disabled"])
            self.validate_button.state(["disabled"])
            self.start_button.state(["disabled"])

    def _go_prev_step(self) -> None:
        if self.current_step_index > 0:
            self._show_step(self.current_step_index - 1)

    def _go_next_step(self) -> None:
        if not self._validate_current_step():
            return
        if self.current_step_index < len(self.step_order) - 1:
            self._show_step(self.current_step_index + 1)

    def _populate_review(self) -> None:
        payload = self._collect_form_data()
        lines = [
            "Launch context",
            f"  Repo path: {payload['repo_path'] or '(default)'}",
        ]
        if launcher.is_windows_host():
            lines.append(f"  WSL distro: {payload['wsl_distro'] or '(default)'}")
            lines.append(f"  WSL repo path: {payload['wsl_repo_path'] or '(derived from repo path)'}")

        lines += [
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
            f"  Upgrade existing install: {'yes' if self.vars['upgrade'].get() else 'no'}",
        ]
        self.review_widget.configure(state="normal")
        self.review_widget.delete("1.0", "end")
        self.review_widget.insert("1.0", "\n".join(lines))
        self.review_widget.configure(state="disabled")

    @contextmanager
    def _use_repo_root(self, repo_path: str):
        original_repo_root = utils.REPO_ROOT
        try:
            resolved = launcher.validate_repo_path(repo_path or launcher.default_repo_path())
            utils.REPO_ROOT = resolved
            yield resolved
        finally:
            utils.REPO_ROOT = original_repo_root

    def _group_preflight_checks(
        self,
        checks: list[preflight.CheckResult],
    ) -> list[tuple[str, list[preflight.CheckResult], str]]:
        grouped: list[tuple[str, list[preflight.CheckResult], str]] = []

        runtime = [
            c for c in checks
            if c.name in {
                "Python ≥ 3.9",
                "Operating system",
                "Docker ≥ 24.0",
                "Docker Compose v2",
                "Docker daemon",
                "Linux docker group",
            }
        ]
        workspace = [c for c in checks if c.name in {"Disk space ≥ 5 GB", "Repo complete", "Existing install", "PHP vendor dir", "Hecate bootstrap assets"}]
        ports = [c for c in checks if c.name.startswith("Port ")]

        if runtime:
            grouped.append((
                "Runtime Dependencies",
                runtime,
                "Fix Docker, Compose, Python, or Linux docker-group issues before attempting installation.",
            ))
        if workspace:
            grouped.append((
                "Workspace Readiness",
                workspace,
                "Confirm you selected the correct Parthenon repo and that the machine has enough free disk space.",
            ))
        if ports:
            grouped.append((
                "Port Availability",
                ports,
                "Free the listed ports or change the mapped ports later in the wizard before running the installer.",
            ))

        return grouped

    def _format_preflight_report(self, checks: list[preflight.CheckResult], repo_path: str) -> str:
        icons = {"ok": "OK", "warn": "WARN", "fail": "FAIL"}
        failures = [c for c in checks if c.status == "fail"]
        warnings = [c for c in checks if c.status == "warn"]

        lines = [
            "Preflight Summary",
            f"  Repo root: {repo_path}",
            f"  Checks run: {len(checks)}",
            f"  Failures: {len(failures)}",
            f"  Warnings: {len(warnings)}",
            "",
        ]

        for title, section_checks, guidance in self._group_preflight_checks(checks):
            lines.append(title)
            lines.append(f"  Action: {guidance}")
            for check in section_checks:
                lines.append(f"  [{icons[check.status]:>4}] {check.name}: {check.detail}")
            lines.append("")

        return "\n".join(lines).rstrip()

    def _run_preflight_checks(self) -> None:
        payload = self._collect_form_data()
        try:
            launch_context = self._validate_launch_context(payload)
            if launcher.is_windows_host():
                raise ValueError(
                    "Windows GUI preflight is not yet mirrored through WSL. "
                    "Run preflight from the target Linux environment for now."
                )
            with self._use_repo_root(launch_context["repo_path"]) as repo_root:
                checks = preflight.run_checks(payload)
        except Exception as exc:
            messagebox.showerror("Preflight failed", str(exc))
            self.preflight_status_var.set(f"Preflight could not run: {exc}")
            self.preflight_widget.configure(state="normal")
            self.preflight_widget.delete("1.0", "end")
            self.preflight_widget.insert("1.0", str(exc))
            self.preflight_widget.configure(state="disabled")
            return

        self.last_preflight_results = checks
        failures = [c for c in checks if c.status == "fail"]
        warnings = [c for c in checks if c.status == "warn"]
        if failures:
            status = f"{len(failures)} failure(s), {len(warnings)} warning(s)"
        elif warnings:
            status = f"Passed with {len(warnings)} warning(s)"
        else:
            status = "All checks passed"
        self.preflight_status_var.set(status)
        self.preflight_widget.configure(state="normal")
        self.preflight_widget.delete("1.0", "end")
        self.preflight_widget.insert("1.0", self._format_preflight_report(checks, str(repo_root)))
        self.preflight_widget.configure(state="disabled")

    def _validate_current_step(self) -> bool:
        current_key = self.step_order[self.current_step_index]
        try:
            payload = self._collect_form_data()
            if current_key == "launch":
                self._validate_launch_context(payload)
            elif current_key == "preflight":
                if not self.last_preflight_results:
                    raise ValueError("Run preflight checks before continuing")
                failures = [c for c in self.last_preflight_results if c.status == "fail"]
                if failures:
                    raise ValueError("Resolve preflight failures before continuing")
            elif current_key == "basics":
                partial = {
                    "experience": payload["experience"],
                    "vocab_zip_path": payload["vocab_zip_path"],
                    "cdm_dialect": payload["cdm_dialect"],
                    "app_url": payload["app_url"],
                    "env": payload["env"],
                    "timezone": payload["timezone"],
                    "include_eunomia": payload["include_eunomia"],
                    "ollama_url": payload["ollama_url"],
                }
                config.validate_config(partial)
            elif current_key == "credentials":
                partial = {
                    "admin_email": payload["admin_email"],
                    "admin_name": payload["admin_name"],
                    "admin_password": payload["admin_password"],
                    "db_password": payload["db_password"],
                }
                config.validate_config(partial)
            elif current_key == "capabilities":
                config.validate_config(payload)
            elif current_key == "review":
                self._validate_launch_context(payload)
                config.validate_config(payload)
        except Exception as exc:
            messagebox.showerror("Step validation failed", str(exc))
            self._set_status(f"Validation failed: {exc}")
            return False
        return True

    def _populate_success(self) -> None:
        cfg = self.last_install_summary or {}
        lines = [
            "Parthenon installed successfully.",
            "",
            f"URL: {cfg.get('app_url', '(see install log)')}",
            f"Admin email: {cfg.get('admin_email', '(see install log)')}",
            "Admin password: saved to .install-credentials",
            "Database password: saved to .install-credentials",
        ]
        if cfg.get("enable_solr"):
            lines.append(f"Solr: http://localhost:{cfg.get('solr_port', 8983)}/solr/")
        if cfg.get("enable_study_agent"):
            lines.append("Study AI: http://localhost:8765")
        if cfg.get("enable_blackrabbit"):
            lines.append("Profiler: http://localhost:8090")
        if cfg.get("enable_fhir_to_cdm"):
            lines.append("FHIR CDM: http://localhost:8091")
        if cfg.get("enable_hecate"):
            lines.append("Hecate: http://localhost:8088")
        self.success_widget.configure(state="normal")
        self.success_widget.delete("1.0", "end")
        self.success_widget.insert("1.0", "\n".join(lines))
        self.success_widget.configure(state="disabled")

    def _add_labeled_entry(
        self,
        parent: ttk.LabelFrame,
        label: str,
        key: str,
        row: int,
        *,
        show: str | None = None,
    ) -> None:
        ttk.Label(parent, text=label, style="Field.TLabel").grid(row=row, column=0, sticky="w", pady=3)
        entry = ttk.Entry(parent, textvariable=self.vars[key], show=show or "", style="Glass.TEntry")
        entry.grid(row=row, column=1, sticky="ew", padx=(8, 0), pady=3)
        parent.columnconfigure(1, weight=1)
        self.entry_widgets[key] = entry

    def _add_labeled_combobox(
        self,
        parent: ttk.LabelFrame,
        label: str,
        key: str,
        values: list[str],
        row: int,
    ) -> None:
        ttk.Label(parent, text=label, style="Field.TLabel").grid(row=row, column=0, sticky="w", pady=3)
        box = ttk.Combobox(parent, textvariable=self.vars[key], values=values, state="readonly", style="Glass.TCombobox")
        box.grid(row=row, column=1, sticky="ew", padx=(8, 0), pady=3)
        parent.columnconfigure(1, weight=1)

    def _bind_refresh_hooks(self) -> None:
        self.vars["experience"].trace_add("write", lambda *_: self._refresh_dependencies())
        self.vars["enable_livekit"].trace_add("write", lambda *_: self._refresh_dependencies())
        self.vars["enable_orthanc"].trace_add("write", lambda *_: self._refresh_dependencies())
        self.vars["enable_solr"].trace_add("write", lambda *_: self._refresh_dependencies())
        for key in self.module_vars:
            self.module_vars[key].trace_add("write", lambda *_: self._refresh_dependencies())

    def _refresh_dependencies(self) -> None:
        first_time = self.vars["experience"].get() == "First-time"
        self._set_frame_state(self.vocab_frame, enabled=not first_time)

        commons_enabled = self.module_vars["commons"].get()
        pipeline_enabled = self.module_vars["data_pipeline"].get()
        research_enabled = self.module_vars["research"].get()
        ai_enabled = self.module_vars["ai_knowledge"].get()
        infra_enabled = self.module_vars["infrastructure"].get()

        if not commons_enabled:
            self.vars["enable_livekit"].set(False)
        if not pipeline_enabled:
            self.vars["enable_blackrabbit"].set(False)
            self.vars["enable_fhir_to_cdm"].set(False)
            self.vars["enable_orthanc"].set(False)
        if not research_enabled:
            self.vars["enable_study_agent"].set(False)
        if not ai_enabled:
            self.vars["enable_hecate"].set(False)
        if not infra_enabled:
            self.vars["enable_solr"].set(False)

        livekit_enabled = commons_enabled and self.vars["enable_livekit"].get()
        orthanc_enabled = pipeline_enabled and self.vars["enable_orthanc"].get()
        solr_enabled = infra_enabled and self.vars["enable_solr"].get()

        self._set_variable_entries(self.livekit_fields, enabled=livekit_enabled)
        self._set_variable_entries(self.orthanc_fields, enabled=orthanc_enabled)
        self._set_widgets_state(self.solr_widgets, enabled=solr_enabled)

    def _set_variable_entries(self, keys: list[str], *, enabled: bool) -> None:
        for key in keys:
            widget = self.entry_widgets.get(key)
            if widget is not None:
                widget.state(["!disabled"] if enabled else ["disabled"])

    def _set_widgets_state(self, widgets: list[object], *, enabled: bool) -> None:
        for widget in widgets:
            if hasattr(widget, "state"):
                widget.state(["!disabled"] if enabled else ["disabled"])

    def _set_frame_state(self, frame: ttk.LabelFrame, *, enabled: bool) -> None:
        for child in frame.winfo_children():
            if hasattr(child, "state"):
                child.state(["!disabled"] if enabled else ["disabled"])

    def _browse_vocab_zip(self) -> None:
        path = filedialog.askopenfilename(
            title="Select Athena vocabulary ZIP",
            filetypes=[("ZIP archives", "*.zip"), ("All files", "*.*")],
        )
        if path:
            self.vars["vocab_zip_path"].set(path)

    def _browse_repo_path(self) -> None:
        path = filedialog.askdirectory(title="Select Parthenon repository root")
        if path:
            self.vars["repo_path"].set(path)

    def _regen_admin_password(self) -> None:
        self.vars["admin_password"].set(config._generate_password(16))

    def _regen_db_password(self) -> None:
        self.vars["db_password"].set(config._generate_password(24))

    def _collect_form_data(self) -> dict[str, object]:
        modules = [key for key, var in self.module_vars.items() if var.get()]
        return {
            "repo_path": self.vars["repo_path"].get().strip(),
            "wsl_distro": self.vars["wsl_distro"].get().strip(),
            "wsl_repo_path": self.vars["wsl_repo_path"].get().strip(),
            "experience": self.vars["experience"].get(),
            "vocab_zip_path": self.vars["vocab_zip_path"].get().strip() or None,
            "cdm_dialect": self.vars["cdm_dialect"].get(),
            "app_url": self.vars["app_url"].get().strip(),
            "env": self.vars["env"].get(),
            "db_password": self.vars["db_password"].get(),
            "admin_email": self.vars["admin_email"].get().strip(),
            "admin_name": self.vars["admin_name"].get().strip(),
            "admin_password": self.vars["admin_password"].get(),
            "timezone": self.vars["timezone"].get().strip(),
            "include_eunomia": self.vars["include_eunomia"].get(),
            "ollama_url": self.vars["ollama_url"].get().strip(),
            "modules": modules,
            "enable_study_agent": self.vars["enable_study_agent"].get(),
            "enable_blackrabbit": self.vars["enable_blackrabbit"].get(),
            "enable_fhir_to_cdm": self.vars["enable_fhir_to_cdm"].get(),
            "enable_hecate": self.vars["enable_hecate"].get(),
            "enable_orthanc": self.vars["enable_orthanc"].get(),
            "enable_livekit": self.vars["enable_livekit"].get(),
            "enable_solr": self.vars["enable_solr"].get(),
            "livekit_url": self.vars["livekit_url"].get().strip(),
            "livekit_api_key": self.vars["livekit_api_key"].get().strip(),
            "livekit_api_secret": self.vars["livekit_api_secret"].get(),
            "orthanc_user": self.vars["orthanc_user"].get().strip(),
            "orthanc_password": self.vars["orthanc_password"].get(),
            "nginx_port": self.vars["nginx_port"].get().strip(),
            "postgres_port": self.vars["postgres_port"].get().strip(),
            "redis_port": self.vars["redis_port"].get().strip(),
            "ai_port": self.vars["ai_port"].get().strip(),
            "solr_port": self.vars["solr_port"].get().strip(),
            "solr_java_mem": self.vars["solr_java_mem"].get().strip(),
        }

    def _validate_only(self) -> None:
        try:
            payload = self._collect_form_data()
            normalized = config.validate_config(payload)
            self._validate_launch_context(payload)
        except Exception as exc:
            messagebox.showerror("Invalid configuration", str(exc))
            self._set_status(f"Validation failed: {exc}")
            return

        messagebox.showinfo("Configuration valid", "The installer configuration is valid.")
        self._set_status(f"Validated for {normalized['app_url']}")

    def _start_install(self) -> None:
        if self.install_running:
            return

        try:
            payload = self._collect_form_data()
            normalized = config.validate_config(payload)
            launch_context = self._validate_launch_context(payload)
        except Exception as exc:
            messagebox.showerror("Invalid configuration", str(exc))
            self._set_status(f"Validation failed: {exc}")
            return

        self.install_running = True
        self.last_install_summary = normalized
        self.notebook.select(self.install_tab)
        self.start_button.state(["disabled"])
        self.validate_button.state(["disabled"])
        self.next_button.state(["disabled"])
        self.back_button.state(["disabled"])
        self._set_status("Starting installer...")
        self._append_log("Preparing temporary defaults file...\n")

        self.install_thread = threading.Thread(
            target=self._run_install_process,
            args=(normalized, launch_context, bool(self.vars["upgrade"].get())),
            daemon=True,
        )
        self.install_thread.start()

    def _validate_launch_context(self, payload: dict[str, object]) -> dict[str, str]:
        repo_path = str(payload.get("repo_path") or "").strip()
        wsl_distro = str(payload.get("wsl_distro") or "").strip()
        wsl_repo_path = str(payload.get("wsl_repo_path") or "").strip()

        if launcher.is_windows_host():
            if not repo_path and not wsl_repo_path:
                raise ValueError("repo_path or wsl_repo_path is required on Windows")
            return {
                "repo_path": repo_path,
                "wsl_distro": wsl_distro,
                "wsl_repo_path": wsl_repo_path,
            }

        launcher.validate_repo_path(repo_path or launcher.default_repo_path())
        return {
            "repo_path": repo_path or launcher.default_repo_path(),
            "wsl_distro": "",
            "wsl_repo_path": "",
        }

    def _run_install_process(
        self,
        normalized: dict[str, object],
        launch_context: dict[str, str],
        upgrade: bool,
    ) -> None:
        temp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile("w", suffix=".json", prefix="parthenon-installer-", delete=False) as handle:
                json.dump(normalized, handle, indent=2)
                temp_path = handle.name

            cmd, cwd = launcher.build_install_command(
                defaults_path=temp_path,
                upgrade=upgrade,
                repo_path=launch_context["repo_path"],
                wsl_distro=launch_context["wsl_distro"],
                wsl_repo_path=launch_context["wsl_repo_path"],
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
                self.log_queue.put(line)
            rc = proc.wait()
            if rc == 0:
                self.log_queue.put("\nInstallation finished successfully.\n")
                self.log_queue.put("__STATUS__:Installation complete")
                self.log_queue.put("__SUCCESS__")
            else:
                self.log_queue.put(f"\nInstaller exited with status {rc}.\n")
                self.log_queue.put(f"__STATUS__:Installer failed with status {rc}")
        except Exception as exc:
            self.log_queue.put(f"\nLauncher error: {exc}\n")
            self.log_queue.put(f"__STATUS__:Launcher failed: {exc}")
        finally:
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)
            self.log_queue.put("__DONE__")

    def _poll_log_queue(self) -> None:
        try:
            while True:
                item = self.log_queue.get_nowait()
                if item == "__DONE__":
                    self.install_running = False
                    self._update_navigation_buttons()
                    continue
                if item == "__SUCCESS__":
                    self._populate_success()
                    self.notebook.select(self.success_tab)
                    continue
                if item.startswith("__STATUS__:"):
                    self._set_status(item.split(":", 1)[1])
                    continue
                self._append_log(item)
        except queue.Empty:
            pass
        finally:
            self.root.after(150, self._poll_log_queue)

    def _append_log(self, text: str) -> None:
        self.log_widget.configure(state="normal")
        self.log_widget.insert("end", text)
        self.log_widget.see("end")
        self.log_widget.configure(state="disabled")

    def _set_status(self, text: str) -> None:
        self.status_var.set(text)


def main() -> None:
    if TK_IMPORT_ERROR is not None:
        raise SystemExit(
            "tkinter is not installed. Install the OS Tk package before using clickme.py "
            f"({TK_IMPORT_ERROR})."
        )
    root = Tk()
    ttk.Style().theme_use("clam")
    InstallerGui(root)
    root.mainloop()


if __name__ == "__main__":
    main()
