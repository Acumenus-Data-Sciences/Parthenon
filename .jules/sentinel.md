## 2025-02-23 - Fix SQL comment bypass in query validation
**Vulnerability:** A query validation function (`checkSqlSafety`) intended to block destructive queries (like `DROP`, `INSERT`) could be completely bypassed if the attacker added a comment containing a whitelisted schema name (e.g., `DROP TABLE users; -- temp_abby`).
**Learning:** Checking for substrings or using simple regexes on raw, un-parsed SQL strings is extremely brittle because SQL comments and string literals can hide tokens or introduce false flags.
**Prevention:** Always strip SQL comments and string literals (replacing them with spaces to preserve token boundaries) before attempting to identify keywords via regex.
