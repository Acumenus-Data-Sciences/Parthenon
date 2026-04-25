# Installer Phase 8 — Documentation Implementation Plan

**Goal:** Author the four user-facing docs pages referenced from the GUI banners and links shipped in Phases 4–7, plus a CONTRIBUTING.md section explaining how to add diagnostic-KB fingerprints.

**Scope:** Pure markdown content. No code changes. Final phase of the v0.2.0 milestone.

**Spec reference:** `docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md` — Appendix "Files Touched" docs section.

---

## Files

| Path | Status | Referenced from |
|---|---|---|
| `docs/site/docs/install/verifying-signatures.mdx` | NEW | Phase 7 release notes; future docs site nav |
| `docs/site/docs/install/no-telemetry.mdx` | NEW | Phase 4 Done page "Learn more" link |
| `docs/site/docs/install/first-launch-trust.mdx` | NEW | Phase 6 Gatekeeper + SmartScreen banners |
| `docs/site/docs/install/community-installer-walkthrough.mdx` | NEW | Marketing landing pages; future user-facing nav |
| `CONTRIBUTING.md` | MODIFY (or NEW if absent) | Spec G7 — feedback loop for KB additions |

`key-rotation.mdx` already shipped in Phase 2 — not re-authored here.

---

## Tasks

1. Create the four MDX docs with the content blocks below
2. Add the diagnostic-KB section to CONTRIBUTING.md (or create the file with a minimal scaffold + that section)
3. Verify Docusaurus frontmatter syntax (each MDX file's frontmatter `--- ... ---` block must parse)
4. Commit each as a separate commit for clean history

## Done Criteria

- [ ] All 4 MDX files exist with valid frontmatter
- [ ] Each file has at least 3 substantive sections
- [ ] CONTRIBUTING.md has an "Adding a diagnostic-KB fingerprint" section
- [ ] All links to other docs pages use relative paths (`/docs/install/...`)
- [ ] Phase 4's no-telemetry "Learn more" link target now exists
- [ ] Phase 6's Gatekeeper + SmartScreen banner doc-link target now exists

## What Phase 8 Does NOT Include

- Docusaurus build verification (CI runs the docs build separately)
- Translation / i18n of docs
- Marketing-page polish (the walkthrough is technical, not promotional)
- The acumenus.net "release-keys" page mentioned in `key-rotation.mdx` (separate channel, separate hosting)
