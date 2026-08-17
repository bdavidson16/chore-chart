<?php

namespace ChoreChart\Controller;

use ChoreChart\Db\NotificationMapper;

/** The bell in notify_user.jsx. */
class NotificationController
{
    public function __construct(private NotificationMapper $notifications = new NotificationMapper())
    {
    }

    /** GET /api/notifications */
    public function index(array $params): array
    {
        return [
            'notifications' => $this->notifications->findAll(
                (int)($params['limit'] ?? 20),
                ($params['unreadOnly'] ?? '') === '1',
            ),
            'unread' => $this->notifications->unreadCount(),
        ];
    }

    /** POST /api/notifications/read */
    public function markRead(array $params): array
    {
        $this->notifications->markAllRead();
        return ['unread' => 0];
    }
}
