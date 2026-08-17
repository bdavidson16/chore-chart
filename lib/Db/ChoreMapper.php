<?php

namespace ChoreChart\Db;

/**
 * Chores — the catalogue of things that need doing, independent of who is on
 * them. `lastCompleted` feeds the points calculation in PointHelpers.jsx and
 * `openAssignments` marks the rows chore_list.jsx offers a '+' on.
 */
class ChoreMapper
{
    private const SELECT = <<<'SQL'
        SELECT c.id, c.title, c.description, c.frequency,
               (SELECT MAX(a.completed_at) FROM assignments a
                 WHERE a.chore_id = c.id AND a.status = 'Done') AS lastCompleted,
               (SELECT COUNT(*) FROM assignments a
                 WHERE a.chore_id = c.id AND a.status != 'Done') AS openAssignments
        FROM chores c
    SQL;

    public function findAll(bool $activeOnly = true): array
    {
        $where = $activeOnly ? 'WHERE c.active = 1' : '';
        $rows = Database::conn()->query(self::SELECT . " $where ORDER BY c.title")->fetchAll();
        return array_map([$this, 'cast'], $rows);
    }

    public function find(int $id): ?array
    {
        $stmt = Database::conn()->prepare(self::SELECT . ' WHERE c.id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->cast($row) : null;
    }

    /** Chores nobody is currently on — the '+' rows in chore_list.jsx. */
    public function findUnassigned(): array
    {
        return array_values(array_filter(
            $this->findAll(),
            static fn(array $chore): bool => $chore['openAssignments'] === 0
        ));
    }

    public function insert(string $title, string $description, string $frequency): array
    {
        $pdo = Database::conn();
        $stmt = $pdo->prepare(
            'INSERT INTO chores (title, description, frequency) VALUES (?, ?, ?)'
        );
        $stmt->execute([trim($title), trim($description), $frequency]);
        return $this->find((int)$pdo->lastInsertId());
    }

    public function update(int $id, array $fields): ?array
    {
        $allowed = array_intersect_key($fields, array_flip(['title', 'description', 'frequency']));
        if ($allowed !== []) {
            $set = implode(', ', array_map(static fn(string $k): string => "$k = ?", array_keys($allowed)));
            $stmt = Database::conn()->prepare("UPDATE chores SET $set WHERE id = ?");
            $stmt->execute([...array_values($allowed), $id]);
        }
        return $this->find($id);
    }

    public function delete(int $id): void
    {
        $stmt = Database::conn()->prepare('DELETE FROM chores WHERE id = ?');
        $stmt->execute([$id]);
    }

    private function cast(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'title' => $row['title'],
            'description' => $row['description'] ?? '',
            'frequency' => $row['frequency'],
            'lastCompleted' => $row['lastCompleted'],
            'openAssignments' => (int)$row['openAssignments'],
        ];
    }
}
