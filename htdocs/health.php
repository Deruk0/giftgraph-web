<?php
declare(strict_types=1);
require_once __DIR__ . '/app_lib.php';

gg_ensure_storage();
$count = count(glob(gg_graphs_dir() . '/*.html') ?: []);
gg_json(['status' => 'ok', 'graphs' => $count, 'origin' => gg_current_origin()]);
