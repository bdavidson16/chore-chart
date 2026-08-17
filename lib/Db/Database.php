<?php

namespace ChoreChart\Db;

use PDO;

/**
 * SQLite connection, schema and seed import.
 *
 * The schema matches the one chore_data.py already created in chore_chart.db, so
 * the existing database keeps working. Under Nextcloud this class is replaced by
 * the server's IDBConnection; the mappers are the only thing that touch it.
 */
class Database
{
    private static ?PDO $pdo = null;
    private static string $path = '';

    public static function path(): string
    {
        if (self::$path === '') {
            self::$path = dirname(__DIR__, 2) . '/chore_chart.db';
        }
        return self::$path;
    }

    public static function setPath(string $path): void
    {
        self::$path = $path;
        self::$pdo = null;
    }

    public static function conn(): PDO
    {
        if (self::$pdo === null) {
            self::$pdo = new PDO('sqlite:' . self::path(), null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
        }
        return self::$pdo;
    }

    public static function migrate(): void
    {
        self::conn()->exec(<<<'SQL'
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                email TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                frequency TEXT NOT NULL DEFAULT 'One-time',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chore_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                due_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                priority TEXT NOT NULL DEFAULT 'Medium',
                last_update TEXT,
                completed_at TEXT,
                notified_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                update_text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS points_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                assignment_id INTEGER,
                points INTEGER NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                assignment_id INTEGER,
                message TEXT NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reward_tiers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                description TEXT,
                threshold INTEGER NOT NULL
            );
        SQL);
    }

    /**
     * Import components/hardcorded_data.json and components/points/rewards.json.
     *
     * Additive and safe to re-run: users and chores match on name, so an import
     * over a populated database adds only what is missing.
     *
     * @return array{users_added:int,chores_added:int,tiers_added:int,skipped:int}
     */
    public static function seed(): array
    {
        $summary = ['users_added' => 0, 'chores_added' => 0, 'tiers_added' => 0, 'skipped' => 0];
        $components = dirname(__DIR__, 2) . '/components';
        $pdo = self::conn();

        $seed = self::readJson($components . '/hardcorded_data.json');
        foreach ($seed['users'] ?? [] as $user) {
            $name = trim((string)($user['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $stmt = $pdo->prepare('INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)');
            $stmt->execute([$name, $user['email'] ?? null]);
            $stmt->rowCount() ? $summary['users_added']++ : $summary['skipped']++;
        }

        foreach ($seed['chores'] ?? [] as $chore) {
            $title = trim((string)($chore['name'] ?? ''));
            if ($title === '') {
                continue;
            }
            $exists = $pdo->prepare('SELECT id FROM chores WHERE title = ?');
            $exists->execute([$title]);
            if ($exists->fetchColumn() !== false) {
                $summary['skipped']++;
                continue;
            }
            $stmt = $pdo->prepare(
                'INSERT INTO chores (title, description, frequency) VALUES (?, ?, ?)'
            );
            $stmt->execute([
                $title,
                $chore['description'] ?? '',
                ucfirst((string)($chore['frequency'] ?? 'Weekly')),
            ]);
            $summary['chores_added']++;
        }

        $rewards = self::readJson($components . '/points/rewards.json');
        foreach ($rewards['user_rewards'] ?? [] as $slug => $tier) {
            $description = (string)($tier['description'] ?? '');
            // rewards.json states thresholds in prose: "Earned for completing 10 chores."
            preg_match('/\d+/', $description, $match);
            $stmt = $pdo->prepare(
                'INSERT OR IGNORE INTO reward_tiers (slug, title, description, threshold)
                 VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([
                $slug,
                $tier['title'] ?? ucfirst($slug),
                $description,
                (int)($match[0] ?? 0),
            ]);
            $stmt->rowCount() ? $summary['tiers_added']++ : $summary['skipped']++;
        }

        return $summary;
    }

    /** Run the seed import only when there is nothing to show yet. */
    public static function seedIfEmpty(): void
    {
        $pdo = self::conn();
        $users = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        $chores = (int)$pdo->query('SELECT COUNT(*) FROM chores')->fetchColumn();
        $tiers = (int)$pdo->query('SELECT COUNT(*) FROM reward_tiers')->fetchColumn();
        if ($users === 0 || $chores === 0 || $tiers === 0) {
            self::seed();
        }
    }

    private static function readJson(string $file): array
    {
        if (!is_file($file)) {
            return [];
        }
        $decoded = json_decode((string)file_get_contents($file), true);
        return is_array($decoded) ? $decoded : [];
    }
}
