<?php

namespace Tests\Feature;

use App\Models\MarketingLink;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Admin campaign links: a name and notes per post/ad, and the sign-ups that came through each. */
class MarketingLinksTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admins_manage_campaign_links(): void
    {
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->getJson('/api/admin/marketing-links')->assertForbidden();
        $this->withHeaders($headers)->postJson('/api/admin/marketing-links', ['name' => 'x', 'source' => 'facebook'])->assertForbidden();
    }

    public function test_admin_creates_a_link_with_notes_and_sees_its_signups_and_pro_upgrades(): void
    {
        [, $headers] = $this->userWithToken(['role' => 'admin']);

        $uuid = $this->withHeaders($headers)->postJson('/api/admin/marketing-links', [
            'name' => 'FB post: text captions demo',
            'source' => 'Facebook',
            'medium' => 'post',
            'campaign' => 'Text Captions',
            'notes' => 'Boosted LKR 1,000 for 3 days',
        ])->assertCreated()
            ->assertJsonPath('data.link.source', 'facebook')
            ->assertJsonPath('data.link.campaign', 'text-captions')
            ->assertJsonPath('data.link.path', '/')
            ->json('data.link.uuid');

        $tags = ['signup_source' => 'facebook', 'signup_medium' => 'post', 'signup_campaign' => 'text-captions'];
        $paidUser = User::factory()->create($tags);
        User::factory()->create($tags);
        User::factory()->create(['signup_source' => 'facebook', 'signup_medium' => 'post', 'signup_campaign' => 'other']);
        Payment::factory()->create(['user_id' => $paidUser->id, 'status' => Payment::STATUS_APPROVED]);

        $this->withHeaders($headers)->getJson('/api/admin/marketing-links')->assertOk()
            ->assertJsonPath('data.links.0.signups', 2)
            ->assertJsonPath('data.links.0.paid', 1)
            ->assertJsonPath('data.links.0.notes', 'Boosted LKR 1,000 for 3 days');

        $this->withHeaders($headers)->getJson('/api/admin/signups?days=0')->assertOk()
            ->assertJsonFragment(['campaign' => 'text-captions', 'link_name' => 'FB post: text captions demo']);

        $this->withHeaders($headers)->putJson("/api/admin/marketing-links/{$uuid}", ['name' => 'Renamed', 'source' => 'facebook', 'medium' => 'post', 'campaign' => 'text-captions', 'notes' => ''])
            ->assertOk()->assertJsonPath('data.link.name', 'Renamed')->assertJsonPath('data.link.notes', null);

        $this->withHeaders($headers)->deleteJson("/api/admin/marketing-links/{$uuid}")->assertOk();
        $this->assertSame(0, MarketingLink::count());
        $this->assertSame('facebook', $paidUser->refresh()->signup_source);
    }

    public function test_two_links_cannot_share_the_same_tags(): void
    {
        [, $headers] = $this->userWithToken(['role' => 'admin']);
        MarketingLink::factory()->create(['name' => 'First', 'source' => 'tiktok', 'medium' => null, 'campaign' => 'launch']);

        $this->withHeaders($headers)->postJson('/api/admin/marketing-links', ['name' => 'Again', 'source' => 'TikTok', 'campaign' => 'launch'])
            ->assertUnprocessable()->assertJsonValidationErrors('campaign');
        $this->withHeaders($headers)->postJson('/api/admin/marketing-links', ['name' => 'Bad page', 'source' => 'tiktok', 'path' => 'pricing'])
            ->assertUnprocessable()->assertJsonValidationErrors('path');
    }
}
