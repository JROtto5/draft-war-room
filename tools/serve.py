#!/usr/bin/env python3
"""Local static server with the same two NFL feed rewrites as Vercel."""
import argparse
import pathlib
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
FEEDS = {"/feeds/nfl/injuries": "injuries", "/feeds/nfl/scoreboard": "scoreboard"}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path not in FEEDS:
            return super().do_GET()
        upstream = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/" + FEEDS[url.path]
        if url.query:
            upstream += "?" + url.query
        try:
            with urllib.request.urlopen(upstream, timeout=12) as response:
                body = response.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (urllib.error.URLError, TimeoutError):
            self.send_error(503, "NFL feed unavailable")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8767)
    args = parser.parse_args()
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
