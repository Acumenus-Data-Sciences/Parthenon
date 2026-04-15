#!/bin/sh
# ───────────────────────────────────────────────────────────────────
# finngen-artifacts-init.sh — s6-overlay cont-init oneshot
#
# Runs as root BEFORE the plumber service starts. Ensures the
# /opt/finngen-artifacts shared volume (mounted RW into both darkstar
# and php) is owned by ruser:ruser with group-setgid bit so files
# newly written by ruser inherit the group ownership.
#
# Task A1 created the volume and chgrp'd it to www-data. Darkstar
# runs as ruser, so B1 flips ownership back to ruser here.
#
# Cross-container write/delete permission tightening is handled by
# the artifact sweeper (C13).
# ───────────────────────────────────────────────────────────────────
set -e

TARGET="/opt/finngen-artifacts"

if [ ! -d "$TARGET" ]; then
    echo "[S6-INIT] $TARGET missing — creating"
    mkdir -p "$TARGET"
fi

mkdir -p "$TARGET/runs"
chown -R ruser:ruser "$TARGET"
chmod -R g+rwX "$TARGET"
# setgid on directories so new files inherit ruser group
find "$TARGET" -type d -exec chmod g+s {} \;
umask 002

echo "[S6-INIT] finngen-artifacts ownership + perms applied: $(stat -c '%U:%G %a' "$TARGET")"
