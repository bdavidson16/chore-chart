<?php

/**
 * Routes, in the Nextcloud app format: each entry names a controller, a method
 * and a URL. Locally api/index.php reads this array and dispatches; under
 * Nextcloud the server's router reads the same file.
 */

return [
    'routes' => [
        ['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],

        ['name' => 'chore#index', 'url' => '/api/chores', 'verb' => 'GET'],
        ['name' => 'chore#create', 'url' => '/api/chores', 'verb' => 'POST'],
        ['name' => 'chore#show', 'url' => '/api/chores/{id}', 'verb' => 'GET'],
        ['name' => 'chore#update', 'url' => '/api/chores/{id}', 'verb' => 'PUT'],
        ['name' => 'chore#destroy', 'url' => '/api/chores/{id}', 'verb' => 'DELETE'],
        ['name' => 'chore#assign', 'url' => '/api/chores/{id}/assign', 'verb' => 'POST'],

        ['name' => 'assignment#index', 'url' => '/api/assignments', 'verb' => 'GET'],
        ['name' => 'assignment#create', 'url' => '/api/assignments', 'verb' => 'POST'],
        ['name' => 'assignment#show', 'url' => '/api/assignments/{id}', 'verb' => 'GET'],
        ['name' => 'assignment#update', 'url' => '/api/assignments/{id}', 'verb' => 'PUT'],
        ['name' => 'assignment#destroy', 'url' => '/api/assignments/{id}', 'verb' => 'DELETE'],
        ['name' => 'assignment#complete', 'url' => '/api/assignments/{id}/complete', 'verb' => 'POST'],
        ['name' => 'assignment#reopen', 'url' => '/api/assignments/{id}/reopen', 'verb' => 'POST'],
        ['name' => 'assignment#addUpdate', 'url' => '/api/assignments/{id}/updates', 'verb' => 'POST'],

        ['name' => 'user#index', 'url' => '/api/users', 'verb' => 'GET'],
        ['name' => 'user#create', 'url' => '/api/users', 'verb' => 'POST'],
        ['name' => 'user#progress', 'url' => '/api/users/progress', 'verb' => 'GET'],
        ['name' => 'user#destroy', 'url' => '/api/users/{id}', 'verb' => 'DELETE'],
        ['name' => 'user#points', 'url' => '/api/users/{id}/points', 'verb' => 'GET'],

        ['name' => 'notification#index', 'url' => '/api/notifications', 'verb' => 'GET'],
        ['name' => 'notification#markRead', 'url' => '/api/notifications/read', 'verb' => 'POST'],
    ],
];
