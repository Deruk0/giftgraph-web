"""Public Mini App gateway. Graphs and application logic remain on the PC."""
import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

from flask import Flask, Response, jsonify, request

app = Flask(__name__)

OFFLINE_PAGE = '''<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GiftGraph</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;
font:17px system-ui;background:#f4ebdb;color:#16110d}
main{max-width:420px;padding:28px}button{font:inherit;padding:12px 20px;
border:0;border-radius:12px;background:#7a3cff;color:white;cursor:pointer}</style>
</head><body><main><h1>GiftGraph</h1>
<p>Графы сейчас недоступны. Попробуй открыть приложение немного позже.</p>
<button onclick="location.reload()">Обновить</button></main>
<script>if(window.Telegram&&Telegram.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand();}</script>
</body></html>'''


def _backend_url():
    base = os.getenv("GIFTGRAPH_BACKEND_URL", "").strip().rstrip("/")
    parsed = urlsplit(base)
    local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if (parsed.scheme != "https" and not local_http) or not parsed.hostname:
        raise ValueError("GIFTGRAPH_BACKEND_URL must be a public HTTPS origin")
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
        raise ValueError("GIFTGRAPH_BACKEND_URL must contain only an origin")
    # A gateway pointing at itself would recurse until the request times out.
    if parsed.netloc.lower() == request.host.lower():
        raise ValueError("Backend must differ from the public gateway")
    return base


def _unavailable():
    if request.path.startswith("/api/") or request.path == "/health":
        response = jsonify({"error": "backend unavailable"})
        response.status_code = 503
    else:
        response = Response(OFFLINE_PAGE, status=503, content_type="text/html; charset=utf-8")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Retry-After"] = "30"
    return response


def _forward(path):
    try:
        url = _backend_url() + "/" + quote(path, safe="/")
        if request.query_string:
            url += "?" + request.query_string.decode("ascii")
        headers = {"Accept": request.headers.get("Accept", "*/*"), "User-Agent": "GiftGraphGateway/1.0"}
        # Forward per-graph authorization unchanged. Never grant admin rights
        # to visitors by adding the bot's API secret on the gateway.
        token = request.headers.get("X-GiftGraph-Delete-Token")
        if token:
            headers["X-GiftGraph-Delete-Token"] = token
        upstream = Request(url, headers=headers, method=request.method)
        try:
            source = urlopen(upstream, timeout=12)
        except HTTPError as error:
            source = error
        with source:
            response = Response(
                source.read(), status=source.status,
                content_type=source.headers.get("Content-Type", "application/octet-stream"),
            )
        response.headers["Cache-Control"] = "no-store"
        return response
    except (ValueError, URLError, TimeoutError, OSError):
        app.logger.warning("Local backend is unavailable")
        return _unavailable()


@app.route("/")
def home():
    return _forward("")


@app.route("/health")
@app.route("/api/graphs")
def read_api():
    return _forward(request.path.lstrip("/"))


@app.route("/view/<gid>")
@app.route("/graph/<gid>")
def graph(gid):
    return _forward(request.path.lstrip("/"))


@app.route("/assets/<path:filename>")
def assets(filename):
    return _forward("assets/" + filename)


@app.route("/api/graphs/<gid>", methods=["DELETE"])
def delete_graph(gid):
    return _forward("api/graphs/" + gid)
