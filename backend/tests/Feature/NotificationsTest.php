<?php

namespace Tests\Feature;

use App\Models\AdminMessage;
use App\Models\Export;
use App\Models\Payment;
use App\Models\Project;
use App\Models\User;
use App\Notifications\AdminMessageMail;
use App\Notifications\InApp\AdminMessage as InAppAdminMessage;
use App\Notifications\InApp\RenderFinished;
use App\Notifications\InApp\Welcome;
use App\Services\Billing\BillingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** The notification bell (automatic notices + admin messages) and the new-user tour flag. */
class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_new_account_gets_a_welcome_and_the_tour_but_existing_ones_do_not(): void
    {
        $token = $this->postJson('/api/auth/register', ['name' => 'Nimal', 'email' => 'nimal@example.com', 'password' => 'secret123'])
            ->assertCreated()->json('data.token');
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->getJson('/api/settings')->assertJsonPath('data.settings.tour_pending', true);
        $this->withHeaders($headers)->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('data.unread', 1)
            ->assertJsonPath('data.notifications.0.kind', 'welcome')
            ->assertJsonPath('data.notifications.0.link', '/projects/create');

        $this->withHeaders($headers)->putJson('/api/settings', ['tour_pending' => false])->assertOk()->assertJsonPath('data.settings.tour_pending', false);

        $this->app['auth']->forgetGuards();
        [, $existing] = $this->userWithToken();
        $this->withHeaders($existing)->getJson('/api/settings')->assertJsonPath('data.settings.tour_pending', false);
    }

    public function test_reading_and_removing_notifications_only_touches_your_own(): void
    {
        [$user, $headers] = $this->userWithToken();
        $other = User::factory()->create();
        $user->notify(new Welcome);
        $user->notify(new Welcome);
        $other->notify(new Welcome);
        $mine = $user->notifications()->first()->id;
        $theirs = $other->notifications()->first()->id;

        $this->withHeaders($headers)->getJson('/api/notifications/unread')->assertJsonPath('data.unread', 2);
        $this->withHeaders($headers)->postJson("/api/notifications/{$theirs}/read")->assertNotFound();
        $this->withHeaders($headers)->postJson("/api/notifications/{$mine}/read")->assertOk()->assertJsonPath('data.notification.read', true);
        $this->withHeaders($headers)->getJson('/api/notifications/unread')->assertJsonPath('data.unread', 1);
        $this->withHeaders($headers)->postJson('/api/notifications/read-all')->assertOk();
        $this->withHeaders($headers)->getJson('/api/notifications/unread')->assertJsonPath('data.unread', 0);
        $this->withHeaders($headers)->deleteJson("/api/notifications/{$mine}")->assertOk();
        $this->assertSame(1, $user->notifications()->count());
        $this->assertSame(1, $other->unreadNotifications()->count());
    }

    public function test_automatic_notices_for_payments_plans_and_renders(): void
    {
        [$user] = $this->userWithToken();
        $admin = User::factory()->create(['role' => 'admin']);
        $billing = app(BillingService::class);

        $billing->approve($billing->submit($user, 'monthly', null, null), $admin);
        $this->assertSame('payment', $user->notifications()->latest()->first()->data['kind']);

        $this->withHeaders(['Authorization' => 'Bearer '.$admin->createToken('a')->plainTextToken])
            ->putJson("/api/admin/users/{$user->uuid}/plan", ['plan' => 'unlimited'])->assertOk();
        $this->assertSame("You're now on Unlimited", $user->notifications()->where('data->kind', 'plan')->first()->data['title']);

        $project = Project::factory()->create(['user_id' => $user->id, 'name' => 'Ella trip']);
        $export = Export::create(['project_id' => $project->id, 'user_id' => $user->id, 'type' => 'mp4', 'status' => Export::STATUS_FAILED]);
        $user->notify(new RenderFinished($export, succeeded: false, reason: 'Out of disk space.'));
        $data = $user->notifications()->where('data->kind', 'render_failed')->first()->data;
        $this->assertStringContainsString('“Ella trip” failed: Out of disk space.', $data['body']);
        $this->assertSame("/projects/{$project->uuid}", $data['link']);
        $this->assertSame(Payment::STATUS_APPROVED, Payment::first()->status);
    }

    public function test_admin_sends_a_message_to_a_plan_or_one_user(): void
    {
        [, $adminHeaders] = $this->userWithToken(['role' => 'admin']);
        $pro = User::factory()->pro()->create();
        $free = User::factory()->create(['email' => 'kasun@example.com']);

        $this->withHeaders($adminHeaders)->postJson('/api/admin/messages', ['title' => 'New styles!', 'body' => 'Try Behind the person.', 'link' => '/projects', 'button_label' => 'Try it', 'category' => 'update', 'audience' => 'pro', 'channels' => ['in_app']])
            ->assertCreated()->assertJsonPath('data.message.recipients', 1);
        $data = $pro->notifications()->first()->data;
        $this->assertSame(['New styles!', 'update', 'Try it'], [$data['title'], $data['category'], $data['button_label']]);
        $this->assertSame(0, $free->notifications()->count());

        $this->withHeaders($adminHeaders)->postJson('/api/admin/messages', ['title' => 'Hi Kasun', 'body' => 'Your slip is approved.', 'audience' => 'user', 'email' => 'KASUN@example.com', 'channels' => ['in_app']])
            ->assertCreated()->assertJsonPath('data.message.target.email', 'kasun@example.com');
        $this->assertSame('admin', $free->notifications()->first()->data['kind']);

        $this->withHeaders($adminHeaders)->postJson('/api/admin/messages', ['title' => 'x', 'body' => 'y', 'audience' => 'user', 'email' => 'nobody@example.com', 'channels' => ['in_app']])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->withHeaders($adminHeaders)->postJson('/api/admin/messages', ['title' => 'x', 'body' => 'y', 'audience' => 'everyone', 'channels' => ['in_app'], 'link' => 'javascript:alert(1)'])
            ->assertUnprocessable()->assertJsonValidationErrors('link');
        $this->withHeaders($adminHeaders)->postJson('/api/admin/messages', ['title' => 'x', 'body' => 'y', 'audience' => 'everyone', 'channels' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('channels');

        $this->withHeaders($adminHeaders)->getJson('/api/admin/messages')->assertOk()
            ->assertJsonCount(2, 'data.messages')
            ->assertJsonPath('data.reach.everyone.in_app', 3)
            ->assertJsonPath('data.reach.pro.in_app', 1);
        $this->assertSame(2, AdminMessage::count());
    }

    public function test_pro_monthly_and_yearly_audiences_follow_the_latest_payment(): void
    {
        [, $adminHeaders] = $this->userWithToken(['role' => 'admin']);
        $admin = User::factory()->create(['role' => 'admin']);
        $billing = app(BillingService::class);
        $monthly = User::factory()->create();
        $yearly = User::factory()->create();
        $gifted = User::factory()->pro()->create(); // Pro from an admin, no payment
        $billing->approve($billing->submit($monthly, 'monthly', null, null), $admin);
        $billing->approve($billing->submit($yearly, 'yearly', null, null), $admin);

        $this->assertSame([$monthly->id], User::query()->onBillingPeriod('monthly')->pluck('id')->all());
        $this->assertSame([$yearly->id], User::query()->onBillingPeriod('yearly')->pluck('id')->all());
        $this->withHeaders($adminHeaders)->postJson('/api/admin/messages', ['title' => 'Yearly thanks', 'body' => 'A gift for you.', 'audience' => 'pro_yearly', 'channels' => ['in_app']])
            ->assertCreated()->assertJsonPath('data.message.recipients', 1);
        $this->assertSame(1, $yearly->notifications()->where('data->kind', 'admin')->count());
        $this->assertSame(0, $gifted->notifications()->where('data->kind', 'admin')->count());
    }

    public function test_email_goes_to_people_who_want_update_emails_and_whatsapp_is_a_click_to_send_list(): void
    {
        Notification::fake();
        [, $adminHeaders] = $this->userWithToken(['role' => 'admin', 'email_updates' => false]);
        $keen = User::factory()->create(['name' => 'Nimal Perera', 'whatsapp_number' => '94771234567', 'whatsapp_opt_in' => true]);
        $quiet = User::factory()->create(['email_updates' => false, 'whatsapp_number' => '94770000000', 'whatsapp_opt_in' => false]);

        $id = $this->withHeaders($adminHeaders)->postJson('/api/admin/messages', [
            'title' => '50% off yearly', 'body' => 'This week only.', 'category' => 'offer', 'link' => '/billing', 'button_label' => 'Get the offer',
            'audience' => 'everyone', 'channels' => ['email', 'whatsapp'],
        ])->assertCreated()
            ->assertJsonPath('data.message.email_recipients', 1)
            ->assertJsonPath('data.message.whatsapp_recipients', 1)
            ->assertJsonPath('data.message.recipients', 0)
            ->json('data.message.id');

        Notification::assertSentTo($keen, AdminMessageMail::class);
        Notification::assertNotSentTo($quiet, AdminMessageMail::class);
        Notification::assertNotSentTo($keen, InAppAdminMessage::class);

        $list = $this->withHeaders($adminHeaders)->getJson("/api/admin/messages/{$id}/whatsapp")->assertOk()->json('data.recipients');
        $this->assertCount(1, $list);
        $this->assertSame('+94771234567', $list[0]['phone']);
        $this->assertStringStartsWith('https://wa.me/94771234567?text=', $list[0]['link']);
        $text = rawurldecode(substr($list[0]['link'], strlen('https://wa.me/94771234567?text=')));
        $this->assertStringContainsString("🎁 *50% off yearly*\n\nHi Nimal, This week only.", $text);
        $this->assertStringContainsString('Get the offer: ', $text);
    }

    public function test_users_set_their_whatsapp_number_and_email_preference(): void
    {
        [$user, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->patchJson('/api/me', ['whatsapp_number' => '077 123 4567', 'whatsapp_opt_in' => true, 'email_updates' => false])->assertOk()
            ->assertJsonPath('data.user.whatsapp_number', '94771234567')
            ->assertJsonPath('data.user.whatsapp_opt_in', true)
            ->assertJsonPath('data.user.email_updates', false);
        $this->withHeaders($headers)->patchJson('/api/me', ['whatsapp_number' => '12'])->assertUnprocessable()->assertJsonValidationErrors('whatsapp_number');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/register', ['name' => 'Sara', 'email' => 'sara@example.com', 'password' => 'secret123', 'whatsapp_number' => '+94 71 555 1234', 'whatsapp_opt_in' => true])->assertCreated();
        $sara = User::where('email', 'sara@example.com')->first();
        $this->assertSame('94715551234', $sara->whatsapp_number);
        $this->assertTrue($sara->whatsapp_opt_in);
    }

    public function test_only_admins_send_messages(): void
    {
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->postJson('/api/admin/messages', ['title' => 'x', 'body' => 'y', 'audience' => 'everyone', 'channels' => ['in_app']])->assertForbidden();
        $this->withHeaders($headers)->getJson('/api/admin/messages')->assertForbidden();
    }
}
