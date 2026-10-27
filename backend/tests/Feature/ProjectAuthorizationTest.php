<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_project(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/projects', [
                'name' => 'Sinhala Travel Vlog #1',
                'description' => 'A tour in Kandy',
                'language' => 'si',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Project created successfully',
                'data' => [
                    'project' => [
                        'name' => 'Sinhala Travel Vlog #1',
                        'language' => 'si',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('projects', [
            'user_id' => $user->id,
            'name' => 'Sinhala Travel Vlog #1',
        ]);
    }

    public function test_user_only_sees_their_own_projects_in_list(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        Project::factory()->create(['user_id' => $userA->id, 'name' => 'Project User A']);
        Project::factory()->create(['user_id' => $userB->id, 'name' => 'Project User B']);

        $tokenA = $userA->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->getJson('/api/projects');

        $response->assertStatus(200);
        $projects = $response->json('data.projects');

        $this->assertCount(1, $projects);
        $this->assertEquals('Project User A', $projects[0]['name']);
    }

    public function test_user_cannot_view_another_users_project(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $projectB = Project::factory()->create(['user_id' => $userB->id]);

        $tokenA = $userA->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->getJson("/api/projects/{$projectB->uuid}");

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_user_cannot_update_another_users_project(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $projectB = Project::factory()->create([
            'user_id' => $userB->id,
            'name' => 'Original Name',
        ]);

        $tokenA = $userA->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->patchJson("/api/projects/{$projectB->uuid}", [
                'name' => 'Hacked Name',
            ]);

        $response->assertStatus(403);

        $this->assertEquals('Original Name', $projectB->fresh()->name);
    }

    public function test_user_cannot_delete_another_users_project(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $projectB = Project::factory()->create(['user_id' => $userB->id]);

        $tokenA = $userA->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->deleteJson("/api/projects/{$projectB->uuid}");

        $response->assertStatus(403);

        $this->assertDatabaseHas('projects', [
            'id' => $projectB->id,
            'deleted_at' => null,
        ]);
    }

    public function test_user_can_update_own_project(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create([
            'user_id' => $user->id,
            'name' => 'Initial Title',
        ]);

        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->patchJson("/api/projects/{$project->uuid}", [
                'name' => 'Updated Video Title',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'project' => [
                        'name' => 'Updated Video Title',
                    ],
                ],
            ]);

        $this->assertEquals('Updated Video Title', $project->fresh()->name);
    }

    public function test_user_can_delete_own_project(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);

        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/projects/{$project->uuid}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Project deleted successfully',
            ]);

        $this->assertSoftDeleted('projects', [
            'id' => $project->id,
        ]);
    }
}
