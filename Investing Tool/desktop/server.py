#!/usr/bin/env python3
"""
MarketSatellite local server.
Serves signal-dashboard.html and proxies FRED + Yahoo Finance API calls
server-side to bypass browser CORS restrictions.

Usage:
    python3 server.py
Then open: http://localhost:8080/signal-dashboard.html
"""
import os
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get('PORT', 8080))

UPSTREAMS = {
    '/api/fred': 'https://api.stlouisfed.org/fred/series/observations',
    '/api/yf1':  'https://query1.finance.yahoo.com',
    '/api/yf2':  'https://query2.finance.yahoo.com',
}


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        for prefix, upstream in UPSTREAMS.items():
            if self.path.startswith(prefix):
                self._proxy(prefix, upstream)
                return
        super().do_GET()

    def _proxy(self, prefix, upstream):
        # For FRED the upstream already includes the path; for YF it's a base URL
        if prefix == '/api/fred':
            url = upstream + self.path[len(prefix):]
        else:
            url = upstream + self.path[len(prefix):]
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://finance.yahoo.com/',
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read()
            self._respond(200, body)
        except urllib.error.HTTPError as e:
            self._respond(e.code, e.read())
        except Exception as e:
            self._respond(500, f'{{"error":"{e}"}}'.encode())

    def _respond(self, status, body):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence request logs; remove this line if you want to see them


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    httpd = HTTPServer(('', PORT), Handler)
    print(f'MarketSatellite → http://localhost:{PORT}/signal-dashboard.html')
    print('Ctrl+C to stop.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
