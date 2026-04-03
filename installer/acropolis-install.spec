# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Acropolis remote installer binary.

The binary handles Phase 0 only (Docker detection, repo acquisition),
then spawns system Python to run install.py --webapp. No third-party
deps (rich, questionary) are needed — install.py bootstraps those.
"""

import os

block_cipher = None
installer_dir = os.path.abspath(os.path.dirname(SPEC))

a = Analysis(
    [os.path.join(installer_dir, 'bootstrap_remote.py')],
    pathex=[os.path.dirname(installer_dir)],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
    strip=False,
    upx=True,
    runtime_tmpdir=None,
    console=True,
)
