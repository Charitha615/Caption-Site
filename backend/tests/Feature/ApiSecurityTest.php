<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_responses_carry_security_headers_and_a_request_id(): void
    {
        $response = $this->getJson('/api/brand');

        $response->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $response->headers->get('X-Request-Id'));
    }

    public function test_server_errors_hide_internals_in_production_mode(): void
    {
        config(['app.debug' => false]);
        Route::get('/api/_boom', fn () => throw new \RuntimeException('DB password=hunter2 at /var/www/app'));

        $response = $this->getJson('/api/_boom');

        $response->assertStatus(500)->assertJsonPath('code', 'server_error');
        $this->assertStringNotContainsString('hunter2', $response->getContent());
        $this->assertStringNotContainsString('/var/www', $response->getContent());
        $this->assertArrayNotHasKey('trace', $response->json());
        $this->assertNotEmpty($response->json('request_id'));
    }

    public function test_cors_allows_only_the_configured_frontend(): void
    {
        $allowed = $this->call('OPTIONS', '/api/projects', [], [], [], [
            'HTTP_ORIGIN' => 'http://localhost:5173',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ]);
        $this->assertSame('http://localhost:5173', $allowed->headers->get('Access-Control-Allow-Origin'));

        $evil = $this->call('OPTIONS', '/api/projects', [], [], [], [
            'HTTP_ORIGIN' => 'https://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ]);
        $this->assertNotSame('https://evil.example', $evil->headers->get('Access-Control-Allow-Origin'));
        $this->assertNull($evil->headers->get('Access-Control-Allow-Credentials'));
    }

    public function test_client_cannot_set_server_owned_project_fields(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id, 'status' => Project::STATUS_DRAFT]);

        $this->withHeaders($headers)->patchJson("/api/projects/{$project->uuid}", [
            'status' => 'completed', 'thumbnail' => 'javascript:alert(1)', 'duration' => 9999, 'name' => 'Renamed',
        ])->assertOk();

        $project->refresh();
        $this->assertSame('Renamed', $project->name);
        $this->assertSame(Project::STATUS_DRAFT, $project->status);
        $this->assertNull($project->thumbnail);
    }

    public function test_project_search_treats_wildcards_literally(): void
    {
        [$user, $headers] = $this->userWithToken();
        Project::factory()->create(['user_id' => $user->id, 'name' => 'Alpha', 'description' => '']);

        $this->withHeaders($headers)->getJson('/api/projects?search=%25')->assertJsonPath('data.pagination.total', 0);
        $this->withHeaders($headers)->getJson('/api/projects?search=lph')->assertJsonPath('data.pagination.total', 1);
        $this->withHeaders($headers)->getJson('/api/projects?status=hacked')->assertStatus(422);
    }

    public function test_oversized_caption_text_and_settings_are_rejected(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/captions", ['start_time' => 0, 'end_time' => 1, 'text' => str_repeat('අ', 2001)])
            ->assertStatus(422);
        $this->withHeaders($headers)->patchJson("/api/projects/{$project->uuid}", ['settings' => ['blob' => str_repeat('x', 300 * 1024)]])
            ->assertStatus(422);
    }
}
