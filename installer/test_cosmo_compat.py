#!/usr/bin/env python3
"""Cosmopolitan Python stdlib compatibility test.

Validates that all stdlib modules required by the Parthenon installer
are available and functional. Designed to catch missing modules when
running under Cosmopolitan Libc's APE Python distribution.
"""

import sys

REQUIRED_MODULES = [
    "http.server",
    "threading",
    "subprocess",
    "json",
    "socket",
    "tempfile",
    "pathlib",
    "shutil",
    "argparse",
    "dataclasses",
    "urllib.parse",
    "urllib.request",
    "contextlib",
    "platform",
    "os",
]


def test_imports() -> list[str]:
    """Try importing each required module. Returns list of failures."""
    failures: list[str] = []
    for mod in REQUIRED_MODULES:
        try:
            __import__(mod)
            print(f"  import {mod:20s} OK")
        except ImportError as exc:
            print(f"  import {mod:20s} FAIL  ({exc})")
            failures.append(mod)
    return failures


def test_http_server() -> bool:
    """Bind a ThreadingHTTPServer, serve one request, fetch with urllib."""
    import http.server
    import json
    import threading
    import urllib.request

    payload = {"status": "ok", "cosmo": True}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            body = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt: str, *args: object) -> None:
            pass  # suppress request logging

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()

    try:
        url = f"http://127.0.0.1:{port}/"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        if data == payload:
            print("  http roundtrip            OK")
            return True
        else:
            print(f"  http roundtrip            FAIL  (got {data!r})")
            return False
    except Exception as exc:
        print(f"  http roundtrip            FAIL  ({exc})")
        return False
    finally:
        server.server_close()
        thread.join(timeout=3)


def main() -> int:
    print("=== Cosmopolitan Python stdlib compatibility ===")
    print(f"Python {sys.version}\n")

    print("[1/2] Module imports:")
    import_failures = test_imports()

    print("\n[2/2] Functional tests:")
    http_ok = test_http_server()

    print()
    if import_failures or not http_ok:
        if import_failures:
            print(f"FAILED imports: {', '.join(import_failures)}")
        if not http_ok:
            print("FAILED: HTTP server roundtrip")
        return 1

    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
