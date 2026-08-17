<?php

namespace ChoreChart\Db;

use ChoreChart\Service\PointsService;
use ChoreChart\Service\Schedule;

/**
 * Assignments — a chore given to a user with a due date.
 *
 * Rows come back with everything the UI needs already joined and derived, so
 * chore_list.jsx, chore_details.jsx and calendar.jsx all read the same shape.
 */
class AssignmentMapper
{
    /** chore_list.jsx: priorityOrder = { high: 1, medium: 2, low: 3 }. */
    private const PRIORITY_ORDER = ['high' => 1, 'medium' => 2, 'normal' => 2, 'low' => 3];

    private const SELECT = <<<'SQL'
        SELECT a.id, a.chore_id AS choreId, a.user_id AS userId,
               c.title AS choreTitle, c.description, c.frequency,
               u.name AS userName, u.email,
               a.due_date AS dueDate, a.status, a.priority,
               a.last_update AS lastUpdate, a.completed_at AS completedAt,
               (SELECT MAX(x.completed_at) FROM assignments x
                 WHERE x.chore_id = a.chore_id AND x.status = 'Done' AND x.id != a.id
               ) AS choreLastCompleted,
               COALESCE((SELECT SUM(p.points) FROM points_ledger p
                          WHERE p.assignment_id = a.id), 0) AS pointsAwarded
        FROM assignments a
        JOIN chores c ON c.id = a.chore_id
        JOIN users u ON u.id = a.user_id
    SQL;

    /**
     * @param array{status?:string,userId?:int,query?:string,sortBy?:string} $filters
     */
    public function findAll(array $filters = []): array
    {
        $status = $filters['status'] ?? 'All';
        $clauses = [];
        $params = [];

        if ($status === 'Open') {
            $clauses[] = "a.status != 'Done'";
        } elseif ($status !== 'All') {
            $clauses[] = 'a.status = ?';
            $params[] = $status;
        }

        if (!empty($filters['userId'])) {
            $clauses[] = 'a.user_id = ?';
            $params[] = (int)$filters['userId'];
        }

        if (!empty($filters['query'])) {
            $clauses[] = 'LOWER(c.title) LIKE ?';
            $params[] = '%' . strtolower($filters['query']) . '%';
        }

        $sql = self::SELECT . ($clauses ? ' WHERE ' . implode(' AND ', $clauses) : '');
        $stmt = Database::conn()->prepare($sql);
        $stmt->execute($params);

        $rows = array_map([$this, 'cast'], $stmt->fetchAll());
        $this->sort($rows, $filters['sortBy'] ?? 'Priority');

        return $rows;
    }

    public function find(int $id): ?array
    {
        $stmt = Database::conn()->prepare(self::SELECT . ' WHERE a.id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->cast($row) : null;
    }

    /** The '+' action in chore_list.jsx: assign a chore and notify the user. */
    public function insert(int $choreId, int $userId, string $dueDate, string $priority = 'Medium'): ?array
    {
        $pdo = Database::conn();
        $stmt = $pdo->prepare(
            'INSERT INTO assignments (chore_id, user_id, due_date, priority) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$choreId, $userId, substr($dueDate, 0, 10), $priority]);
        $assignmentId = (int)$pdo->lastInsertId();

        $assignment = $this->find($assignmentId);
        if ($assignment !== null) {
            (new NotificationMapper())->insert(
                $userId,
                $assignmentId,
                "You have been assigned the chore: {$assignment['choreTitle']}"
            );
        }
        return $assignment;
    }

    public function update(int $id, array $fields): ?array
    {
        $columns = [
            'dueDate' => 'due_date',
            'priority' => 'priority',
            'userId' => 'user_id',
            'status' => 'status',
            'choreId' => 'chore_id',
        ];

        $set = [];
        $params = [];
        foreach ($columns as $key => $column) {
            if (!array_key_exists($key, $fields)) {
                continue;
            }
            $set[] = "$column = ?";
            $params[] = $key === 'dueDate' ? substr((string)$fields[$key], 0, 10) : $fields[$key];
        }

        if ($set !== []) {
            $params[] = $id;
            $stmt = Database::conn()->prepare(
                'UPDATE assignments SET ' . implode(', ', $set) . ' WHERE id = ?'
            );
            $stmt->execute($params);
        }
        return $this->find($id);
    }

    public function delete(int $id): void
    {
        PointsService::revoke($id);
        $stmt = Database::conn()->prepare('DELETE FROM assignments WHERE id = ?');
        $stmt->execute([$id]);
    }

    /**
     * Mark done and award points based on frequency and days since the chore was
     * last completed (PointHelpers.handleChoreCompletion).
     *
     * @return array{assignment:?array,points:int}
     */
    public function complete(int $id): array
    {
        $row = $this->find($id);
        if ($row === null) {
            return ['assignment' => null, 'points' => 0];
        }

        $points = PointsService::calculate($row['frequency'], $row['choreLastCompleted']);

        $stmt = Database::conn()->prepare(
            "UPDATE assignments SET status = 'Done', completed_at = ? WHERE id = ?"
        );
        $stmt->execute([date('Y-m-d\TH:i:s'), $id]);

        PointsService::revoke($id);
        PointsService::award($row['userId'], $id, $points, "Completed {$row['choreTitle']}");

        (new NotificationMapper())->insert(
            $row['userId'],
            $id,
            "{$row['userName']} completed {$row['choreTitle']} (+$points points)"
        );

        return ['assignment' => $this->find($id), 'points' => $points];
    }

    /**
     * Reopen and claw the points back (PointHelpers.removePointsAnimation).
     *
     * @return array{assignment:?array,pointsRemoved:int}
     */
    public function reopen(int $id): array
    {
        if ($this->find($id) === null) {
            return ['assignment' => null, 'pointsRemoved' => 0];
        }

        $removed = PointsService::revoke($id);
        $stmt = Database::conn()->prepare(
            "UPDATE assignments SET status = 'Pending', completed_at = NULL WHERE id = ?"
        );
        $stmt->execute([$id]);

        return ['assignment' => $this->find($id), 'pointsRemoved' => $removed];
    }

    public function addUpdate(int $id, string $text): void
    {
        $text = trim($text);
        $pdo = Database::conn();

        $stmt = $pdo->prepare('INSERT INTO updates (assignment_id, update_text) VALUES (?, ?)');
        $stmt->execute([$id, $text]);

        $stmt = $pdo->prepare('UPDATE assignments SET last_update = ? WHERE id = ?');
        $stmt->execute([$text, $id]);
    }

    public function updates(int $id): array
    {
        $stmt = Database::conn()->prepare(
            'SELECT update_text AS text, created_at AS createdAt FROM updates
             WHERE assignment_id = ? ORDER BY datetime(created_at) DESC'
        );
        $stmt->execute([$id]);
        return $stmt->fetchAll();
    }

    private function sort(array &$rows, string $sortBy): void
    {
        $rank = static fn(array $r): int => self::PRIORITY_ORDER[strtolower((string)$r['priority'])] ?? 99;
        $done = static fn(array $r): int => $r['status'] === 'Done' ? 1 : 0;

        usort($rows, static function (array $a, array $b) use ($sortBy, $rank, $done): int {
            if ($done($a) !== $done($b)) {
                return $done($a) <=> $done($b);
            }
            return match ($sortBy) {
                'Due date' => [$a['dueDate'], $rank($a)] <=> [$b['dueDate'], $rank($b)],
                'Assigned user' => [strtolower($a['userName']), $a['dueDate']]
                    <=> [strtolower($b['userName']), $b['dueDate']],
                default => [$rank($a), $a['dueDate']] <=> [$rank($b), $b['dueDate']],
            };
        });
    }

    /** Attach the derived schedule fields the UI renders from. */
    private function cast(array $row): array
    {
        $due = Schedule::parseDate($row['dueDate']);
        $scheduledDue = Schedule::nextDueDate($row['frequency'], $row['choreLastCompleted']);
        [$state, $suggested] = Schedule::derive($due, $row['frequency']);
        $isDone = $row['status'] === 'Done';

        return [
            'id' => (int)$row['id'],
            'choreId' => (int)$row['choreId'],
            'userId' => (int)$row['userId'],
            'choreTitle' => $row['choreTitle'],
            'description' => $row['description'] ?? '',
            'frequency' => $row['frequency'],
            'userName' => $row['userName'],
            'email' => $row['email'],
            'dueDate' => substr((string)$row['dueDate'], 0, 10),
            'status' => $row['status'],
            'priority' => $row['priority'],
            'lastUpdate' => $row['lastUpdate'],
            'completedAt' => $row['completedAt'],
            'choreLastCompleted' => $row['choreLastCompleted'],
            'pointsAwarded' => (int)$row['pointsAwarded'],
            'scheduledDue' => $scheduledDue->format('Y-m-d'),
            'dueState' => $isDone ? 'Completed' : $state,
            'suggestedPriority' => $suggested,
            'pointsIfCompletedToday' => $isDone
                ? 0
                : PointsService::calculate($row['frequency'], $row['choreLastCompleted']),
        ];
    }
}
