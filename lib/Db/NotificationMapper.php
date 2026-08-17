<?php

namespace ChoreChart\Db;

/** Notifications behind the bell — port of components/users/notify_user.jsx. */
class NotificationMapper
{
    public function insert(?int $userId, ?int $assignmentId, string $message): void
    {
        $stmt = Database::conn()->prepare(
            'INSERT INTO notifications (user_id, assignment_id, message) VALUES (?, ?, ?)'
        );
        $stmt->execute([$userId, $assignmentId, $message]);
    }

    public function findAll(int $limit = 20, bool $unreadOnly = false): array
    {
        $where = $unreadOnly ? 'WHERE n.read = 0' : '';
        $stmt = Database::conn()->prepare(
            "SELECT n.id, n.message, n.read, n.created_at AS createdAt,
                    n.assignment_id AS assignmentId, u.name AS userName
             FROM notifications n LEFT JOIN users u ON u.id = n.user_id
             $where ORDER BY datetime(n.created_at) DESC LIMIT ?"
        );
        $stmt->execute([$limit]);

        return array_map(static fn(array $row): array => [
            'id' => (int)$row['id'],
            'message' => $row['message'],
            'read' => (bool)$row['read'],
            'createdAt' => $row['createdAt'],
            'assignmentId' => $row['assignmentId'] === null ? null : (int)$row['assignmentId'],
            'userName' => $row['userName'],
        ], $stmt->fetchAll());
    }

    public function unreadCount(): int
    {
        return (int)Database::conn()
            ->query('SELECT COUNT(*) FROM notifications WHERE read = 0')
            ->fetchColumn();
    }

    public function markAllRead(): void
    {
        Database::conn()->exec('UPDATE notifications SET read = 1 WHERE read = 0');
    }
}
