<?php

namespace ChoreChart\Controller;

use ChoreChart\Db\AssignmentMapper;
use ChoreChart\Db\ChoreMapper;
use ChoreChart\Service\Schedule;

/**
 * Chores: the catalogue, plus the assign action behind the '+' in chore_list.jsx.
 */
class ChoreController
{
    public function __construct(
        private ChoreMapper $chores = new ChoreMapper(),
        private AssignmentMapper $assignments = new AssignmentMapper(),
    ) {
    }

    /** GET /api/chores */
    public function index(array $params): array
    {
        $chores = $this->chores->findAll();

        // The '+' rows need a prefilled due date and the priority it implies.
        foreach ($chores as &$chore) {
            $scheduledDue = Schedule::nextDueDate($chore['frequency'], $chore['lastCompleted']);
            [$state, $suggested] = Schedule::derive($scheduledDue, $chore['frequency']);
            $chore['scheduledDue'] = $scheduledDue->format('Y-m-d');
            $chore['dueState'] = $state;
            $chore['suggestedPriority'] = $suggested;
        }
        unset($chore);

        if (($params['unassigned'] ?? '') === '1') {
            $chores = array_values(array_filter(
                $chores,
                static fn(array $c): bool => $c['openAssignments'] === 0
            ));
        }

        return ['chores' => $chores];
    }

    /** GET /api/chores/{id} */
    public function show(array $params): array
    {
        $chore = $this->chores->find((int)$params['id']);
        if ($chore === null) {
            throw new NotFound('Chore not found');
        }
        return ['chore' => $chore];
    }

    /** POST /api/chores */
    public function create(array $params): array
    {
        $title = trim((string)($params['title'] ?? ''));
        if ($title === '') {
            throw new BadRequest('A chore needs a title');
        }

        return ['chore' => $this->chores->insert(
            $title,
            (string)($params['description'] ?? ''),
            (string)($params['frequency'] ?? 'One-time'),
        )];
    }

    /** PUT /api/chores/{id} */
    public function update(array $params): array
    {
        $id = (int)$params['id'];
        if ($this->chores->find($id) === null) {
            throw new NotFound('Chore not found');
        }

        $fields = array_intersect_key($params, array_flip(['title', 'description', 'frequency']));
        if (isset($fields['title']) && trim((string)$fields['title']) === '') {
            throw new BadRequest('A chore needs a title');
        }

        return ['chore' => $this->chores->update($id, $fields)];
    }

    /** DELETE /api/chores/{id} */
    public function destroy(array $params): array
    {
        $this->chores->delete((int)$params['id']);
        return ['deleted' => true];
    }

    /** POST /api/chores/{id}/assign — chore_list.jsx assignChoreToUser */
    public function assign(array $params): array
    {
        $choreId = (int)$params['id'];
        $userId = (int)($params['userId'] ?? 0);

        $chore = $this->chores->find($choreId);
        if ($chore === null) {
            throw new NotFound('Chore not found');
        }
        if ($userId === 0) {
            throw new BadRequest('An assignment needs a user');
        }

        $dueDate = (string)($params['dueDate'] ?? '');
        if ($dueDate === '') {
            $dueDate = Schedule::nextDueDate($chore['frequency'], $chore['lastCompleted'])
                ->format('Y-m-d');
        }

        return ['assignment' => $this->assignments->insert(
            $choreId,
            $userId,
            $dueDate,
            (string)($params['priority'] ?? 'Medium'),
        )];
    }
}
