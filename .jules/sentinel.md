## 2026-04-23 - [XSS] DOMPurify Added to dangerouslySetInnerHTML
**Vulnerability:** Several components (`AbbyResponseCard`, `AnnouncementBoard`, `SectionEditor`, `VocabularySearchPanel`) were using `dangerouslySetInnerHTML` with raw or lightly processed user/external input, creating XSS vulnerabilities.
**Learning:** React's `dangerouslySetInnerHTML` bypasses its built-in XSS protections. Even when rendering "safe" HTML from the backend or seemingly controlled inputs (like SVG markups or highlighted text), it's crucial to sanitize the HTML on the client side before rendering to prevent malicious scripts from executing.
**Prevention:** Always use a robust HTML sanitizer like `DOMPurify` before passing data to `dangerouslySetInnerHTML`. Configure `DOMPurify` properly (e.g., `USE_PROFILES: { svg: true }` for SVGs or `ALLOWED_TAGS` to restrict elements) to balance functionality and security.

## 2026-04-23 - [Secrets] Hardcoded Orthanc Password
**Vulnerability:** A static Orthanc password (`GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih`) was hardcoded across multiple deployment scripts (`ingest_orthanc.py`, `ingest_dicom.sh`, `link_dicom.py`) and leaked in developer markdown documentation.
**Learning:** Hardcoding credentials in script files creates a severe risk, as any user or process with access to the source code can interact with sensitive imaging servers. Even internal utility scripts or scripts running in isolated environments must be treated as public artifacts.
**Prevention:** Always read credentials from environment variables (e.g., `os.environ.get()` or `$VAR`) and provide explicit error messaging when they are missing. Never paste sensitive credentials into documentation or planning files.
