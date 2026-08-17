<?php

namespace ChoreChart\Db;

/** Reward tiers, seeded from components/points/rewards.json. */
class RewardTierMapper
{
    public function findAll(): array
    {
        $rows = Database::conn()
            ->query('SELECT slug, title, description, threshold FROM reward_tiers ORDER BY threshold')
            ->fetchAll();

        return array_map(static fn(array $row): array => [
            'slug' => $row['slug'],
            'title' => $row['title'],
            'description' => $row['description'],
            'threshold' => (int)$row['threshold'],
        ], $rows);
    }
}
