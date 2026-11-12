<?php

namespace Tests\Feature;

use App\Models\CaptionTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CaptionTemplateApiTest extends TestCase
{
    use RefreshDatabase;

    private function as(User $user)
    {
        // Sanctum caches the resolved user per test; reset it so each call really is that user.
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('t')->plainTextToken);
    }

    public function test_lists_system_templates_and_only_own_custom_templates(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();
        CaptionTemplate::create(['user_id' => $me->id, 'name' => 'Mine', 'style' => []]);
        CaptionTemplate::create(['user_id' => $other->id, 'name' => 'Theirs', 'style' => []]);

        $res = $this->as($me)->getJson('/api/caption-templates')->assertOk();
        $names = array_column($res->json('data.templates'), 'name');

        $this->assertSame(['Modern', 'Bold', 'Minimal', 'Cinema', 'YouTube', 'TikTok', 'Classic', 'Mine'], $names);
        $this->assertSame(68, $res->json('data.templates.1.style.fontSize'));
        $this->assertTrue($res->json('data.templates.7.is_owner'));
        $this->assertArrayNotHasKey('user_id', $res->json('data.templates.7'));
    }

    public function test_create_normalises_style_and_rejects_invalid_values(): void
    {
        $me = User::factory()->create();

        $this->as($me)->postJson('/api/caption-templates', [
            'name' => 'මගේ style',
            'style' => ['textColor' => '#ff0000', 'fontSize' => 999, 'junk' => true],
        ])->assertStatus(201)
            ->assertJsonPath('data.template.name', 'මගේ style')
            ->assertJsonPath('data.template.style.textColor', '#FF0000')
            ->assertJsonPath('data.template.style.fontSize', 300)
            ->assertJsonMissingPath('data.template.style.junk');

        $this->as($me)->postJson('/api/caption-templates', ['name' => 'x', 'style' => ['animation' => 'explode']])
            ->assertStatus(422)->assertJsonValidationErrors('style');
        $this->as($me)->postJson('/api/caption-templates', ['style' => []])->assertStatus(422);
    }

    public function test_users_delete_only_their_own_non_system_templates(): void
    {
        $me = User::factory()->create();
        $mine = CaptionTemplate::create(['user_id' => $me->id, 'name' => 'Mine', 'style' => []]);
        $theirs = CaptionTemplate::create(['user_id' => User::factory()->create()->id, 'name' => 'Theirs', 'style' => []]);
        CaptionTemplate::syncSystemTemplates();
        $system = CaptionTemplate::where('slug', 'bold')->firstOrFail();

        $this->as($me)->deleteJson("/api/caption-templates/{$theirs->uuid}")->assertStatus(403);
        $this->as($me)->deleteJson("/api/caption-templates/{$system->uuid}")->assertStatus(403);
        $this->as($me)->deleteJson("/api/caption-templates/{$mine->uuid}")->assertOk();
        $this->assertSoftDeleted($mine);
    }

    public function test_system_template_sync_is_idempotent(): void
    {
        CaptionTemplate::syncSystemTemplates();
        CaptionTemplate::syncSystemTemplates();

        $this->assertSame(7, CaptionTemplate::where('is_system', true)->count());
    }
}
