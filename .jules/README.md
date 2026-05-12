# `.jules/` — Jules persistent learnings

This directory is the persistent knowledge cabinet for the Jules coding
agent (`google-labs-jules[bot]`). Each [Jules
Skill](https://github.com/google-labs-code/jules-skills) writes a single
Markdown ledger here.

Jules itself looks at `AGENTS.md` in the repo root; that file points here.
**Read this directory before any new work in this repo, and append (do not
rewrite) when you learn something durable.**

## File-per-skill convention

| File | Skill | Scope |
|------|-------|-------|
| `jules.md` | Jules (base agent) | General codebase learnings, repo quirks, gotchas not covered by the specialised skills |
| `sentinel.md` | Sentinel | Security findings — vulnerabilities, fixes, prevention rules |
| `palette.md` | Palette | UX, accessibility (WCAG), i18n, design-system findings |
| `bolt.md` | Bolt | Performance, build, CI, dependency, and tooling findings |

If a new Jules Skill is introduced, create `.jules/<skill>.md` with the
same header convention and add a row to the table above.

## Entry schema

Every entry begins with a level-2 heading: `## YYYY-MM-DD - <Title>`.

**Sentinel** (security) entries use:

```markdown
## YYYY-MM-DD - [Category] Title
**Vulnerability:** What was wrong.
**Learning:** Why it was wrong — the general principle.
**Prevention:** How to avoid it next time, ideally as a rule a reviewer can apply.
```

**Palette / Bolt / Jules** entries use the lighter form:

```markdown
## YYYY-MM-DD - Title
**Learning:** What was discovered.
**Action:** What to do (or not do) next time.
```

Use today's date in ISO form (`YYYY-MM-DD`). Append new entries at the
bottom of the file. Never edit or remove past entries — they are the
audit trail. If a past learning is wrong, add a new entry that supersedes
it and reference the older entry by date.

## Rules

1. **One file per skill.** Do not mix Sentinel findings into `palette.md`.
2. **Append-only.** New entries go at the bottom. No editing of prior entries.
3. **No secrets.** Never paste credentials, tokens, hostnames, or patient
   data into a learning entry. Reference the file/line instead.
4. **Concrete and durable.** Each entry should be applicable to future
   work, not a description of one-off task state.
5. **CE-only.** This convention lives in the Community Edition repo. EE
   private learnings stay in the EE repo's own `.jules/`.

## Why this convention exists

Jules upstream documents `AGENTS.md` at repo root as the primary lookup
file, but does not prescribe how skills persist incremental learnings
between runs. This repo's Jules skills have written learnings ad-hoc since
April 2026; `.jules/` formalises that pattern so every skill knows where
to read and write, and human reviewers know where to look for Jules's
accumulated context.
