<?php

namespace App\Services\Notifications;

use App\Models\Payment;
use App\Services\Billing\BillingService;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * WhatsApp alerts to the admin's own phone through CallMeBot (https://www.callmebot.com), so a new
 * Pro request or payment slip is seen straight away. Off until CALLMEBOT_APIKEY is set.
 *
 * One-time setup: from the admin's WhatsApp, send "I allow callmebot to send me messages" to
 * CallMeBot's number (see their site); the reply contains the API key.
 */
class AdminWhatsApp
{
    public const ENDPOINT = 'https://api.callmebot.com/whatsapp.php';

    public function enabled(): bool
    {
        return $this->apiKey() !== '' && $this->phone() !== '';
    }

    /** Sends one message. Throws when CallMeBot does not accept it, so the queued job can retry. */
    public function send(string $text): void
    {
        if (! $this->enabled()) {
            return;
        }
        $response = Http::timeout(20)->get(self::ENDPOINT, [
            'phone' => '+'.$this->phone(),
            'text' => $text,
            'apikey' => $this->apiKey(),
        ]);
        // CallMeBot answers 200 with an HTML page either way; the wording tells success apart.
        $body = strtolower($response->body());
        if (! $response->successful() || ! (str_contains($body, 'message queued') || str_contains($body, 'message sent'))) {
            throw new RuntimeException('CallMeBot did not accept the message (HTTP '.$response->status().'): '.mb_substr(trim(strip_tags($response->body())), 0, 200));
        }
    }

    /** The alert for a new Pro request, or for a slip added to one (`$slipAdded`). */
    public static function paymentMessage(Payment $payment, bool $slipAdded = false): string
    {
        $user = $payment->user;
        $period = $payment->period === 'yearly' ? 'yearly' : 'monthly';
        $amount = $payment->currency.' '.number_format($payment->amount);

        return implode("\n", [
            $slipAdded ? '📎 Payment slip uploaded' : '🔔 New Pro request',
            "{$user->name} ({$user->email})",
            "Pro {$period} · {$amount} · Ref {$payment->reference}",
            $slipAdded || $payment->slip_path ? 'Slip: uploaded ✅' : 'Slip: not yet (may come on WhatsApp)',
            'Review: '.rtrim((string) config('brand.website'), '/').'/admin/payments',
        ]);
    }

    private function apiKey(): string
    {
        return trim((string) config('billing.admin_whatsapp.callmebot_apikey'));
    }

    /** International digits, e.g. 94755173298. Defaults to the billing WhatsApp number. */
    private function phone(): string
    {
        $phone = trim((string) config('billing.admin_whatsapp.phone')) ?: (string) config('billing.whatsapp');

        return app(BillingService::class)->internationalNumber($phone);
    }
}
