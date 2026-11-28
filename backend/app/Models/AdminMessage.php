<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A message an admin sent to users: in the app's notification bell, by email, and/or as a WhatsApp list. */
class AdminMessage extends Model
{
    public const AUDIENCES = ['everyone', 'free', 'pro', 'pro_monthly', 'pro_yearly', 'unlimited', 'user'];

    public const CHANNELS = ['in_app', 'email', 'whatsapp'];

    /** Look of the notification: an icon and colour in the app, an emoji in email and WhatsApp. */
    public const CATEGORIES = ['announcement' => '📣', 'update' => '✨', 'offer' => '🎁', 'tip' => '💡', 'important' => '⚠️'];

    protected $fillable = ['title', 'body', 'category', 'link', 'button_label', 'audience', 'channels', 'target_user_id', 'recipients', 'email_recipients', 'whatsapp_recipients'];

    protected function casts(): array
    {
        return ['channels' => 'array'];
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function sendsOn(string $channel): bool
    {
        return in_array($channel, $this->channels ?? ['in_app'], true);
    }

    /** The emoji for this message's category. */
    public function emoji(): string
    {
        return self::CATEGORIES[$this->category] ?? '📣';
    }

    /** The link as a full address (pages of the app are joined to the site's address). */
    public function absoluteLink(): ?string
    {
        if (! $this->link) {
            return null;
        }

        return str_starts_with($this->link, '/') ? rtrim((string) config('brand.website'), '/').$this->link : $this->link;
    }

    /**
     * Users this message is for, on one channel: email skips people who turned update emails off,
     * WhatsApp is only for people who gave a number and agreed to messages.
     *
     * @return Builder<User>
     */
    public function recipients(?string $channel = null): Builder
    {
        $query = match ($this->audience) {
            'user' => User::query()->whereKey($this->target_user_id),
            'everyone' => User::query(),
            'pro_monthly' => User::query()->onBillingPeriod('monthly'),
            'pro_yearly' => User::query()->onBillingPeriod('yearly'),
            default => User::query()->onPlan($this->audience),
        };

        return match ($channel) {
            'email' => $query->where('email_updates', true),
            'whatsapp' => $query->where('whatsapp_opt_in', true)->whereNotNull('whatsapp_number'),
            default => $query,
        };
    }

    /** The WhatsApp text, formatted with WhatsApp's *bold*. */
    public function whatsAppText(?string $name = null): string
    {
        $brand = (string) config('brand.title_name');
        $lines = [$this->emoji().' *'.$this->title.'*', '', ($name ? "Hi {$name}, " : '').$this->body];
        if ($link = $this->absoluteLink()) {
            $lines[] = '';
            $lines[] = ($this->button_label ?: 'Open').': '.$link;
        }
        $lines[] = '';
        $lines[] = "— {$brand}";

        return implode("\n", $lines);
    }
}
