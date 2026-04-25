# Contributing to Parthenon

Thanks for your interest in contributing. Parthenon is an open-source healthcare informatics platform built by Acumenus Data Sciences (a nonprofit) and the broader OHDSI community. This document covers a few specific contribution paths beyond the standard "fork → branch → PR" flow.

For general guidance — coding standards, PR conventions, the development workflow — see `.claude/CLAUDE.md` and the rules under `.claude/rules/`.

---

## Adding a diagnostic-KB fingerprint

The installer's diagnostic knowledge base (`installer/diagnostics-kb.json`) maps known error patterns to user-facing fixes. When you encounter an installer failure that the KB doesn't recognize — either as a user or in CI — adding a fingerprint is one of the most valuable contributions you can make.

The KB is the foundation of the installer's "Try this fix" buttons (Spec Area G). Every fingerprint that lands here saves the next user from hitting the same opaque error.

### When to add a fingerprint

Add an entry when:

- A failure pattern reproduced at least once in CI or by a user
- The fix is deterministic and safe (no `rm -rf $HOME` jokes)
- The error message is stable enough to match with a regex (it doesn't include random hashes, timestamps, or PIDs that would defeat regex matching)

Don't add an entry for:

- Genuinely novel failures that need investigation
- Errors that are already covered by an existing fingerprint
- Patterns where the "fix" is "open a GitHub issue" — that's the no-match path the KB already handles

### The schema

Each entry in `installer/diagnostics-kb.json` has the following shape:

```json
{
  "id": "kebab-case-unique-id",
  "fingerprint": "regex pattern that matches the error",
  "category": "port-conflict | docker | wsl | network | disk | memory | database | redis | hecate | analytics | config | tooling | permissions | platform | security | frontend | user | ai",
  "severity": "error | warn",
  "fix_action": "port-holder | null",
  "fix_args": {},
  "fix_args_template": {"port": "$1"},
  "user_message": "What the user sees, with {placeholders} from fix_args",
  "learn_more": "docs/install/<doc-page>",
  "platforms": ["all", "darwin", "linux", "windows"]
}
```

#### Required fields

- `id` — kebab-case, unique across the KB
- `fingerprint` — Python-compatible regex (compiled with `re.MULTILINE`)
- `category` — one of the existing categories (or propose a new one in your PR)
- `severity` — `error` or `warn` (errors block; warns inform)
- `user_message` — concise, action-oriented, no jargon
- `platforms` — array; use `["all"]` if platform-agnostic

#### Optional fields

- `fix_action` — name of a contract action that can repair the failure (currently: `port-holder`; future actions per Spec G6)
- `fix_args` — static args passed to the fix action
- `fix_args_template` — args templated from regex captures (e.g., `{"port": "$1"}` extracts the first capture group as the `port` arg)
- `learn_more` — relative path to a docs page

### Example: adding a port-conflict fingerprint

If you see this failure in an install log:

```
OSError: [Errno 98] Address already in use: ('0.0.0.0', 8443)
```

And you want a "Try this fix" button that runs the `port-holder` contract action against port 8443:

```json
{
  "id": "port-conflict-https",
  "fingerprint": "Address already in use.*['(](8443)['\\)]",
  "category": "port-conflict",
  "severity": "error",
  "fix_action": "port-holder",
  "fix_args_template": {"port": "$1"},
  "user_message": "Port {port} is already in use. Use the port-holder action to find and stop the process.",
  "learn_more": "docs/install/port-conflicts",
  "platforms": ["all"]
}
```

The capture group `(8443)` in the regex becomes `$1` in the template, which renders as `{port}` in the user message.

### Step-by-step

1. Find the actual error string from a real failure (not invented). Either paste from a CI log or your own install attempt.
2. Open `installer/diagnostics-kb.json` in your editor.
3. Add a new entry to the array. Keep entries grouped by category if practical.
4. Open `installer/tests/test_diagnostics.py`. Find the `KB_FIXTURES` dict. Add a fixture mapping your `id` to a `(log, platform)` tuple:
   ```python
   "port-conflict-https": ("OSError: [Errno 98] Address already in use: ('0.0.0.0', 8443)", "linux"),
   ```
5. Run the parametrized fixture test to verify your regex matches:
   ```bash
   python -m pytest installer/tests/test_diagnostics.py::test_kb_entry_matches_its_fixture -k "port-conflict-https" -v
   ```
6. Run the full diagnostics test suite to verify no regressions:
   ```bash
   python -m pytest installer/tests/test_diagnostics.py -v
   ```
7. Open a PR titled `feat(installer): add diagnostic fingerprint for <category> · <id>`.

### Regex tips

- Use `\\` in the JSON file for a single backslash in the regex (JSON requires double-escape)
- Default flag is `re.MULTILINE`; `^` and `$` match line boundaries inside a multi-line haystack
- Avoid `.*` greediness when you can — prefer non-greedy `.*?` or anchored character classes
- Test against the actual log string, including any preceding/following lines that survive the `--last 200` capture window
- Keep capture groups numbered (`$1`, `$2`) — named groups aren't supported by the template renderer

### Severity guidance

- `error` — the install cannot proceed; user must fix or Reset
- `warn` — the install completed but a feature is degraded (e.g., Achilles characterization failed but core install succeeded); user should review

### Coverage feedback loop

Every CI run on `main` that produces a failure not matched by an existing fingerprint should result in:

1. A GitHub issue tagged `diagnostic-gap` with the failure log
2. A PR adding a fingerprint that matches it (often by the same author)

This is how the KB grows. A fingerprint added today saves every user from that failure tomorrow.

---

## Other contribution paths

### Reporting installer-experience issues

The Done page footer includes a passive link to GitHub Discussions. This is the lightweight channel for "the install was painful" feedback. If your issue is reproducible and has a fix, prefer a PR over a discussion thread.

### Reporting security issues

Don't open public issues for suspected vulnerabilities. Use GitHub's [security advisory](https://github.com/sudoshi/Parthenon/security/advisories/new) flow instead. We acknowledge within 48 hours.

### Documentation

Docs live under `docs/site/docs/`. Frontmatter is Docusaurus v3 format. Run `npx docusaurus build` to validate locally before pushing.

### Code review for healthcare-domain code

Touching code that interacts with PHI, OMOP CDM data, or clinical concepts? Tag a maintainer with healthcare domain expertise on your PR. Don't merge clinical-domain code without a domain reviewer's sign-off.

---

## License

By contributing, you agree that your contributions will be licensed under Apache 2.0 (the same license as Parthenon).
