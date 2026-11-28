<?php

namespace Tests\Feature;

use App\Jobs\SendAdminWhatsApp;
use App\Services\Notifications\AdminWhatsApp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

/** WhatsApp alert to the admin (CallMeBot) when someone requests Pro or uploads a slip. */
class AdminWhatsAppTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Notification::fake();
        Queue::fake();
    }

    public function test_nothing_is_sent_until_callmebot_is_set_up(): void
    {
        config(['billing.admin_whatsapp.callmebot_apikey' => '']);
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->postJson('/api/billing/payments', ['period' => 'monthly', 'note' => 'Requested on WhatsApp'])->assertCreated();

        Queue::assertNotPushed(SendAdminWhatsApp::class);
    }

    public function test_a_pro_request_and_a_slip_upload_each_alert_the_admin(): void
    {
        config(['billing.admin_whatsapp.callmebot_apikey' => 'key123', 'brand.website' => 'https://sinsub.cc']);
        [, $headers] = $this->userWithToken(['name' => 'Kasun', 'email' => 'kasun@example.com']);

        $uuid = $this->withHeaders($headers)->postJson('/api/billing/payments', ['period' => 'yearly', 'note' => 'Requested on WhatsApp'])
            ->assertCreated()->json('data.payment.uuid');

        Queue::assertPushed(SendAdminWhatsApp::class, fn (SendAdminWhatsApp $job) => str_contains($job->text, 'New Pro request')
            && str_contains($job->text, 'Kasun (kasun@example.com)')
            && str_contains($job->text, 'Pro yearly · LKR 3,990 · Ref SS-')
            && str_contains($job->text, 'Slip: not yet')
            && str_contains($job->text, 'https://sinsub.cc/admin/payments'));

        $this->withHeaders($headers)->post("/api/billing/payments/{$uuid}/slip", ['slip' => UploadedFile::fake()->image('slip.png')], ['Accept' => 'application/json'])->assertOk();

        Queue::assertPushed(SendAdminWhatsApp::class, fn (SendAdminWhatsApp $job) => str_contains($job->text, 'Payment slip uploaded') && str_contains($job->text, 'Slip: uploaded'));
    }

    public function test_it_calls_callmebot_with_the_admin_number_and_fails_loudly_on_an_error(): void
    {
        config(['billing.admin_whatsapp.callmebot_apikey' => 'key123', 'billing.admin_whatsapp.phone' => '', 'billing.whatsapp' => '075 517 3298']);
        Http::fake([
            'api.callmebot.com/*' => Http::sequence()
                ->push('<p>Message queued. You will receive it in a few seconds.</p>')
                ->push('<p>APIKey is invalid.</p>'),
        ]);
        $whatsApp = app(AdminWhatsApp::class);

        $whatsApp->send('Hello');
        Http::assertSent(fn (Request $r) => str_starts_with($r->url(), AdminWhatsApp::ENDPOINT)
            && $r['phone'] === '+94755173298' && $r['apikey'] === 'key123' && $r['text'] === 'Hello');

        $this->expectException(RuntimeException::class);
        $whatsApp->send('Hello again');
    }
}
