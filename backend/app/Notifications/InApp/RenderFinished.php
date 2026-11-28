<?php

namespace App\Notifications\InApp;

use App\Models\Export;
use Illuminate\Notifications\Notification;

/** To the owner: their MP4 export is ready to download, or it failed. */
class RenderFinished extends Notification
{
    use InAppMessage;

    public function __construct(public Export $export, public bool $succeeded, public ?string $reason = null) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{kind: string, title: string, body: string, link: ?string} */
    public function toArray(object $notifiable): array
    {
        $project = $this->export->project;
        $name = $project?->name ?: 'your project';
        $link = $project ? "/projects/{$project->uuid}" : null;

        return $this->succeeded
            ? $this->inApp('render', 'Your video is ready 🎬', "The MP4 for “{$name}” has finished rendering. Open the project to download it.", $link)
            : $this->inApp('render_failed', 'Your video could not be rendered', "The MP4 for “{$name}” failed: ".($this->reason ?: 'please try again.'), $link);
    }
}
