<?php

namespace ChoreChart\Service;

use ChoreChart\Db\Database;

/**
 * Points — PHP port of components/points/PointHelpers.jsx.
 *
 *   calculatePoints   -> calculate()
 *   updateUserPoints  -> award() (one points_ledger row per award)
 *   removePoints...   -> revoke() (reopening a chore takes the points back)
 *
 * The ledger is kept per assignment so an award can be undone exactly rather
 * than by subtracting a recomputed guess.
 */
class PointsService
{
    /** PointHelpers.jsx: daily 10, weekly 5, monthly 2; the rest fill its gaps. */
    private const BASE_POINTS = [
        'daily' => 10,
        'weekly' => 5,
        'biweekly' => 3,
        'monthly' => 2,
        'one-time' => 1,
    ];

    private const MAX_STREAK_DAYS = 30;

    /**
     * Base points for the frequency times days since the chore was last done,
     * capped at 30 days. A chore done twice in one day still scores its base
     * points once, where the JS version would have scored zero.
     */
    public static function calculate(?string $frequency, ?string $lastCompleted): int
    {
        $base = self::BASE_POINTS[strtolower((string)$frequency)] ?? 0;
        if ($base === 0) {
            return 0;
        }

        $last = Schedule::parseDate($lastCompleted);
        $days = $last === null ? 1 : (int)$last->diff(Schedule::today())->format('%r%a');

        return $base * max(1, min($days, self::MAX_STREAK_DAYS));
    }

    public static function award(int $userId, int $assignmentId, int $points, string $reason): void
    {
        if ($points === 0) {
            return;
        }
        $stmt = Database::conn()->prepare(
            'INSERT INTO points_ledger (user_id, assignment_id, points, reason) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $assignmentId, $points, $reason]);
    }

    /** Take back every point awarded for an assignment; returns how many. */
    public static function revoke(int $assignmentId): int
    {
        $pdo = Database::conn();
        $stmt = $pdo->prepare('SELECT COALESCE(SUM(points), 0) FROM points_ledger WHERE assignment_id = ?');
        $stmt->execute([$assignmentId]);
        $removed = (int)$stmt->fetchColumn();

        $stmt = $pdo->prepare('DELETE FROM points_ledger WHERE assignment_id = ?');
        $stmt->execute([$assignmentId]);

        return $removed;
    }

    public static function history(int $limit = 25): array
    {
        $stmt = Database::conn()->prepare(
            'SELECT p.points, p.reason, p.created_at AS createdAt, u.name AS user
             FROM points_ledger p JOIN users u ON u.id = p.user_id
             ORDER BY datetime(p.created_at) DESC LIMIT ?'
        );
        $stmt->execute([$limit]);

        return array_map(static fn(array $row): array => [
            'points' => (int)$row['points'],
            'reason' => $row['reason'],
            'createdAt' => $row['createdAt'],
            'user' => $row['user'],
        ], $stmt->fetchAll());
    }
}
