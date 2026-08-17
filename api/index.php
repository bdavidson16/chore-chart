<?php

/**
 * Local JSON API front controller.
 *
 * Dispatches the routes declared in appinfo/routes.php against the controllers
 * in lib/Controller. Under Nextcloud this file goes away — the server routes the
 * same table to the same controllers.
 *
 * Run it with:  php -S localhost:8000 -t . api/index.php
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/autoload.php';

use ChoreChart\Controller\HttpException;
use ChoreChart\Db\Database;

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$controllers = [
    'chore' => \ChoreChart\Controller\ChoreController::class,
    'assignment' => \ChoreChart\Controller\AssignmentController::class,
    'user' => \ChoreChart\Controller\UserController::class,
    'notification' => \ChoreChart\Controller\NotificationController::class,
];

/** Turn '/api/chores/{id}/assign' into a regex that captures {id}. */
function routePattern(string $url): string
{
    $quoted = preg_quote($url, '#');
    $withParams = preg_replace('#\\\{(\w+)\\\}#', '(?P<$1>[^/]+)', $quoted);
    return '#^' . $withParams . '/?$#';
}

try {
    Database::migrate();
    Database::seedIfEmpty();

    $routes = require dirname(__DIR__) . '/appinfo/routes.php';

    $match = null;
    $pathParams = [];
    foreach ($routes['routes'] as $route) {
        if (strtoupper($route['verb']) !== $method) {
            continue;
        }
        if (preg_match(routePattern($route['url']), $path, $captures) === 1) {
            $match = $route;
            $pathParams = array_filter($captures, 'is_string', ARRAY_FILTER_USE_KEY);
            break;
        }
    }

    if ($match === null) {
        http_response_code(404);
        echo json_encode(['error' => "No route for $method $path"]);
        exit;
    }

    [$controllerKey, $action] = explode('#', $match['name']);
    if (!isset($controllers[$controllerKey])) {
        http_response_code(404);
        echo json_encode(['error' => "No controller for {$match['name']}"]);
        exit;
    }

    $body = [];
    if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
        $raw = file_get_contents('php://input') ?: '';
        $decoded = json_decode($raw, true);
        $body = is_array($decoded) ? $decoded : [];
    }

    $params = array_merge($_GET, $body, $pathParams);
    $payload = (new $controllers[$controllerKey]())->$action($params);

    echo json_encode($payload);
} catch (HttpException $e) {
    http_response_code($e->status());
    echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
