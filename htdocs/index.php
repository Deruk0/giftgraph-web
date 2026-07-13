<?php
declare(strict_types=1);
require_once __DIR__ . '/app_lib.php';

$idx = gg_load_index();
$graphs = $idx['graphs'];
uasort($graphs, static fn(array $a, array $b): int => (float)($b['created_ts'] ?? 0) <=> (float)($a['created_ts'] ?? 0));
$totalNodes = array_sum(array_map(static fn(array $g): int => (int)($g['nodes'] ?? 0), $graphs));
$totalEdges = array_sum(array_map(static fn(array $g): int => (int)($g['edges'] ?? 0), $graphs));
$graphCount = count($graphs);
$edgePulse = $totalNodes > 0 ? round($totalEdges / max(1, $totalNodes), 1) : 0;
?>
<!DOCTYPE html>
<html lang="ru" data-language="ru" data-palette="ember" data-mode="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GiftGraph Web</title>
<link rel="stylesheet" href="<?= gg_escape(gg_asset_url('/assets/giftgraph-home.css')) ?>">
</head>
<body>
<canvas id="ambient-canvas" aria-hidden="true"></canvas>

<main class="atlas-shell">
  <nav class="topbar" aria-label="Панель сайта">
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

  <aside class="metrics" aria-label="Сводка архива">
    <div class="console-head">
      <p class="section-kicker">сводка архива</p>
      <h2>Статистика архива</h2>
      <p class="console-copy">Текущие числа по архиву и плотности связей. Все действия со страниц остаются рабочими.</p>
    </div>
    <div class="metric">
      <span class="metric-label">Графы</span>
      <span class="metric-value" id="total-graphs"><?= $graphCount ?></span>
    </div>
    <div class="metric">
      <span class="metric-label">Узлы</span>
      <span class="metric-value" id="total-nodes"><?= (int)$totalNodes ?></span>
    </div>
    <div class="metric">
      <span class="metric-label">Связи</span>
      <span class="metric-value" id="total-edges"><?= (int)$totalEdges ?></span>
    </div>
    <div class="metric">
      <span class="metric-label">Связей на узел</span>
      <span class="metric-value"><?= gg_escape((string)$edgePulse) ?></span>
    </div>
    <div class="console-note">
      <strong>Совет</strong>
      <p>По умолчанию включена тема Studio Violet; в настройках можно выбрать палитру и вручную настроить акценты.</p>
    </div>
  </aside>

  <section class="archive" id="archive" aria-label="Сохраненные графы">
    <div class="archive-head">
      <div>
        <p class="section-kicker">список графов</p>
        <h2>Сохраненные графы</h2>
      </div>
      <span class="archive-count"><span id="graphs-count"><?= $graphCount ?></span> записей</span>
    </div>

    <div class="archive-tools">
      <label class="search-shell" for="graph-search">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>
        <input id="graph-search" type="search" autocomplete="off" placeholder="Найти граф">
      </label>
      <p class="archive-hint">Поиск фильтрует список сразу; кнопка удаления убирает граф из архива.</p>
    </div>

    <div class="graphs-list" id="graphs-list">
    <?php if ($graphs): ?>
      <?php $position = 0; foreach ($graphs as $gid => $info): $safeGid = gg_safe_gid((string)$gid); if (!$safeGid) continue; $position++; ?>
      <?php
        $label = (string)($info['label'] ?? $safeGid);
        $nodes = (int)($info['nodes'] ?? 0);
        $edges = (int)($info['edges'] ?? 0);
        $created = (string)($info['created'] ?? '');
        $pathLength = (int)($info['path_length'] ?? 0);
        $search = trim($label . ' ' . $safeGid . ' ' . $created . ' ' . $nodes . ' ' . $edges);
        $flow = $nodes > 0 ? min(100, max(12, (int)round(($edges / max(1, $nodes)) * 18))) : 12;
        $deleteToken = gg_delete_token($safeGid);
      ?>
      <article class="graph-card" id="card-<?= gg_escape($safeGid) ?>" data-search="<?= gg_escape(function_exists('mb_strtolower') ? mb_strtolower($search, 'UTF-8') : strtolower($search)) ?>" data-nodes="<?= $nodes ?>" data-edges="<?= $edges ?>" style="--flow:<?= $flow ?>%;">
        <a class="graph-main" href="/view.php?gid=<?= rawurlencode($safeGid) ?>">
          <span class="graph-number"><?= gg_escape(str_pad((string)$position, 2, '0', STR_PAD_LEFT)) ?></span>
          <span class="graph-copy">
            <span class="graph-title"><?= gg_escape($label) ?></span>
            <span class="graph-meta">
              <span><?= $nodes ?> узлов</span>
              <span><?= $edges ?> ребер</span>
              <span><?= gg_escape($created) ?></span>
              <?php if ($pathLength > 0): ?><span>путь <?= $pathLength ?> шаг.</span><?php endif; ?>
            </span>
          </span>
          <svg class="mini-map" viewBox="0 0 150 72" aria-hidden="true" focusable="false">
            <path d="M8 54C36 14 63 16 84 37S121 59 141 18" />
            <path d="M12 30C42 45 64 58 98 47C119 40 131 29 144 37" />
            <circle cx="15" cy="52" r="3.5" />
            <circle cx="84" cy="37" r="4.5" />
            <circle cx="141" cy="18" r="3.5" />
          </svg>
        </a>
        <div class="graph-actions">
          <a href="/view.php?gid=<?= rawurlencode($safeGid) ?>" class="text-btn open icon-text">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17L17 7M9 7h8v8"/></svg>
            <span>Открыть</span>
          </a>
          <button class="icon-btn danger" onclick="deleteGraph('<?= gg_escape($safeGid) ?>', this)" data-delete-url="/api/graphs/index.php?gid=<?= rawurlencode($safeGid) ?>" data-delete-token="<?= gg_escape($deleteToken) ?>" aria-label="Удалить граф" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7l1-3h4l1 3"/></svg>
          </button>
        </div>
      </article>
      <?php endforeach; ?>
    <?php else: ?>
      <div class="empty">
        <div class="empty-mark" aria-hidden="true"></div>
        <p>Здесь появится первая сохраненная карта связей.</p>
      </div>
    <?php endif; ?>
    </div>
    <div class="empty empty-filter" id="empty-filter" hidden>
      <div class="empty-mark" aria-hidden="true"></div>
      <p>Такой граф пока не найден.</p>
    </div>
  </section>

  <section class="signal-banner" aria-label="Статус архива">
    <p class="section-kicker">быстрый обзор</p>
    <h2>Архив уже собрал <?= $graphCount ?> графов с <?= (int)$totalNodes ?> узлами и <?= (int)$totalEdges ?> связями.</h2>
    <p>Карточки архива открываются в один клик, а внешний вид можно переключать без потери функций сайта.</p>
    <div class="signal-tags">
      <span>поиск по архиву</span>
      <span>удаление из списка</span>
      <span>настройка цветов</span>
      <span>светлый и темный режим</span>
    </div>
  </section>
</main>

<aside class="theme-panel" id="theme-panel" aria-hidden="true">
  <div class="panel-frame">
    <div class="panel-head">
      <div>
        <p class="section-kicker">настройки</p>
        <h2>Оформление сайта</h2>
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
          <button type="button" class="palette-card" data-palette-choice="ember">
            <span>
              <strong>Studio Violet</strong>
              <small>фиолетовый сигнал, молочная бумага, чернильные кнопки</small>
            </span>
            <i style="--a:#7a3cff;--b:#b08cff;--c:#eadcff"></i>
          </button>
          <button type="button" class="palette-card" data-palette-choice="reef">
            <span>
              <strong>Signal Blue</strong>
              <small>электрический синий, холодный воздух, светлый фон</small>
            </span>
            <i style="--a:#2f6bff;--b:#79a8ff;--c:#dbe7ff"></i>
          </button>
          <button type="button" class="palette-card" data-palette-choice="iris">
            <span>
              <strong>Rose Index</strong>
              <small>малиновый акцент, мягкая бумага, теплые подписи</small>
            </span>
            <i style="--a:#ca3c76;--b:#ff8bb7;--c:#ffd7e8"></i>
          </button>
          <button type="button" class="palette-card" data-palette-choice="graphite">
            <span>
              <strong>Ink Contrast</strong>
              <small>почти монохром, сдержанный акцент, высокий контраст</small>
            </span>
            <i style="--a:#22201c;--b:#7b7267;--c:#e3d8c8"></i>
          </button>
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
<script src="<?= gg_escape(gg_asset_url('/assets/giftgraph-i18n.js')) ?>"></script>
<script src="<?= gg_escape(gg_asset_url('/assets/giftgraph-home.js')) ?>"></script>
</body>
</html>
