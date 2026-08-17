<?php

namespace ChoreChart\Service;

use DateTimeImmutable;

/**
 * Due dates and priority derived from a chore's frequency.
 *
 * chore_details.jsx carries `frequency` and `lastCompleted`; a chore is next due
 * one interval after the last day it was done, and chore_list.jsx's
 * sortChoresByPriority then reads off high/medium/low from how that date sits
 * against today.
 */
class Schedule
{
    /** Days between occurrences; one-time chores never come round again. */
    private const FREQUENCY_DAYS = [
        'daily' => 1,
        'weekly' => 7,
        'biweekly' => 14,
        'monthly' => 30,
        'one-time' => null,
    ];

    public static function frequencyDays(?string $frequency): ?int
    {
        return self::FREQUENCY_DAYS[strtolower((string)$frequency)] ?? null;
    }

    public static function today(): DateTimeImmutable
    {
        return new DateTimeImmutable('today');
    }

    public static function parseDate(?string $value): ?DateTimeImmutable
    {
        if ($value === null || $value === '') {
            return null;
        }
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', substr($value, 0, 10));
        return $parsed ?: null;
    }

    /**
     * The day a chore is next due: last completion plus one interval. Never
     * completed, or one-time, means due today. A recurring chore that slipped
     * keeps the date it should have been done on, so it still reads as past due.
     */
    public static function nextDueDate(?string $frequency, ?string $lastCompleted): DateTimeImmutable
    {
        $interval = self::frequencyDays($frequency);
        $last = self::parseDate($lastCompleted);
        if ($interval === null || $last === null) {
            return self::today();
        }
        return $last->modify("+$interval days");
    }

    /**
     * How far ahead counts as 'due soon' — a quarter of the interval. A day of
     * slippage matters far more on a daily chore than a monthly one.
     */
    public static function dueSoonWindow(?string $frequency): int
    {
        $interval = self::frequencyDays($frequency);
        return $interval === null ? 2 : max(1, (int)ceil($interval / 4));
    }

    /**
     * Due state and the priority that state suggests.
     *
     * @return array{0:string,1:string}
     */
    public static function derive(?DateTimeImmutable $due, ?string $frequency): array
    {
        $due ??= self::today();
        $daysUntilDue = (int)self::today()->diff($due)->format('%r%a');

        if ($daysUntilDue < 0) {
            return ['Past due', 'High'];
        }
        if ($daysUntilDue <= self::dueSoonWindow($frequency)) {
            return ['Due soon', 'Medium'];
        }
        return ['Upcoming', 'Low'];
    }
}
