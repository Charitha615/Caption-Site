<?php

namespace Tests\Feature;

use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_approved_reviews_are_public_and_emails_never_leak(): void
    {
        $approved = Review::factory()->approved()->create(['rating' => 5, 'body' => 'Captions in minutes, not hours.']);
        Review::factory()->create(['body' => 'Pending one']);
        Review::factory()->rejected()->create(['body' => 'Rejected one']);

        $response = $this->getJson('/api/reviews')->assertOk()->assertJsonCount(1, 'data.reviews');

        $response->assertJsonPath('data.reviews.0.body', 'Captions in minutes, not hours.')
            ->assertJsonPath('data.reviews.0.name', $approved->user->name)
            ->assertJsonMissingPath('data.reviews.0.status');
        $this->assertStringNotContainsString($approved->user->email, $response->getContent());
    }

    public function test_a_user_writes_one_review_and_editing_sends_it_back_for_approval(): void
    {
        [$user, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->putJson('/api/me/review', ['rating' => 5, 'body' => 'Best Sinhala caption tool I have used.', 'role' => 'Travel vlogger'])
            ->assertCreated()
            ->assertJsonPath('data.review.status', 'pending');

        $user->review->forceFill(['status' => Review::STATUS_APPROVED, 'approved_at' => now()])->save();

        $this->withHeaders($headers)->putJson('/api/me/review', ['rating' => 4, 'body' => 'Still great, timing could be faster.'])
            ->assertOk()
            ->assertJsonPath('data.review.status', 'pending');
        $this->assertSame(1, Review::count(), 'one review per user');

        $this->withHeaders($headers)->getJson('/api/me/review')->assertJsonPath('data.review.rating', 4);
        $this->withHeaders($headers)->deleteJson('/api/me/review')->assertOk();
        $this->assertSame(0, Review::count());
    }

    public function test_review_input_is_validated(): void
    {
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->putJson('/api/me/review', ['rating' => 9, 'body' => 'short'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['rating', 'body']);
        $this->app['auth']->forgetGuards(); // a fresh request without a token
        $this->withHeaders(['Authorization' => ''])->putJson('/api/me/review', ['rating' => 5, 'body' => 'Not signed in at all.'])->assertUnauthorized();
    }

    public function test_only_admins_can_approve_reviews(): void
    {
        $review = Review::factory()->create();
        [, $userHeaders] = $this->userWithToken();
        [, $adminHeaders] = $this->userWithToken(['role' => 'admin']);

        $this->withHeaders($userHeaders)->getJson('/api/admin/reviews')->assertForbidden();
        $this->withHeaders($userHeaders)->patchJson("/api/admin/reviews/{$review->uuid}", ['status' => 'approved'])->assertForbidden();
        $this->app['auth']->forgetGuards(); // next requests come from the admin

        $this->withHeaders($adminHeaders)->getJson('/api/admin/reviews')
            ->assertOk()
            ->assertJsonPath('data.reviews.0.uuid', $review->uuid)
            ->assertJsonPath('data.counts.pending', 1);
        $this->withHeaders($adminHeaders)->patchJson("/api/admin/reviews/{$review->uuid}", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.review.status', 'approved');

        $this->getJson('/api/reviews')->assertJsonCount(1, 'data.reviews');
    }

    public function test_make_admin_command(): void
    {
        $user = User::factory()->create(['email' => 'owner@sinsub.lk']);

        $this->artisan('users:make-admin', ['email' => 'OWNER@sinsub.lk'])->assertSuccessful();
        $this->assertTrue($user->fresh()->isAdmin());

        $this->artisan('users:make-admin', ['email' => 'owner@sinsub.lk', '--revoke' => true])->assertSuccessful();
        $this->assertFalse($user->fresh()->isAdmin());
        $this->artisan('users:make-admin', ['email' => 'nobody@sinsub.lk'])->assertFailed();
    }
}
