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
