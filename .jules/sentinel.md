## 2026-04-23 - [XSS] DOMPurify Added to dangerouslySetInnerHTML
**Vulnerability:** Several components (`AbbyResponseCard`, `AnnouncementBoard`, `SectionEditor`, `VocabularySearchPanel`) were using `dangerouslySetInnerHTML` with raw or lightly processed user/external input, creating XSS vulnerabilities.
**Learning:** React's `dangerouslySetInnerHTML` bypasses its built-in XSS protections. Even when rendering "safe" HTML from the backend or seemingly controlled inputs (like SVG markups or highlighted text), it's crucial to sanitize the HTML on the client side before rendering to prevent malicious scripts from executing.
**Prevention:** Always use a robust HTML sanitizer like `DOMPurify` before passing data to `dangerouslySetInnerHTML`. Configure `DOMPurify` properly (e.g., `USE_PROFILES: { svg: true }` for SVGs or `ALLOWED_TAGS` to restrict elements) to balance functionality and security.

## 2026-04-23 - [Secrets] Hardcoded Orthanc Password
**Vulnerability:** A static Orthanc password (`GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih`) was hardcoded across multiple deployment scripts (`ingest_orthanc.py`, `ingest_dicom.sh`, `link_dicom.py`) and leaked in developer markdown documentation.
**Learning:** Hardcoding credentials in script files creates a severe risk, as any user or process with access to the source code can interact with sensitive imaging servers. Even internal utility scripts or scripts running in isolated environments must be treated as public artifacts.
**Prevention:** Always read credentials from environment variables (e.g., `os.environ.get()` or `$VAR`) and provide explicit error messaging when they are missing. Never paste sensitive credentials into documentation or planning files.

## 2025-02-23 - Fix SQL comment bypass in query validation
**Vulnerability:** A query validation function (`checkSqlSafety`) intended to block destructive queries (like `DROP`, `INSERT`) could be completely bypassed if the attacker added a comment containing a whitelisted schema name (e.g., `DROP TABLE users; -- temp_abby`).
**Learning:** Checking for substrings or using simple regexes on raw, un-parsed SQL strings is extremely brittle because SQL comments and string literals can hide tokens or introduce false flags.
**Prevention:** Always strip SQL comments and string literals (replacing them with spaces to preserve token boundaries) before attempting to identify keywords via regex.

## 2026-05-07 - [Secrets] Passwords Leak in Error Logs
**Vulnerability:** The temporary password created for the user when an email send failed was being logged to the backend logger in plaintext, leaking secrets into application logs.
**Learning:** Even well-intentioned error handling and logging (e.g., providing a fallback so an admin can give a user their password if an email fails) can introduce critical security risks by leaving plaintext secrets in persistent logs.
**Prevention:** Never log plaintext passwords or sensitive credentials. Fallback mechanisms should rely on standard password reset flows rather than exposing temporary credentials in logs.

## 2024-05-08 - [Data Interrogation Service SQL Bypass Vulnerabilities]
**Vulnerability:** The AI DataInterrogationService contained two severe SQL check bypasses:
1. The check `substr_count($stripped, ';') > 1` permitted queries with exactly 1 semicolon, effectively allowing *two* SQL statements (e.g. `SELECT 1; DROP TABLE users`).
2. The check simply looked for the presence of `temp_abby.` and, if found, bypassed all forbidden keyword checks. This allowed arbitrary forbidden SQL anywhere in the query if the string `temp_abby.` was appended.
**Learning:** Poorly crafted regular expressions and simplistic substring counts can completely negate the intended purpose of input validation, specifically around SQL execution safeguards.
**Prevention:**
- Explicitly validate statements based on strict bounds rather than blind string existence.
- When validating multiple statements, check if a semicolon exists `str_contains(rtrim($string, " \t\n\r\0\x0B;"), ';')` rather than assuming `< 2` means one statement.
- First extract and remove intentionally whitelisted/safe patterns, then check the remainder for forbidden logic.
