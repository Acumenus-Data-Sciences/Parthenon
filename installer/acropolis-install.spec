# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Acropolis remote installer single-file binary."""

import os

block_cipher = None

installer_dir = os.path.abspath(os.path.dirname(SPEC))

a = Analysis(
    [os.path.join(installer_dir, 'bootstrap_remote.py')],
    pathex=[os.path.dirname(installer_dir)],
    binaries=[],
    datas=[
        (os.path.join(installer_dir, 'web', '*'), 'installer/web'),
    ],
    hiddenimports=[
        'installer',
        'installer.webapp',
        'installer.config',
        'installer.preflight',
        'installer.launcher',
        'installer.utils',
        'installer.cli',
        'installer.bootstrap',
        'installer.docker_ops',
        'installer.demo_data',
        'installer.eunomia',
        'http.server',
        'json',
        'threading',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='acropolis-install',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
