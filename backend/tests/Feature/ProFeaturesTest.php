<?php

namespace Tests\Feature;

use App\Models\Export;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\User;
use App\Services\Rendering\AssCaptionRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** What Free leaves out: HD+ exports, word-highlight styles, editor AI tools; and the watermark. */
class ProFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private function projectWithVideo(User $user, string $animation = 'fade'): Project
    {
        Storage::fake('public');
        Storage::disk('public')->put('media/v.mp4', 'video');
        $project = Project::factory()->create(['user_id' => $user->id, 'settings' => ['editor' => ['version' => 2, 'style' => ['animation' => $animation]]]]);
        $project->captions()->create(['sequence' => 1, 'start_time' => 0, 'end_time' => 2, 'text' => 'ආයුබෝවන්', 'language' => 'si']);
        MediaFile::create([
            'project_id' => $project->id, 'file_path' => 'media/v.mp4', 'file_name' => 'v.mp4', 'original_name' => 'v.mp4',
            'disk' => 'public', 'mime_type' => 'video/mp4', 'file_size' => 5, 'duration' => 4.0, 'width' => 1920, 'height' => 1080,
        ]);

        return $project;
    }

    public function test_free_mp4_exports_are_720p_with_a_watermark(): void
    {
        Queue::fake();
        [$user, $headers] = $this->userWithToken();
        $url = '/api/projects/'.$this->projectWithVideo($user)->uuid.'/exports';

        $this->withHeaders($headers)->postJson($url, ['type' => 'mp4', 'resolution' => '1080'])
            ->assertStatus(402)->assertJsonPath('code', 'usage_limit_exceeded');

        $this->withHeaders($headers)->postJson($url, ['type' => 'mp4'])->assertCreated();
        $meta = Export::first()->metadata;
        $this->assertTrue($meta['watermark']);
        $this->assertSame(720, min($meta['width'], $meta['height']));
    }

    public function test_pro_exports_full_hd_without_a_watermark(): void
    {
        Queue::fake();
        $user = User::factory()->pro()->create();
        $headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];

        $this->withHeaders($headers)->postJson('/api/projects/'.$this->projectWithVideo($user, 'karaoke')->uuid.'/exports', ['type' => 'mp4', 'resolution' => '1080'])->assertCreated();
        $this->assertFalse(Export::first()->metadata['watermark']);
    }

    public function test_word_highlight_styles_need_pro(): void
    {
        Queue::fake();
        [$user, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->postJson('/api/projects/'.$this->projectWithVideo($user, 'highlight')->uuid.'/exports', ['type' => 'mp4'])
            ->assertStatus(402)->assertJsonPath('code', 'usage_limit_exceeded')->assertJsonFragment(['message' => 'Word-by-word highlight styles (Spotlight, Hormozi, Word Box, TikTok) are part of Pro. Pick another style, or upgrade to Pro.']);
    }

    public function test_editor_ai_tools_need_pro_but_singlish_typing_is_free(): void
    {
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->postJson('/api/video-editor/ai/text', ['task' => 'titles', 'context' => 'Ella', 'language' => 'en'])->assertStatus(402);
        $this->withHeaders($headers)->post('/api/video-editor/ai/speech', ['text' => 'ආයුබෝවන්', 'voice' => 'Kore'], ['Accept' => 'application/json'])->assertStatus(402);
        $this->withHeaders($headers)->postJson('/api/video-editor/ai/text', ['task' => 'singlish', 'lines' => ['kohomada']])->assertOk();
    }

    public function test_watermark_is_a_top_layer_line_for_the_whole_video(): void
    {
        $ass = app(AssCaptionRenderer::class)->render([['start' => 0, 'end' => 2, 'text' => 'Hi']], [], 1280, 720, 'සිංSub', 95.5);

        $this->assertMatchesRegularExpression('/^Dialogue: 99,0:00:00\.00,0:01:36\.50,Watermark,.*සිංSub$/m', $ass);
        $this->assertStringContainsString('Style: Watermark,', $ass);
        $this->assertStringNotContainsString('Watermark,,', app(AssCaptionRenderer::class)->render([['start' => 0, 'end' => 2, 'text' => 'Hi']], [], 1280, 720));
    }

    public function test_new_projects_on_free_start_with_a_style_free_can_export(): void
    {
        [, $headers] = $this->userWithToken();
        $pro = User::factory()->pro()->create();

        $free = $this->withHeaders($headers)->postJson('/api/projects', ['name' => 'Reel'])->assertCreated()->json('data.project.uuid');
        $style = Project::where('uuid', $free)->first()->settings['editor']['style'];
        $this->assertSame('bold', $style['preset']);
        $this->assertNotContains($style['animation'], config('plans.premium_animations'));

        $this->app['auth']->forgetGuards();
        $proProject = $this->withToken($pro->createToken('t')->plainTextToken)->postJson('/api/projects', ['name' => 'Long video'])->assertCreated()->json('data.project.uuid');
        $this->assertArrayNotHasKey('editor', Project::where('uuid', $proProject)->first()->settings ?? []);
    }
}
