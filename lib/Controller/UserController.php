<?php

namespace ChoreChart\Controller;

use ChoreChart\Db\UserMapper;
use ChoreChart\Service\PointsService;

/** Users and the point bar data behind PointHelpers.jsx. */
class UserController
{
    public function __construct(private UserMapper $users = new UserMapper())
    {
    }

    /** GET /api/users */
    public function index(array $params): array
    {
        return ['users' => $this->users->findAll()];
    }

    /** POST /api/users */
    public function create(array $params): array
    {
        $name = trim((string)($params['name'] ?? ''));
        if ($name === '') {
            throw new BadRequest('A user needs a name');
        }
        return ['user' => $this->users->insert($name, $params['email'] ?? null)];
    }

    /** DELETE /api/users/{id} */
    public function destroy(array $params): array
    {
        $this->users->delete((int)$params['id']);
        return ['deleted' => true];
    }

    /** GET /api/users/progress — one point bar per user */
    public function progress(array $params): array
    {
        return [
            'progress' => $this->users->progress(),
            'history' => PointsService::history(),
        ];
    }

    /** GET /api/users/{id}/points — chore_details.jsx updatePointBar */
    public function points(array $params): array
    {
        $id = (int)$params['id'];
        if ($this->users->find($id) === null) {
            throw new NotFound('User not found');
        }

        foreach ($this->users->progress() as $row) {
            if ($row['id'] === $id) {
                return $row;
            }
        }
        return ['id' => $id, 'points' => 0];
    }
}
