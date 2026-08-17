<?php

namespace ChoreChart\Controller;

use ChoreChart\Db\AssignmentMapper;

/**
 * Assignments: the chore list itself, plus completion, which is where points are
 * awarded (PointHelpers.handleChoreCompletion).
 */
class AssignmentController
{
    public function __construct(private AssignmentMapper $assignments = new AssignmentMapper())
    {
    }

    /** GET /api/assignments?status=&userId=&query=&sortBy= */
    public function index(array $params): array
    {
        return ['assignments' => $this->assignments->findAll([
            'status' => (string)($params['status'] ?? 'All'),
            'userId' => isset($params['userId']) ? (int)$params['userId'] : null,
            'query' => (string)($params['query'] ?? ''),
            'sortBy' => (string)($params['sortBy'] ?? 'Priority'),
        ])];
    }

    /** GET /api/assignments/{id} — chore_details.jsx */
    public function show(array $params): array
    {
        $assignment = $this->requireAssignment((int)$params['id']);
        return [
            'assignment' => $assignment,
            'updates' => $this->assignments->updates($assignment['id']),
        ];
    }

    /** POST /api/assignments */
    public function create(array $params): array
    {
        $choreId = (int)($params['choreId'] ?? 0);
        $userId = (int)($params['userId'] ?? 0);
        if ($choreId === 0 || $userId === 0) {
            throw new BadRequest('An assignment needs a chore and a user');
        }

        $dueDate = (string)($params['dueDate'] ?? '');
        if ($dueDate === '') {
            throw new BadRequest('An assignment needs a due date');
        }

        $assignment = $this->assignments->insert(
            $choreId,
            $userId,
            $dueDate,
            (string)($params['priority'] ?? 'Medium'),
        );

        if (isset($params['status']) && $params['status'] !== 'Pending') {
            $assignment = $this->assignments->update($assignment['id'], ['status' => $params['status']]);
        }

        return ['assignment' => $assignment];
    }

    /** PUT /api/assignments/{id} */
    public function update(array $params): array
    {
        $id = (int)$params['id'];
        $this->requireAssignment($id);

        $fields = array_intersect_key(
            $params,
            array_flip(['choreId', 'userId', 'dueDate', 'priority', 'status'])
        );

        // Going through Done via a plain edit still has to award points.
        if (($fields['status'] ?? null) === 'Done') {
            unset($fields['status']);
            $this->assignments->update($id, $fields);
            return ['assignment' => $this->assignments->complete($id)['assignment']];
        }

        return ['assignment' => $this->assignments->update($id, $fields)];
    }

    /** DELETE /api/assignments/{id} */
    public function destroy(array $params): array
    {
        $this->assignments->delete((int)$params['id']);
        return ['deleted' => true];
    }

    /** POST /api/assignments/{id}/complete */
    public function complete(array $params): array
    {
        $id = (int)$params['id'];
        $this->requireAssignment($id);
        return $this->assignments->complete($id);
    }

    /** POST /api/assignments/{id}/reopen */
    public function reopen(array $params): array
    {
        $id = (int)$params['id'];
        $this->requireAssignment($id);
        return $this->assignments->reopen($id);
    }

    /** POST /api/assignments/{id}/updates */
    public function addUpdate(array $params): array
    {
        $id = (int)$params['id'];
        $this->requireAssignment($id);

        $text = trim((string)($params['text'] ?? ''));
        if ($text === '') {
            throw new BadRequest('An update needs some text');
        }

        $this->assignments->addUpdate($id, $text);
        return ['updates' => $this->assignments->updates($id)];
    }

    private function requireAssignment(int $id): array
    {
        $assignment = $this->assignments->find($id);
        if ($assignment === null) {
            throw new NotFound('Assignment not found');
        }
        return $assignment;
    }
}
