#!/usr/bin/env python3
"""Static dev server with caching disabled.

Plain `python3 -m http.server` sends no cache headers, so browsers apply
heuristic freshness and happily serve a stale ES module after you edit it —
which shows up as a confusing "does not provide an export named X".
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    root = sys.argv[2] if len(sys.argv) > 2 else "."
    ThreadingHTTPServer(("127.0.0.1", port), lambda *a: NoCacheHandler(*a, directory=root)).serve_forever()
