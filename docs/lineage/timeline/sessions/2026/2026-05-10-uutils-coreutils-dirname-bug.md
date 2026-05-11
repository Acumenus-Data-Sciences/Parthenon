---
doc_type: lineage
status: historical
date: 2026-05-10
owner: acumenus
module: docs
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# 2026-05-10 — uutils-coreutils 0.2.x silently breaks `git subtree` on beastmode

## TL;DR

While running today's CE→EE subtree sync, `Parthenon-EE/scripts/sync-from-ce.sh` failed with the cryptic message:

```
fatal: can't squash-merge: '.' was never added.
```

Root cause was **not** in the script, the subtree state, or the EE repo. It was in `/usr/bin/dirname` itself: on **beastmode** that path resolves to `rust-coreutils` (uutils 0.2.2), whose `dirname "foo/."` returns `.` instead of `foo`. `/usr/lib/git-core/git-subtree` line 266 — `dir="$(dirname "$arg_prefix/.")"` — depends on the GNU/POSIX behaviour, so the prefix gets silently mangled into `.` and every `git subtree pull --squash` aborts before merging.

Fixed by patching `Parthenon-EE/scripts/sync-from-ce.sh` to detect the broken `dirname` at startup and prepend a PATH shim pointing at `/usr/bin/gnudirname` (committed as `e9a58ea92` in `Acumenus-Data-Sciences/Parthenon-EE`). Audited the rest of the toolchain for similar quirks; documented and saved a reference memory.

## What happened

Daily workflow: sync `Acumenus-Data-Sciences/Parthenon` → `Acumenus-Data-Sciences/Parthenon-EE` via the daily ce-sync mechanism. The CE pin was at `a38f285c` (PR #322 — composition contract). CE main had advanced to `ffab5c08` (Phase 2 wrap-up devlog) and then `69226f6e` (Dependabot PR #302, transformers upgrade) during the same session.

Ran `./scripts/sync-from-ce.sh` from `~/Github/Parthenon-EE/`. Output:

```
Syncing CE: a38f285c -> 69226f6e
Switched to a new branch 'sync/ce-main-20260510-170454'
fatal: can't squash-merge: '.' was never added.
Subtree merge had conflicts; pushing branch for maintainer review.
```

The "conflicts" branch on origin contained no merge — just the pre-merge state. `git log --grep "git-subtree-dir: parthenon"` confirmed both subtree marker commits (`13bf247db` merge, `3d0952a7f` squash) were intact and reachable from HEAD, with the correct `git-subtree-split: a38f285c…` trailer. Subtree state was fine.

## The hunt

Tried argument reordering (`--squash` before/after positional args, `-P` short form, `--prefix=parthenon/` with trailing slash). Same error every time.

Switched on `git subtree --debug pull` and got:

```
command: {pull}
quiet: {}
dir: {.}
opts: {ce-upstream main}
```

`dir: {.}` was the smoking gun. The prefix had become `.`.

`git-subtree.sh` line 266:

```sh
dir="$(dirname "$arg_prefix/.")"
```

Tested in isolation:

```
$ dirname "parthenon/."
.
$ /usr/bin/gnudirname "parthenon/."
parthenon
```

Two different binaries:

```
$ ls -la /usr/bin/dirname
/usr/bin/dirname -> ../lib/cargo/bin/coreutils/dirname

$ /usr/bin/dirname --version | head -1
dirname (uutils coreutils) 0.2.2

$ /usr/bin/gnudirname --version | head -1
dirname (GNU coreutils) 9.5
```

Ubuntu 24.10 ships **both** packages — `rust-coreutils` (uutils, takes `/usr/bin/<name>`) and `gnu-coreutils` (GNU, lives at `/usr/bin/gnu<name>`). On this host, the uutils version got priority. Its `dirname` doesn't follow POSIX for the `path/.` form.

This wasn't a bug in our code — but it's a bug *we* have to work around because git ships a script that calls `dirname "x/."` internally.

## The fix

Patched `Parthenon-EE/scripts/sync-from-ce.sh` to detect the broken `dirname` at startup and route around it via a temp PATH shim:

```sh
if [ "$(dirname 'parthenon/.' 2>/dev/null)" != 'parthenon' ]; then
  fallback_dirname=""
  for candidate in \
    "$(command -v gnudirname 2>/dev/null || true)" \
    /snap/core24/current/usr/bin/dirname \
    /snap/core22/current/usr/bin/dirname \
    /snap/core20/current/usr/bin/dirname; do
    if [ -n "$candidate" ] && [ -x "$candidate" ] \
       && [ "$("$candidate" 'parthenon/.' 2>/dev/null)" = 'parthenon' ]; then
      fallback_dirname="$candidate"
      break
    fi
  done
  if [ -z "$fallback_dirname" ]; then
    echo "FAIL: system 'dirname' is broken (likely uutils-coreutils 0.2.x) and no" >&2
    echo "      working GNU dirname is available. Install 'gnu-coreutils' …" >&2
    exit 65
  fi
  shim_dir="$(mktemp -d -t sync-from-ce-shim-XXXXXX)"
  trap 'rm -rf "$shim_dir"' EXIT
  ln -s "$fallback_dirname" "$shim_dir/dirname"
  PATH="$shim_dir:$PATH"
  export PATH
  echo "Note: system 'dirname' is broken; using $fallback_dirname via PATH shim." >&2
fi
```

Re-ran the sync — clean merge, `[ce-sync]` commit on EE main at `231646939`, pushed to origin. CE pin advanced from `a38f285c` → `69226f6e`.

The shim is **defensive**: it only activates when `dirname` is actually broken. On hosts with GNU `dirname` (the GitHub Actions runners that run `ce-sync.yml` daily), the detection probe returns `parthenon` and the script proceeds untouched. So this patch carries no cost in CI and rescues the local-runner case.

Committed as `e9a58ea92` in `Acumenus-Data-Sciences/Parthenon-EE`:

```
fix(sync): work around uutils-coreutils dirname bug in sync-from-ce.sh
```

## Comprehensive audit of uutils vs GNU

After fixing the immediate bug I audited 65 patterns across all uutils binaries to catch other latent quirks. Three real divergences:

| Tool | Pattern | uutils 0.2.2 | GNU 9.5 | Impact |
|---|---|---|---|---|
| `dirname` | `"x/."` | `.` | `x` | Breaks `git subtree`. **Fixed.** |
| `date -d` | `'2026-01-01' +%s` | `1767240000` | `1767243600` | **1-hour off**. uutils treats January as EDT (UTC-4) when local is EST (UTC-5). DST handling is broken for literal calendar dates. Forms that work: `@<epoch>`, `'1 day ago'`, `'last monday'`. |
| `stat <file>` | bare, no `-c` | lowercase `size:`, `Device: 10302h/66306d` | `Size:`, `Device: 259,2` | Cosmetic. `stat -c <fmt>` works identically on both. |

**Confirmed safe** (identical output across both): `basename`, `realpath`, `readlink`, `printf`, `seq`, `mktemp -d`, `head`, `tail`, `cut`, `sort`, `uniq`, `tr`, `du`, `env`, `ls`, `wc`, all `dirname` patterns except `path/.`, all `stat -c '<fmt>'` patterns.

### Project script audit

Greppd `Parthenon` and `Parthenon-EE` shell scripts and git hooks (`pre-commit`, `post-commit`, `pre-merge-commit`, `post-checkout`):

- **`dirname "$0"` / `dirname "${BASH_SOURCE[0]}"`**: many uses, all safe — never end in `/.`
- **`dirname "$x/."`**: zero project occurrences. Only `git-subtree` triggers it.
- **`date -d`**: zero project occurrences. (We dodge the DST bug by accident.)
- **`stat -c '<fmt>'`**: 4 occurrences (`%s`, `%Y`, `%U:%G %a`) — all use format strings, safe.
- **`mktemp`**: 8 occurrences, all template-based or `-d`, safe.

The only fix that was needed is the one already applied. No other Parthenon code paths touch a uutils quirk today.

## Why this surfaced now

We've been on Ubuntu 24.10 for a while, but `git subtree pull --squash` is a relatively rare operation — the Parthenon-EE bootstrap (Plan 03) was the first time we exercised it on this host. The very next sync after bootstrap tripped the bug. The daily ce-sync GitHub Action wouldn't have caught it: GHA Ubuntu runners ship GNU coreutils, not uutils, so the workflow runs cleanly there.

## Followups

None required for Parthenon code. The fix is in `Parthenon-EE` (private repo) where the affected script lives.

Three things to keep in mind going forward on this host:

1. **`date -d 'YYYY-MM-DD'` is a landmine.** Anything that converts a literal calendar date to epoch (backup retention scripts, log filename arithmetic, "find files older than X") will be wrong by 1 hour for winter dates. Prefer `date -d '@<epoch>'` or do the arithmetic in Python/Node.
2. **For new shell scripts**, prefer `${path%/*}` parameter expansion over `dirname` when the input might end in `/.`. Same shim pattern applies if a third-party tool calls `date -d` internally.
3. **Don't replace `/usr/bin/dirname` system-wide.** Mixing rust-coreutils and gnu-coreutils symlinks is the OS policy on Ubuntu 24.10; future apt upgrades will fight you.

A reference memory was added to `~/.claude/memory/reference_uutils_dirname_bug.md` so future Claude sessions skip straight to the fix instead of debugging from scratch.

## Files touched

- `Parthenon-EE/scripts/sync-from-ce.sh` — added dirname-detection shim (33 lines, commit `e9a58ea92`)
- `~/.claude/memory/reference_uutils_dirname_bug.md` (new) — audit results + workaround patterns
- `~/.claude/memory/MEMORY.md` — added "Host Quirks (beastmode)" section pointer
