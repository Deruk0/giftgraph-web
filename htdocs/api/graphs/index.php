<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/app_lib.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$gid = gg_safe_gid($_GET['gid'] ?? null);

if ($method === 'POST' && !gg_api_key_ok()) {
    gg_json(['error' => 'unauthorized'], 401);
}

if ($method === 'DELETE' && !gg_api_key_ok() && !gg_delete_token_ok($gid)) {
    gg_json(['error' => 'unauthorized'], 401);
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        gg_json(['error' => 'invalid json'], 400);
    }

    $html = trim((string)($data['html'] ?? ''));
    if ($html === '') {
        gg_json(['error' => 'missing html'], 400);
    }

    gg_ensure_storage();
    do {
        $newGid = bin2hex(random_bytes(6));
        $graphFile = gg_graph_file($newGid);
    } while (is_file($graphFile));

    if (file_put_contents($graphFile, $html, LOCK_EX) === false) {
        gg_json(['error' => 'cannot write graph'], 500);
    }

    $now = new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow'));
    $idx = gg_load_index();
    $graphInfo = [
        'label' => gg_strip_html((string)($data['label'] ?? ('Граф ' . substr($newGid, 0, 6)))),
        'nodes' => (int)($data['nodes'] ?? 0),
        'edges' => (int)($data['edges'] ?? 0),
        'path_length' => (int)($data['path_length'] ?? 0),
        'created' => $now->format('Y-m-d H:i') . ' MSK',
        'created_ts' => (float)$now->format('U.u'),
    ];
    if (isset($data['node_analytics']) && is_array($data['node_analytics'])) {
        $graphInfo['node_analytics'] = $data['node_analytics'];
    }
    $idx['graphs'][$newGid] = $graphInfo;
    gg_save_index($idx);

    gg_json([
        'id' => $newGid,
        'url' => '/view.php?gid=' . rawurlencode($newGid),
        'raw_url' => '/graph.php?gid=' . rawurlencode($newGid),
        'pretty_url' => '/view/' . $newGid,
    ], 201);
}

if ($method === 'GET') {
    $idx = gg_load_index();
    gg_json(['graphs' => $idx['graphs'], 'count' => count($idx['graphs'])]);
}

if ($method === 'DELETE') {
    if (!$gid) {
        gg_json(['error' => 'missing graph id'], 400);
    }

    $idx = gg_load_index();
    if (!isset($idx['graphs'][$gid])) {
        gg_json(['error' => 'not found'], 404);
    }

    $file = gg_graph_file($gid);
    if (is_file($file)) {
        @unlink($file);
    }
    unset($idx['graphs'][$gid]);
    gg_save_index($idx);

    gg_json(['deleted' => $gid]);
}

gg_json(['error' => 'method not allowed'], 405);
