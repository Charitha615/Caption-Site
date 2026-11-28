<?php

namespace App\Notifications\InApp;

/**
 * What a notification shows in the app's notification bell (stored in `notifications.data`).
 *
 * @phpstan-type InAppData array{kind: string, title: string, body: string, link: ?string}
 */
trait InAppMessage
{
    /**
     * @return array{kind: string, title: string, body: string, link: ?string}
     */
    protected function inApp(string $kind, string $title, string $body, ?string $link = null): array
    {
        return ['kind' => $kind, 'title' => $title, 'body' => $body, 'link' => $link];
    }
}
