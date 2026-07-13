<?php
declare(strict_types=1);

/**
 * GiftGraph Web config for shared PHP hosting.
 *
 * For production, create config.local.php next to this file:
 *
 * <?php
 * $GIFTGRAPH_SECRET = 'same-secret-as-in-bot-env';
 *
 * Leaving the secret empty preserves the old Flask behaviour: API writes and
 * deletes are allowed without authorization.
 */
$GIFTGRAPH_SECRET = getenv('GIFTGRAPH_SECRET') ?: '';
$GIFTGRAPH_GRAPHS_DIR = __DIR__ . '/graphs';

$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    require $localConfig;
}
