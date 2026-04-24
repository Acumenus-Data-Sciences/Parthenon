#!/bin/sh
# ───────────────────────────────────────────────────────────────────
# app-readable-init.sh — s6-overlay cont-init oneshot
#
# /app is bind-mounted from ./darkstar on the host. Host file permissions
# propagate into the container; if any R source ends up 0660 (no `others`
# read), the plumber service — which runs as ruser (uid 101, not a member
# of the host user's group) — cannot source() it and the launcher dies at
# startup with an opaque "cannot open file" error.
#
# Git tracks these files at mode 0644, which is already others-readable,
# but local umask / editor / post-chmod drift can silently break this.
# Making /app world-readable here is defense-in-depth; world-read on R
# source is harmless — the files are open-source and reachable from git
# anyway.
#
# HIGHSEC note: this ONLY relaxes read bits. It does not grant write or
# execute. The bind-mount prevents ruser from writing back to the host.
# ───────────────────────────────────────────────────────────────────
set -e

TARGET="/app"

if [ ! -d "$TARGET" ]; then
    echo "[S6-INIT] $TARGET missing — skipping app-readable-init"
    exit 0
fi

# +r on files, +rx on directories (need +x to traverse).
find "$TARGET" -type d -exec chmod o+rx {} + 2>/dev/null || true
find "$TARGET" -type f -exec chmod o+r  {} + 2>/dev/null || true

echo "[S6-INIT] /app made readable for ruser (defensive, bind-mount-safe)"
