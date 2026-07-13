<?php
declare(strict_types=1);
require_once __DIR__ . '/app_lib.php';

$gid = gg_safe_gid($_GET['gid'] ?? null);
if (!$gid) {
    http_response_code(404);
    exit('Not found');
}

$idx = gg_load_index();
$info = $idx['graphs'][$gid] ?? null;
$file = gg_graph_file($gid);
if (!is_array($info) || !is_file($file)) {
    http_response_code(404);
    exit('Not found');
}

$html = file_get_contents($file);
header('Content-Type: text/html; charset=utf-8');
echo gg_inject_toolbar($html === false ? '' : $html, $gid, $info);
