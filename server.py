"""
GiftGraph Web — сервис для постоянного хостинга интерактивных графов.
"""

import json
import hashlib
import hmac
import os
import re
import tempfile
import threading
import uuid
import time
from urllib.parse import parse_qsl
from functools import wraps
from datetime import datetime, timedelta, timezone
from html import escape

from flask import Flask, abort, jsonify, render_template_string, request, send_from_directory, session

app = Flask(__name__)

BASE_DIR = os.path.dirname(__file__)
GRAPHS_DIR = os.path.join(BASE_DIR, "graphs")
INDEX_PATH = os.path.join(GRAPHS_DIR, "_index.json")
ASSETS_DIR = os.path.join(BASE_DIR, "htdocs", "assets")
API_SECRET = os.getenv("GIFTGRAPH_SECRET", "").strip()
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
app.secret_key = hashlib.sha256((API_SECRET + ":session:" + BOT_TOKEN).encode()).digest() if API_SECRET and BOT_TOKEN else None
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SECURE=True,
                  SESSION_COOKIE_SAMESITE="Lax", PERMANENT_SESSION_LIFETIME=timedelta(hours=12))
INDEX_LOCK = threading.RLock()
CLOUD_STORAGE = os.getenv("GIFTGRAPH_STORAGE") == "blob"
if CLOUD_STORAGE:
    from graph_storage import BlobGraphStore
    GRAPH_STORE = BlobGraphStore()
    app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024

if not CLOUD_STORAGE:
    os.makedirs(GRAPHS_DIR, exist_ok=True)


def _strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s)
    s = (
        s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return s.strip()


def _locked_index(function):
    @wraps(function)
    def locked(*args, **kwargs):
        with INDEX_LOCK:
            return function(*args, **kwargs)
    return locked


@_locked_index
def _load_index() -> dict:
    if CLOUD_STORAGE:
        return GRAPH_STORE.index()
    if os.path.exists(INDEX_PATH):
        try:
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                idx = json.load(f)
        except (json.JSONDecodeError, IOError):
            idx = {"graphs": {}}
    else:
        idx = {"graphs": {}}

    dirty = False
    for _gid, info in idx.get("graphs", {}).items():
        raw = info.get("label", "")
        clean = _strip_html(raw)
        if clean != raw:
            info["label"] = clean
            dirty = True
    if dirty:
        _save_index(idx)
    return idx


@_locked_index
def _save_index(idx: dict) -> None:
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=GRAPHS_DIR, prefix="_index_", suffix=".tmp", delete=False) as f:
            temp_path = f.name
            json.dump(idx, f, ensure_ascii=False, indent=2)
        os.replace(temp_path, INDEX_PATH)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def _api_key_ok() -> bool:
    if not API_SECRET:
        return False
    auth = request.headers.get("Authorization", "")
    plain = request.headers.get("X-GiftGraph-Secret", "")
    return auth == f"Bearer {API_SECRET}" or plain == API_SECRET


def _delete_token(gid: str) -> str:
    if not API_SECRET:
        return ""
    return hmac.new(API_SECRET.encode(), f"delete:{gid}".encode(), hashlib.sha256).hexdigest()


def _delete_token_ok(gid: str) -> bool:
    token = request.headers.get("X-GiftGraph-Delete-Token", "")
    return bool(token) and hmac.compare_digest(_delete_token(gid), token)


MINIAPP_ASSETS = '''<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script defer src="/assets/giftgraph-miniapp.js"></script>'''


def _owns_graph(info):
    uid = session.get("user_id")
    return bool(uid and info and str(info.get("owner_id", "")) == str(uid))


def _visible_graphs():
    uid = session.get("user_id")
    if not uid:
        return {}
    return {gid: info for gid, info in _load_index().get("graphs", {}).items() if _owns_graph(info)}


def _login_page():
    return ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<title>GiftGraph</title>' + MINIAPP_ASSETS +
            '<script src="/assets/giftgraph-theme.js"></script>'
            '<link rel="stylesheet" href="/assets/giftgraph-home.css">'
            '</head><body data-auth-required="true"><main class="auth-shell">'
            '<section class="auth-card"><div class="brand"><span class="brand-mark" aria-hidden="true">'
            '<svg viewBox="0 0 48 48"><path d="M8 28C15 11 33 7 40 20"/><path d="M9 29C18 39 34 39 41 22"/>'
            '<circle cx="13" cy="28" r="3.6"/><circle cx="32" cy="13" r="3.6"/>'
            '<circle cx="39" cy="22" r="3.6"/></svg></span>'
            '<span class="brand-copy"><small>GiftGraph</small><strong>Архив графов Telegram</strong></span></div>'
            '<h1>Твои карты связей</h1><p id="auth-status" role="status">'
            'Откройте приложение через меню Telegram-бота, чтобы увидеть свои графы.'
            '</p></section></main></body></html>')


@app.after_request
def private_responses(response):
    if request.path == "/" or request.path.startswith(("/api/", "/view/", "/graph/")):
        response.headers["Cache-Control"] = "private, no-store"
        response.vary.add("Cookie")
    return response


@app.route("/api/auth/telegram", methods=["POST"])
def telegram_login():
    if not BOT_TOKEN or not app.secret_key:
        return jsonify({"error": "Telegram login is not configured"}), 503
    data = request.get_json(silent=True)
    try:
        raw = data["init_data"]
        if not isinstance(raw, str) or len(raw) > 16384:
            raise ValueError()
        pairs = parse_qsl(raw, strict_parsing=True)
        fields = dict(pairs)
        if len(fields) != len(pairs):
            raise ValueError()
        signature = fields.pop("hash")
        check = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError()
        age = time.time() - int(fields["auth_date"])
        if age < -60 or age > 43200:
            raise ValueError()
        uid = json.loads(fields["user"])["id"]
        if type(uid) is not int or uid <= 0:
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        session.clear()
        return jsonify({"error": "invalid Telegram credentials"}), 401
    changed = session.get("user_id") != uid
    session.clear()
    session["user_id"] = uid
    session.permanent = True
    return jsonify({"ok": True, "changed": changed})
MOBILE_VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
MOBILE_ASSETS = '<link rel="stylesheet" href="/assets/giftgraph-mobile.css"><script defer src="/assets/giftgraph-mobile.js"></script>'
TOOLBAR_ASSETS = MOBILE_VIEWPORT + '<script src="/assets/giftgraph-theme.js"></script><script defer src="/assets/giftgraph-glass.js"></script>' + '<link rel="stylesheet" href="/assets/giftgraph-graph.css">' + MOBILE_ASSETS + MINIAPP_ASSETS

TOOLBAR_HTML = """
<div id="giftgraph-toolbar" class="liquid-glass" role="region" aria-label="Панель графа">
  <div class="tb-left">
    <a href="/" class="tb-btn tb-back tb-icon-text">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6"/><path d="M9 12h11"/></svg>
      <span>Архив</span>
    </a>
    <span class="tb-sigil" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M8 28C15 11 33 7 40 20" />
        <path d="M9 29C18 39 34 39 41 22" />
        <circle cx="13" cy="28" r="3.6" />
        <circle cx="32" cy="13" r="3.6" />
        <circle cx="39" cy="22" r="3.6" />
      </svg>
    </span>
    <span class="tb-details">
      <span class="tb-kicker">снимок графа</span>
      <span class="tb-title">__LABEL__</span>
      <span class="tb-meta" data-gg-nodes="__NODES__" data-gg-edges="__EDGES__" data-gg-path-length="__PATH_LENGTH__">__META__</span>
    </span>
  </div>
  <div class="tb-right">
    <button class="tb-btn tb-icon-text" id="giftgraph-settings-toggle" type="button" aria-controls="giftgraph-theme-panel" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M7 12h10M10 17h4"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="12" cy="17" r="2"/></svg>
      <span>Настройки</span>
    </button>
    <button class="tb-btn tb-copy tb-icon-text" type="button" onclick="(function(btn){
      var label = btn.querySelector('.tb-btn-label');
      var orig = label ? label.textContent : btn.textContent;
      var i18n = window.GiftGraphI18n;
      navigator.clipboard.writeText(window.location.href).then(function(){
        var copied = i18n && i18n.t ? i18n.t('copied') : 'Скопировано';
        if (label) label.textContent = copied;
        else btn.textContent = copied;
        setTimeout(function(){ if (label) label.textContent = orig; else btn.textContent = orig; }, 1500);
      }).catch(function(){ if (window.giftgraphNotify) window.giftgraphNotify(i18n && i18n.t ? i18n.t('copyFailed') : 'Не удалось скопировать ссылку', true); });
    })(this)">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 9h10v10H9z"/><path d="M5 15V5h10"/></svg>
      <span class="tb-btn-label">Копировать</span>
    </button>
    <button class="tb-btn danger tb-icon-text" type="button" data-gid="__GID_ATTR__" data-delete-token="__DELETE_TOKEN__" onclick="if (window.deleteGraphFromToolbar) window.deleteGraphFromToolbar(this)">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7l1-3h4l1 3"/></svg>
      <span>Удалить</span>
    </button>
  </div>
</div>
<div id="giftgraph-theme-panel" role="dialog" aria-modal="true" aria-labelledby="gg-settings-title" aria-hidden="true">
  <div class="tb-panel-frame liquid-glass liquid-glass--modal">
  <div class="tb-panel-head">
    <span>
      <span class="tb-panel-kicker">визуальный режим</span>
      <strong id="gg-settings-title">Настройки графа</strong>
    </span>
    <button class="tb-icon" id="giftgraph-settings-close" type="button" aria-label="Закрыть настройки">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <div class="tb-settings-grid">
    <section class="tb-section">
      <div class="tb-section-title">Граф</div>
      <label class="tb-range">Узлы <span id="gg-node-scale-value">1.0</span><input id="gg-node-scale" type="range" min="0.65" max="1.8" step="0.05" value="1"></label>
      <label class="tb-range">Связи <span id="gg-edge-scale-value">1.0</span><input id="gg-edge-scale" type="range" min="0.55" max="2.2" step="0.05" value="1"></label>
      <label class="tb-range">Длина связей <span id="gg-spring-value">300</span><input id="gg-spring-length" type="range" min="120" max="680" step="10" value="300"></label>
      <label class="tb-switch"><input id="gg-grid-toggle" type="checkbox" checked><span>Сетка</span></label>
      <label class="tb-range">Яркость сетки <span id="gg-grid-value">1.0</span><input id="gg-grid-strength" type="range" min="0" max="1.6" step="0.05" value="1"></label>
      <div class="tb-action-row">
        <button type="button" class="tb-choice" data-gg-action="fit">Показать весь граф</button>
        <button type="button" class="tb-choice" data-gg-action="stabilize">Разложить узлы</button>
      </div>
    </section>
    <section class="tb-section">
      <div class="tb-section-title">Язык интерфейса</div>
      <div class="tb-mode-row tb-language-row" role="group" aria-label="Язык интерфейса">
        <button type="button" class="tb-choice" data-language-choice="ru">Русский</button>
        <button type="button" class="tb-choice" data-language-choice="en">English</button>
      </div>
      <div class="tb-section-title">Вид</div>
      <div class="tb-mode-row">
        <button type="button" class="tb-choice" data-gg-mode-choice="light">Светлая</button>
        <button type="button" class="tb-choice" data-gg-mode-choice="dark">Темная</button>
      </div>
      <div class="tb-palettes">
        <button type="button" class="tb-palette" data-gg-palette-choice="ember"><span>Atlas Teal</span><i class="tb-swatch" style="--a:#146b62;--b:#79aaa3;--c:#dcece8"></i></button>
        <button type="button" class="tb-palette" data-gg-palette-choice="reef"><span>Signal Blue</span><i class="tb-swatch" style="--a:#356ddc;--b:#7ca6ed;--c:#dce8ff"></i></button>
        <button type="button" class="tb-palette" data-gg-palette-choice="iris"><span>Rose Index</span><i class="tb-swatch" style="--a:#bd497f;--b:#df95b5;--c:#f9dcea"></i></button>
        <button type="button" class="tb-palette" data-gg-palette-choice="graphite"><span>Ink Contrast</span><i class="tb-swatch" style="--a:#526078;--b:#8f9aaf;--c:#dce1ed"></i></button>
      </div>
      <div class="tb-color-grid" aria-label="Точная настройка цветов">
        <label class="tb-color">Акцент <input id="gg-theme-color-accent" type="color" data-gg-theme-color="accent"></label>
        <label class="tb-color">Узлы <input id="gg-theme-color-accent-2" type="color" data-gg-theme-color="accent2"></label>
        <label class="tb-color">Мягкий <input id="gg-theme-color-accent-3" type="color" data-gg-theme-color="accent3"></label>
      </div>
      <button type="button" class="tb-choice" id="gg-theme-color-reset">Сбросить цвета</button>
    </section>
    <section class="tb-section tb-section-wide">
      <div class="tb-section-title">Автоудаление</div>
      <div class="tb-auto-row" data-gg-autodelete-group>
        <button type="button" class="tb-choice" data-gg-autodelete="0">Выкл</button>
        <button type="button" class="tb-choice" data-gg-autodelete="60">1 час</button>
        <button type="button" class="tb-choice" data-gg-autodelete="1440">24 ч</button>
        <button type="button" class="tb-choice" data-gg-autodelete="10080">7 дн</button>
      </div>
      <div class="tb-auto-status" id="gg-auto-delete-status">Не запланировано</div>
    </section>
  </div>
  </div>
</div>
<script src="/assets/giftgraph-i18n.js"></script>
<script src="/assets/giftgraph-graph.js"></script>
"""


def _inject_toolbar(html: str, gid: str, info: dict) -> str:
    # Older snapshots have no viewport, or one sized for desktop. Normalize it
    # when serving the page so archived graphs also work on phones.
    html = re.sub(r'<meta\b(?=[^>]*\bname\s*=\s*[\"\']viewport[\"\'])[^>]*>', '', html, flags=re.IGNORECASE)
    label = escape(str(info.get("label", gid)))
    nodes = escape(str(info.get("nodes", "?")))
    edges = escape(str(info.get("edges", "?")))
    try:
        path_length = int(info.get("path_length", 0) or 0)
    except (TypeError, ValueError):
        path_length = 0

    meta = f"{nodes} узлов &middot; {edges} ребер"
    if path_length:
        meta += f" &middot; путь {path_length} шаг."

    toolbar_html = (
        TOOLBAR_HTML.replace("__LABEL__", label)
        .replace("__META__", meta)
        .replace("__NODES__", escape(str(info.get("nodes", "0")), quote=True))
        .replace("__EDGES__", escape(str(info.get("edges", "0")), quote=True))
        .replace("__PATH_LENGTH__", escape(str(path_length), quote=True))
        .replace("__GID_ATTR__", escape(gid, quote=True))
        .replace("__DELETE_TOKEN__", _delete_token(gid))
    )

    if re.search(r"</head>", html, re.IGNORECASE):
        html = re.sub(r"</head>", TOOLBAR_ASSETS + "\n</head>", html, count=1, flags=re.IGNORECASE)
    else:
        html = TOOLBAR_ASSETS + "\n" + html

    html = re.sub(
        r"<head([^>]*)>",
        lambda m: f"<head{m.group(1)}>\n<title>{label} - GiftGraph</title>",
        html,
        count=1,
        flags=re.IGNORECASE,
    )

    body_match = re.search(r"<body[^>]*>", html, re.IGNORECASE)
    if body_match:
        insert_pos = body_match.end()
        html = html[:insert_pos] + "\n" + toolbar_html + html[insert_pos:]
    else:
        html = toolbar_html + "\n" + html
    return html


HOME_TEMPLATE = r"""<!DOCTYPE html>
<html lang="ru" data-language="ru" data-palette="ember" data-mode="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>GiftGraph Web</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script defer src="/assets/giftgraph-miniapp.js"></script>
<script src="/assets/giftgraph-theme.js"></script>
<script defer src="/assets/giftgraph-glass.js"></script>
<link rel="stylesheet" href="/assets/giftgraph-home.css">
<link rel="stylesheet" href="/assets/giftgraph-mobile.css">
<script defer src="/assets/giftgraph-mobile.js"></script>
</head>
<body class="liquid-glass-backdrop">

<main class="atlas-shell">
  <nav class="topbar liquid-glass" aria-label="Панель сайта">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" focusable="false">
          <path d="M8 28C15 11 33 7 40 20" />
          <path d="M9 29C18 39 34 39 41 22" />
          <circle cx="13" cy="28" r="3.6" />
          <circle cx="32" cy="13" r="3.6" />
          <circle cx="39" cy="22" r="3.6" />
        </svg>
      </span>
      <span class="brand-copy">
        <small>giftgraph web</small>
        <strong>Архив графов Telegram</strong>
      </span>
    </a>
    <div class="top-actions">
      <button class="control-btn primary icon-text" id="settings-toggle" type="button" aria-controls="theme-panel" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M7 12h10M10 17h4"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="12" cy="17" r="2"/></svg>
        <span>Настройки</span>
      </button>
    </div>
  </nav>


  <header class="hero">
    <div class="hero-copy">
      <p class="section-kicker">Telegram · личный архив</p>
      <h1><span class="desktop-heading">Карта твоих связей</span><span class="mobile-heading">Твои графы</span></h1>
      <p class="lead">Графы подарков Telegram: участники, связи и найденные пути</p>
    </div>
  </header>

  <aside class="metrics liquid-glass" aria-label="Сводка архива">
    <div class="console-head">
      <p class="section-kicker">сводка архива</p>
      <h2>Статистика архива</h2>
      <p class="console-copy">Твои сохранённые карты связей в цифрах.</p>
    </div>
    <div class="metric">
      <span class="metric-label">Графы</span>
      <span class="metric-value" id="total-graphs">{{ graph_count }}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Узлы</span>
      <span class="metric-value" id="total-nodes">{{ total_nodes }}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Связи</span>
      <span class="metric-value" id="total-edges">{{ total_edges }}</span>
    </div>
    <div class="metric metric-density">
      <span class="metric-label">Связей на узел</span>
      <span class="metric-value">{{ edge_pulse }}</span>
    </div>
    <div class="console-note">
      <strong>Совет</strong>
      <p>По умолчанию включена тема Atlas Teal; в настройках можно выбрать палитру и вручную настроить акценты.</p>
    </div>
  </aside>

  <section class="archive" id="archive" aria-label="Сохраненные графы">
    <div class="archive-head">
      <div>
        <p class="section-kicker">список графов</p>
        <h2>Сохраненные графы</h2>
      </div>
      <span class="archive-count liquid-glass-chip"><span id="graphs-count">{{ graph_count }}</span> записей</span>
    </div>

    <div class="archive-tools">
      <label class="search-shell liquid-glass" for="graph-search">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>
        <input id="graph-search" type="search" autocomplete="off" placeholder="Найти граф">
      </label>
      <p class="archive-hint">Найди человека, название или дату.</p>
    </div>

    <div class="graphs-list" id="graphs-list">
    {% if rows %}
      {% for row in rows %}
      <article class="graph-card liquid-glass" id="card-{{ row.gid }}" data-search="{{ row.search }}" data-nodes="{{ row.nodes }}" data-edges="{{ row.edges }}" style="--flow:{{ row.flow }}%;">
        <a class="graph-main" href="/view/{{ row.gid }}">
          <span class="graph-number">{{ "%02d"|format(row.position) }}</span>
          <span class="graph-copy">
            <span class="graph-title">{{ row.label }}</span>
            <span class="graph-meta">
              <span>{{ row.nodes }} узлов</span>
              <span>{{ row.edges }} ребер</span>
              <span>{{ row.created }}</span>
              {% if row.path_length > 0 %}<span>путь {{ row.path_length }} шаг.</span>{% endif %}
            </span>
          </span>
        </a>
        <div class="graph-actions">
          <a href="/view/{{ row.gid }}" class="text-btn open icon-text">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17L17 7M9 7h8v8"/></svg>
            <span>Открыть</span>
          </a>
          <button class="icon-btn danger" onclick="deleteGraph('{{ row.gid }}', this)" data-delete-token="{{ row.delete_token }}" aria-label="Удалить граф" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7l1-3h4l1 3"/></svg>
          </button>
        </div>
      </article>
      {% endfor %}
    {% else %}
      <div class="empty">
        <div class="empty-mark" aria-hidden="true"></div>
        <p>Здесь появится первая сохраненная карта связей.</p>
      </div>
    {% endif %}
    </div>
    <div class="empty empty-filter" id="empty-filter" hidden>
      <div class="empty-mark" aria-hidden="true"></div>
      <p>Ничего не найдено. Измени запрос</p>
    </div>
  </section>

  <section class="signal-banner" aria-label="Статус архива">
    <p class="section-kicker">быстрый обзор</p>
    <h2>Архив уже собрал {{ graph_count }} графов с {{ total_nodes }} узлами и {{ total_edges }} связями.</h2>
    <p>Карточки архива открываются в один клик, а внешний вид можно переключать без потери функций сайта.</p>
    <div class="signal-tags">
      <span>поиск по архиву</span>
      <span>удаление из списка</span>
      <span>настройка цветов</span>
      <span>светлый и темный режим</span>
    </div>
  </section>
</main>

<aside class="theme-panel" id="theme-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-hidden="true">
  <div class="panel-frame liquid-glass liquid-glass--modal">
    <div class="panel-head">
      <div>
        <p class="section-kicker">настройки</p>
        <h2 id="settings-title">Оформление сайта</h2>
      </div>
      <button class="icon-btn" id="settings-close" type="button" aria-label="Закрыть настройки">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="settings-grid">
      <section class="settings-block">
        <div class="settings-compact-head">
          <div>
            <p class="section-kicker">язык</p>
            <h3>Язык интерфейса</h3>
          </div>
          <div class="mode-row mode-row-compact language-row" role="group" aria-label="Язык интерфейса">
            <button type="button" class="mode-choice settings-chip" data-language-choice="ru">Русский</button>
            <button type="button" class="mode-choice settings-chip" data-language-choice="en">English</button>
          </div>
        </div>
        <div class="settings-divider" aria-hidden="true"></div>
        <div class="settings-compact-head">
          <div>
            <p class="section-kicker">режим</p>
            <h3>Режим темы</h3>
            <p class="settings-note">Переключай сайт между светлой и темной версией.</p>
          </div>
          <div class="mode-row mode-row-compact" role="group" aria-label="Режим">
            <button type="button" class="mode-choice settings-chip" data-mode-choice="light">Светлая</button>
            <button type="button" class="mode-choice settings-chip" data-mode-choice="dark">Темная</button>
          </div>
        </div>
        <div class="settings-divider" aria-hidden="true"></div>
        <div class="settings-compact-head">
          <div>
            <p class="section-kicker">автоудаление</p>
            <h3>Автоудаление по умолчанию</h3>
            <p class="settings-note">Задай срок автоудаления для графов, которые открываются из архива впервые.</p>
          </div>
          <div class="auto-delete-stack">
            <div class="auto-delete-row" data-default-autodelete-group>
              <button type="button" class="mode-choice settings-chip" data-default-autodelete="0">Выкл</button>
              <button type="button" class="mode-choice settings-chip" data-default-autodelete="60">1 час</button>
              <button type="button" class="mode-choice settings-chip" data-default-autodelete="1440">24 ч</button>
              <button type="button" class="mode-choice settings-chip" data-default-autodelete="10080">7 дн</button>
            </div>
            <div class="auto-delete-status" id="default-autodelete-status">Не запланировано</div>
          </div>
        </div>
      </section>

      <section class="settings-block">
        <p class="section-kicker">темы</p>
        <h3>Цветовые наборы</h3>
        <div class="palette-list" aria-label="Цветовые темы">
          <button type="button" class="palette-card" data-palette-choice="ember"><span><strong>Atlas Teal</strong><small>зелёный акцент и спокойные нейтральные тона</small></span><i style="--a:#146b62;--b:#79aaa3;--c:#dcece8"></i></button>
          <button type="button" class="palette-card" data-palette-choice="reef"><span><strong>Signal Blue</strong><small>синий акцент и нейтральные тона</small></span><i style="--a:#356ddc;--b:#7ca6ed;--c:#dce8ff"></i></button>
          <button type="button" class="palette-card" data-palette-choice="iris"><span><strong>Rose Index</strong><small>розовый акцент и нейтральные тона</small></span><i style="--a:#bd497f;--b:#df95b5;--c:#f9dcea"></i></button>
          <button type="button" class="palette-card" data-palette-choice="graphite"><span><strong>Ink Contrast</strong><small>серебряные оттенки и спокойный контраст</small></span><i style="--a:#526078;--b:#8f9aaf;--c:#dce1ed"></i></button>
        </div>
      </section>

      <section class="settings-block settings-block-wide">
        <div class="theme-detail" aria-label="Точная настройка темы">
          <p class="section-kicker">точная настройка</p>
          <h3>Ручная коррекция акцентов</h3>
          <p class="settings-note">Если нужен свой оттенок, можно отдельно подкрутить основной сигнал, вторичный цвет и мягкий тон интерфейса.</p>
          <div class="theme-color-grid">
            <label class="theme-color">Акцент <input id="theme-color-accent" type="color" data-theme-color="accent"></label>
            <label class="theme-color">Вторичный <input id="theme-color-accent-2" type="color" data-theme-color="accent2"></label>
            <label class="theme-color">Мягкий <input id="theme-color-accent-3" type="color" data-theme-color="accent3"></label>
          </div>
          <button class="mode-choice theme-reset" id="theme-color-reset" type="button">Сбросить цвета</button>
        </div>
      </section>
    </div>
  </div>
</aside>

<div id="toast" class="toast"></div>
<script src="/assets/giftgraph-i18n.js"></script>
<script src="/assets/giftgraph-home.js"></script>
</body>
</html>"""


@app.route("/assets/<path:filename>")
def assets(filename: str):
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/")
def home():
    if not session.get("user_id") or request.headers.get("X-GiftGraph-Page") != "1":
        return _login_page()
    graphs = _visible_graphs()
    sorted_graphs = dict(sorted(graphs.items(), key=lambda kv: kv[1].get("created_ts", 0), reverse=True))
    rows = []
    for position, (gid, info) in enumerate(sorted_graphs.items(), start=1):
        nodes = int(info.get("nodes", 0) or 0)
        edges = int(info.get("edges", 0) or 0)
        created = str(info.get("created", ""))
        label = str(info.get("label", gid))
        search = f"{label} {gid} {created} {nodes} {edges}".lower()
        flow = 12 if nodes <= 0 else min(100, max(12, round((edges / max(1, nodes)) * 18)))
        rows.append(
            {
                "position": position,
                "gid": gid,
                "delete_token": _delete_token(gid),
                "label": label,
                "nodes": nodes,
                "edges": edges,
                "created": created,
                "path_length": int(info.get("path_length", 0) or 0),
                "search": search,
                "flow": flow,
            }
        )
    total_nodes = sum(row["nodes"] for row in rows)
    total_edges = sum(row["edges"] for row in rows)
    edge_pulse = round(total_edges / max(1, total_nodes), 1) if total_nodes else 0
    return render_template_string(
        HOME_TEMPLATE,
        rows=rows,
        graph_count=len(rows),
        total_nodes=total_nodes,
        total_edges=total_edges,
        edge_pulse=edge_pulse,
    )


@app.route("/view/<gid>")
def view_graph(gid: str):
    if not re.fullmatch(r"[a-f0-9]{12}", gid):
        abort(404)
    if not session.get("user_id") or request.headers.get("X-GiftGraph-Page") != "1":
        return _login_page()
    info = GRAPH_STORE.info(gid) if CLOUD_STORAGE else _load_index().get("graphs", {}).get(gid)
    if not _owns_graph(info):
        abort(404)

    if CLOUD_STORAGE:
        html = GRAPH_STORE.html(gid)
        if html is None:
            abort(404)
    else:
        graph_file = os.path.join(GRAPHS_DIR, f"{gid}.html")
        if not os.path.exists(graph_file):
            abort(404)
        with open(graph_file, "r", encoding="utf-8") as f:
            html = f.read()
    html = _inject_toolbar(html, gid, info)
    return html, 200, {"Content-Type": "text/html; charset=utf-8"}


@app.route("/graph/<gid>")
def view_graph_raw(gid: str):
    if not re.fullmatch(r"[a-f0-9]{12}", gid):
        abort(404)
    info = GRAPH_STORE.info(gid) if CLOUD_STORAGE else _load_index().get("graphs", {}).get(gid)
    if not _owns_graph(info):
        abort(404)
    if CLOUD_STORAGE:
        if not re.fullmatch(r"[a-f0-9]{12}", gid) or GRAPH_STORE.info(gid) is None:
            abort(404)
        html = GRAPH_STORE.html(gid)
        if html is None:
            abort(404)
        return html, 200, {"Content-Type": "text/html; charset=utf-8"}
    graph_file = os.path.join(GRAPHS_DIR, f"{gid}.html")
    if not os.path.exists(graph_file):
        abort(404)
    return send_from_directory(GRAPHS_DIR, f"{gid}.html")


@app.route("/api/graphs", methods=["POST"])
@_locked_index
def api_create_graph():
    if not _api_key_ok():
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "invalid json object"}), 400
    owner_id = data.get("owner_id")
    if type(owner_id) is not int or owner_id <= 0:
        return jsonify({"error": "owner_id must be a positive Telegram user id"}), 400
    html = data.get("html", "")
    if not isinstance(html, str):
        return jsonify({"error": "html must be a string"}), 400
    html = html.strip()
    if not html:
        return jsonify({"error": "missing html"}), 400
    try:
        counts = {key: int(data.get(key, 0)) for key in ("nodes", "edges", "path_length")}
    except (ValueError, TypeError, OverflowError):
        return jsonify({"error": "invalid graph counts"}), 400
    if any(value < 0 for value in counts.values()):
        return jsonify({"error": "graph counts must be nonnegative"}), 400

    gid = uuid.uuid4().hex[:12]
    now = datetime.now(timezone(timedelta(hours=3)))
    raw_label = data.get("label", f"Граф {gid[:6]}")
    graph_info = {
        "owner_id": owner_id,
        "label": _strip_html(str(raw_label)),
        **counts,
        "created": now.strftime("%Y-%m-%d %H:%M MSK"),
        "created_ts": now.timestamp(),
    }
    if isinstance(data.get("node_analytics"), dict):
        graph_info["node_analytics"] = data["node_analytics"]

    if CLOUD_STORAGE:
        GRAPH_STORE.save(gid, html, graph_info)
    else:
        graph_file = os.path.join(GRAPHS_DIR, f"{gid}.html")
        with open(graph_file, "w", encoding="utf-8") as f:
            f.write(html)
        idx = _load_index()
        idx.setdefault("graphs", {})[gid] = graph_info
        _save_index(idx)
    return jsonify({"id": gid, "url": f"/view/{gid}", "raw_url": f"/graph/{gid}"}), 201


@app.route("/api/graphs", methods=["GET"])
def api_list_graphs():
    if not session.get("user_id"):
        return jsonify({"error": "unauthorized"}), 401
    graphs = _visible_graphs()
    return jsonify({"graphs": graphs, "count": len(graphs)})


@app.route("/api/graphs/<gid>", methods=["DELETE"])
@_locked_index
def api_delete_graph(gid: str):
    if not re.fullmatch(r"[a-f0-9]{12}", gid):
        abort(404)
    if not _api_key_ok():
        if not session.get("user_id"):
            return jsonify({"error": "unauthorized"}), 401
        info = GRAPH_STORE.info(gid) if CLOUD_STORAGE else _load_index().get("graphs", {}).get(gid)
        if not _owns_graph(info):
            abort(404)
    if not _api_key_ok() and not _delete_token_ok(gid):
        return jsonify({"error": "unauthorized"}), 401
    if CLOUD_STORAGE:
        if not re.fullmatch(r"[a-f0-9]{12}", gid) or GRAPH_STORE.info(gid) is None:
            abort(404)
        GRAPH_STORE.delete(gid)
        return jsonify({"deleted": gid})
    idx = _load_index()
    if gid not in idx.get("graphs", {}):
        return jsonify({"error": "not found"}), 404

    graph_file = os.path.join(GRAPHS_DIR, f"{gid}.html")
    if os.path.exists(graph_file):
        os.unlink(graph_file)

    del idx["graphs"][gid]
    _save_index(idx)
    return jsonify({"deleted": gid})


@app.route("/health")
def health():
    graph_count = len(_load_index().get("graphs", {})) if CLOUD_STORAGE else len([f for f in os.listdir(GRAPHS_DIR) if f.endswith(".html")])
    return jsonify({"status": "ok", "graphs": graph_count, "storage": "blob" if CLOUD_STORAGE else "local"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5100"))
    print(f"GiftGraph Web starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
