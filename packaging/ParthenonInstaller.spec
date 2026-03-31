# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules


repo_root = Path.cwd()
hiddenimports = collect_submodules("installer")


a = Analysis(
    [str(repo_root / "clickme.py")],
    pathex=[str(repo_root)],
    binaries=[],
    datas=[
        (str(repo_root / "frontend" / "public" / "parthenon-login-bg.png"), "frontend/public"),
        (str(repo_root / "frontend" / "public" / "parthenon_icon.png"), "frontend/public"),
    ],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="ParthenonInstaller",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
