# Repository Notes

- For frontend deployment in this repo, use `./deploy.sh --frontend` instead of `npm run build`.
- Do not treat `npm run build` as the deploy path for shipped frontend assets.
- Before creating, moving, or materially rewriting tracked Markdown/MDX documents, read `docs/lineage/document-authoring-governance.md` and follow its frontmatter, placement, catalog, and closure rules.

## Jules persistent learnings (`.jules/`)

If you are running as the Jules agent (`google-labs-jules[bot]`) or one
of its Skills (Sentinel, Palette, Bolt), read `.jules/README.md` before
starting work. That directory holds per-skill append-only ledgers of
durable learnings:

- `.jules/sentinel.md` — security findings (Sentinel skill)
- `.jules/palette.md` — UX/accessibility/i18n findings (Palette skill)
- `.jules/bolt.md` — performance/build/CI/tooling findings (Bolt skill)
- `.jules/jules.md` — general codebase learnings (base Jules)

After a task that produces a durable, repo-specific lesson, append a new
entry to the matching file in the schema documented in
`.jules/README.md`. Never edit or remove past entries.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
