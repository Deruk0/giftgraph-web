<?php
declare(strict_types=1);
require_once __DIR__ . '/app_lib.php';

$gid = gg_safe_gid($_GET['gid'] ?? null);
if (!$gid) {
    http_response_code(404);
    exit('Not found');
}

$file = gg_graph_file($gid);
if (!is_file($file)) {
    http_response_code(404);
    exit('Not found');
}

header('Content-Type: text/html; charset=utf-8');
readfile($file);
