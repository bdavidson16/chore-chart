<?php

namespace ChoreChart\Db;

/**
 * Users and their point totals.
 *
 * `progress()` is the data behind the point bar in PointHelpers.jsx: total
 * points from the ledger, chores completed, and the reward tier that earns.
 */
class UserMapper
{
    public function findAll(bool $activeOnly = true): array
    {
        $where = $activeOnly ? 'WHERE active = 1' : '';
        $rows = Database::conn()
            ->query("SELECT id, name, email FROM users $where ORDER BY name")
            ->fetchAll();
        return array_map([$this, 'cast'], $rows);
    }

    public function find(int $id): ?array
    {
        $stmt = Database::conn()->prepare('SELECT id, name, email FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->cast($row) : null;
    }

    public function insert(string $name, ?string $email): array
    {
        $pdo = Database::conn();
        $stmt = $pdo->prepare('INSERT INTO users (name, email) VALUES (?, ?)');
        $stmt->execute([trim($name), $email !== null && trim($email) !== '' ? trim($email) : null]);
        return $this->find((int)$pdo->lastInsertId());
    }

    public function delete(int $id): void
    {
        $stmt = Database::conn()->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
    }

    /** Point-bar data for every active user, with reward tier progress. */
    public function progress(): array
    {
        $rows = Database::conn()->query(
            "SELECT u.id, u.name,
                    COALESCE((SELECT SUM(p.points) FROM points_ledger p
                               WHERE p.user_id = u.id), 0) AS points,
                    (SELECT COUNT(*) FROM assignments a
                      WHERE a.user_id = u.id AND a.status = 'Done') AS completed,
                    (SELECT COUNT(*) FROM assignments a
                      WHERE a.user_id = u.id AND a.status != 'Done') AS openChores
             FROM users u WHERE u.active = 1 ORDER BY u.name"
        )->fetchAll();

        $tiers = (new RewardTierMapper())->findAll();

        return array_map(static function (array $row) use ($tiers): array {
            $completed = (int)$row['completed'];
            $earned = array_values(array_filter(
                $tiers,
                static fn(array $t): bool => $completed >= $t['threshold']
            ));
            $upcoming = array_values(array_filter(
                $tiers,
                static fn(array $t): bool => $completed < $t['threshold']
            ));
            $next = $upcoming[0] ?? null;

            return [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'points' => (int)$row['points'],
                'completed' => $completed,
                'openChores' => (int)$row['openChores'],
                'tier' => $earned ? end($earned)['title'] : null,
                'nextTier' => $next,
                'progress' => $next && $next['threshold'] > 0
                    ? min(1.0, $completed / $next['threshold'])
                    : 1.0,
            ];
        }, $rows);
    }

    private function cast(array $row): array
    {
        return [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
        ];
    }
}
