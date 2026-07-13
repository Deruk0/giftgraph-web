<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function gg_graphs_dir(): string
{
    global $GIFTGRAPH_GRAPHS_DIR;
    return $GIFTGRAPH_GRAPHS_DIR ?: (__DIR__ . '/graphs');
}

function gg_index_path(): string
{
    return gg_graphs_dir() . '/_index.json';
}

function gg_asset_url(string $path): string
{
    $path = '/' . ltrim($path, '/');
    $file = __DIR__ . $path;
    $version = is_file($file) ? (string)filemtime($file) : (string)time();
    return $path . '?v=' . rawurlencode($version);
}

function gg_ensure_storage(): void
{
    $dir = gg_graphs_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $idx = gg_index_path();
    if (!is_file($idx)) {
        file_put_contents($idx, json_encode(['graphs' => new stdClass()], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }
}

function gg_strip_html(string $value): string
{
    return trim(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

function gg_load_index(): array
{
    gg_ensure_storage();
    $raw = @file_get_contents(gg_index_path());
    $idx = json_decode($raw ?: '', true);
    if (!is_array($idx)) {
        $idx = ['graphs' => []];
    }
    if (!isset($idx['graphs']) || !is_array($idx['graphs'])) {
        $idx['graphs'] = [];
    }

    $dirty = false;
    foreach ($idx['graphs'] as $gid => &$info) {
        if (!is_array($info)) {
            $info = [];
            $dirty = true;
            continue;
        }
        $rawLabel = (string)($info['label'] ?? '');
        $clean = gg_strip_html($rawLabel);
        if ($clean !== $rawLabel) {
            $info['label'] = $clean;
            $dirty = true;
        }
    }
    unset($info);

    if ($dirty) {
        gg_save_index($idx);
    }
    return $idx;
}

function gg_save_index(array $idx): void
{
    gg_ensure_storage();
    $payload = $idx;
    if (empty($payload['graphs'])) {
        $payload['graphs'] = new stdClass();
    }
    file_put_contents(
        gg_index_path(),
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function gg_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function gg_safe_gid(?string $gid): ?string
{
    $gid = trim((string)$gid);
    return preg_match('/^[A-Za-z0-9_-]{1,64}$/', $gid) ? $gid : null;
}

function gg_request_header(string $name): string
{
    $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$serverName])) {
        return (string)$_SERVER[$serverName];
    }
    if ($name === 'Authorization' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $key => $value) {
            if (strcasecmp((string)$key, $name) === 0) {
                return (string)$value;
            }
        }
    }
    return '';
}

function gg_api_key_ok(): bool
{
    global $GIFTGRAPH_SECRET;
    $secret = trim((string)$GIFTGRAPH_SECRET);
    if ($secret === '') {
        return true;
    }

    $auth = trim(gg_request_header('Authorization'));
    $plain = trim(gg_request_header('X-GiftGraph-Secret'));

    return hash_equals('Bearer ' . $secret, $auth) || hash_equals($secret, $plain);
}

function gg_delete_token(string $gid): string
{
    global $GIFTGRAPH_SECRET;
    $secret = trim((string)$GIFTGRAPH_SECRET);
    if ($secret === '') {
        return '';
    }

    return hash_hmac('sha256', 'delete:' . $gid, $secret);
}

function gg_delete_token_ok(?string $gid): bool
{
    global $GIFTGRAPH_SECRET;
    $secret = trim((string)$GIFTGRAPH_SECRET);
    if ($secret === '') {
        return true;
    }
    if (!$gid) {
        return false;
    }

    $token = trim(gg_request_header('X-GiftGraph-Delete-Token'));
    return $token !== '' && hash_equals(gg_delete_token($gid), $token);
}

function gg_graph_file(string $gid): string
{
    return gg_graphs_dir() . '/' . $gid . '.html';
}

function gg_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function gg_current_origin(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $scheme . '://' . $host;
}

function gg_inject_toolbar(string $html, string $gid, array $info): string
{
    $label = gg_escape((string)($info['label'] ?? $gid));
    $nodes = gg_escape((string)($info['nodes'] ?? '?'));
    $edges = gg_escape((string)($info['edges'] ?? '?'));
    $pathLength = (int)($info['path_length'] ?? 0);
    $meta = $nodes . ' узлов &middot; ' . $edges . ' ребер';
    if ($pathLength > 0) {
        $meta .= ' &middot; путь ' . $pathLength . ' шаг.';
    }
    $gidAttr = gg_escape(rawurlencode($gid));
    $deleteToken = gg_escape(gg_delete_token($gid));
    $deleteUrl = gg_escape('/api/graphs/index.php?gid=' . rawurlencode($gid));

    $graphCss = gg_escape(gg_asset_url('/assets/giftgraph-graph.css'));
    $graphI18nJs = gg_escape(gg_asset_url('/assets/giftgraph-i18n.js'));
    $graphJs = gg_escape(gg_asset_url('/assets/giftgraph-graph.js'));
    $assets = <<<HTML
<link rel="stylesheet" href="{$graphCss}">
HTML;

    $toolbar = <<<HTML
<canvas id="giftgraph-ambient-canvas" aria-hidden="true"></canvas>
<div id="giftgraph-toolbar" role="region" aria-label="Панель графа">
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
      <span class="tb-title">{$label}</span>
      <span class="tb-meta" data-gg-nodes="{$nodes}" data-gg-edges="{$edges}" data-gg-path-length="{$pathLength}">{$meta}</span>
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
    <button class="tb-btn danger tb-icon-text" type="button" data-gid="{$gidAttr}" data-delete-url="{$deleteUrl}" data-delete-token="{$deleteToken}" onclick="if (window.deleteGraphFromToolbar) window.deleteGraphFromToolbar(this)">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7l1-3h4l1 3"/></svg>
      <span>Удалить</span>
    </button>
  </div>
</div>
<div id="giftgraph-theme-panel" aria-hidden="true">
  <div class="tb-panel-head">
    <span>
      <span class="tb-panel-kicker">визуальный режим</span>
      <strong>Настройки графа</strong>
    </span>
    <button class="tb-icon" id="giftgraph-settings-close" type="button" aria-label="Закрыть настройки">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <div class="tb-settings-grid">
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
        <button type="button" class="tb-palette" data-gg-palette-choice="ember"><span>Studio Violet</span><i class="tb-swatch" style="--a:#7a3cff;--b:#b08cff;--c:#eadcff"></i></button>
        <button type="button" class="tb-palette" data-gg-palette-choice="reef"><span>Signal Blue</span><i class="tb-swatch" style="--a:#2f6bff;--b:#79a8ff;--c:#dbe7ff"></i></button>
        <button type="button" class="tb-palette" data-gg-palette-choice="iris"><span>Rose Index</span><i class="tb-swatch" style="--a:#ca3c76;--b:#ff8bb7;--c:#ffd7e8"></i></button>
        <button type="button" class="tb-palette" data-gg-palette-choice="graphite"><span>Ink Contrast</span><i class="tb-swatch" style="--a:#22201c;--b:#7b7267;--c:#e3d8c8"></i></button>
      </div>
      <div class="tb-color-grid" aria-label="Точная настройка цветов">
        <label class="tb-color">Акцент <input id="gg-theme-color-accent" type="color" data-gg-theme-color="accent"></label>
        <label class="tb-color">Узлы <input id="gg-theme-color-accent-2" type="color" data-gg-theme-color="accent2"></label>
        <label class="tb-color">Мягкий <input id="gg-theme-color-accent-3" type="color" data-gg-theme-color="accent3"></label>
      </div>
      <button type="button" class="tb-choice" id="gg-theme-color-reset">Сбросить цвета</button>
    </section>
    <section class="tb-section">
      <div class="tb-section-title">Граф</div>
      <label class="tb-range">Узлы <span id="gg-node-scale-value">1.0</span><input id="gg-node-scale" type="range" min="0.65" max="1.8" step="0.05" value="1"></label>
      <label class="tb-range">Связи <span id="gg-edge-scale-value">1.0</span><input id="gg-edge-scale" type="range" min="0.55" max="2.2" step="0.05" value="1"></label>
      <label class="tb-range">Длина связей <span id="gg-spring-value">350</span><input id="gg-spring-length" type="range" min="120" max="680" step="10" value="350"></label>
      <label class="tb-switch"><input id="gg-grid-toggle" type="checkbox" checked><span>Сетка</span></label>
      <label class="tb-range">Яркость сетки <span id="gg-grid-value">1.0</span><input id="gg-grid-strength" type="range" min="0" max="1.6" step="0.05" value="1"></label>
      <div class="tb-action-row">
        <button type="button" class="tb-choice" data-gg-action="fit">Показать весь граф</button>
        <button type="button" class="tb-choice" data-gg-action="stabilize">Разложить узлы</button>
      </div>
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
<script src="{$graphI18nJs}"></script>
<script src="{$graphJs}"></script>
HTML;

    if (stripos($html, '</head>') !== false) {
        $html = preg_replace('/<\/head>/i', $assets . "\n</head>", $html, 1);
    } else {
        $html = $assets . "\n" . $html;
    }

    if (preg_match('/<head[^>]*>/i', $html)) {
        $html = preg_replace_callback(
            '/<head[^>]*>/i',
            static fn(array $m): string => $m[0] . "\n<title>" . $label . ' - GiftGraph</title>',
            $html,
            1
        );
    }

    if (preg_match('/<body[^>]*>/i', $html, $match, PREG_OFFSET_CAPTURE)) {
        $pos = $match[0][1] + strlen($match[0][0]);
        $html = substr($html, 0, $pos) . "\n" . $toolbar . substr($html, $pos);
    } else {
        $html = $toolbar . "\n" . $html;
    }

    return $html;
}
