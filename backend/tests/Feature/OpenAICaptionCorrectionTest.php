<?php

namespace Tests\Feature;

use App\Jobs\ProcessUploadedVideoJob;
use App\Models\Caption;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\AI\AIProviderFactory;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Sleep;
use Tests\TestCase;

/** OpenAI final correction pass over generated captions (after Gemini). */
class OpenAICaptionCorrectionTest extends TestCase
{
    use RefreshDatabase;

    private const OPENAI = 'https://openai.test/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();
        Sleep::fake();
        Storage::fake('local');
        config([
            'ai.provider' => 'gemini',
            'ai.gemini.base_url' => 'https://gemini.test/v1beta',
            'ai.gemini.upload_url' => 'https://gemini.test/upload/v1beta',
            'ai.gemini.transcribe_model' => 'gemini-3.5-transcribe',
            'ai.gemini.fallback_models' => [],
            'ai.gemini.caption_cleanup' => false,
            'ai.gemini.mixed_transcription' => false,
            'ai.openai.api_key' => 'sk-test',
            'ai.openai.model' => 'gpt-test',
            'ai.openai.base_url' => 'https://openai.test/v1',
        ]);
        $this->app->instance(VideoServiceInterface::class, new class implements VideoServiceInterface
        {
            public function getMetadata(string $filePath): array
            {
                return ['duration' => 20.0, 'width' => 720, 'height' => 1280, 'fps' => 30.0, 'codec' => 'h264', 'audio_codec' => 'aac', 'sample_rate' => 48000, 'channels' => 1, 'has_audio' => true];
            }

            public function extractAudio(string $videoPath, string $outputPath, float $leadInSeconds = 0.0): string
            {
                file_put_contents($outputPath, 'audio');

                return $outputPath;
            }

            public function splitAudio(string $audioPath, float $totalSeconds, int $seconds, string $outputDir): array
            {
                return [['path' => $audioPath, 'offset' => 0.0, 'duration' => $totalSeconds]];
            }

            public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): bool
            {
                return false;
            }
        });
    }

    /** Gemini hears "මේ කීබෝඩ් එක" (a word the built-in English list does not know). */
    private function fakeApis(mixed $openai): void
    {
        $words = [['මේ', 1.0, 1.4], ['කීබෝඩ්', 1.4, 2.0], ['එක', 2.0, 2.4]];
        $annotations = array_map(fn ($w) => ['type' => 'word_info', 'text' => $w[0], 'start_offset' => $w[1].'s', 'end_offset' => $w[2].'s', 'speaker' => 'spk_1'], $words);
        Http::fake([
            'gemini.test/upload/v1beta/files' => Http::response([], 200, ['x-goog-upload-url' => 'https://gemini.test/session/1']),
            'gemini.test/session/1' => Http::response(['file' => ['name' => 'files/a1', 'uri' => 'https://gemini.test/v1beta/files/a1', 'state' => 'ACTIVE']]),
            'gemini.test/v1beta/interactions' => Http::response(['id' => 'interactions/x', 'status' => 'completed', 'steps' => [['type' => 'model_output', 'content' => [['type' => 'text', 'text' => 'මේ කීබෝඩ් එක', 'annotations' => $annotations]]]]]),
            'gemini.test/v1beta/files/a1' => Http::response([]),
            'openai.test/*' => $openai,
        ]);
    }

    private function runPipeline(): Project
    {
        $owner = User::factory()->create();
        $owner->forceFill(['gemini_api_key' => 'AIzaSyTEST_user_key_1234567890abcd', 'gemini_key_hint' => 'abcd', 'gemini_key_status' => 'valid'])->save();
        $project = Project::factory()->create(['user_id' => $owner->id, 'status' => Project::STATUS_UPLOADED]);
        Storage::disk('local')->put('media/v.mp4', 'v');
        $media = MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/v.mp4', 'file_name' => 'v.mp4', 'original_name' => 'v.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 1]);

        ProcessUploadedVideoJob::dispatchSync($project, $media, 'si');

        $this->assertSame(Project::STATUS_READY, $project->fresh()->status, (string) $project->fresh()->processing_error);

        return $project;
    }

    private static function answer(array $lines): array
    {
        return ['choices' => [['message' => ['content' => json_encode(['lines' => $lines], JSON_UNESCAPED_UNICODE)]]]];
    }

    public function test_generated_captions_get_english_words_in_english_letters_keeping_word_timings(): void
    {
        $this->fakeApis(Http::response(self::answer(['මේ keyboard එක'])));

        $project = $this->runPipeline();

        $caption = Caption::where('project_id', $project->id)->sole();
        $this->assertSame('මේ keyboard එක', $caption->text);
        $this->assertSame('මේ කීබෝඩ් එක', $caption->metadata['original_text'], 'transcription kept for review/restore');
        $this->assertSame(['මේ', 'keyboard', 'එක'], array_column($caption->metadata['words'], 'word'));
        $this->assertEquals([0.0, 0.4, 1.0], array_column($caption->metadata['words'], 'start'), 'word timings unchanged (lead-in removed)');
        $this->assertTrue(UsageRecord::where('project_id', $project->id)->where('metadata->provider', 'openai-correction')->exists());

        $request = Http::recorded(fn (Request $r) => $r->url() === self::OPENAI)->sole()[0];
        $this->assertSame('Bearer sk-test', $request->header('Authorization')[0]);
        $this->assertSame('gpt-test', $request['model']);
        $this->assertSame('["මේ කීබෝඩ් එක"]', $request['messages'][1]['content']);
    }

    public function test_a_translation_from_openai_is_rejected(): void
    {
        $this->fakeApis(Http::response(self::answer(['This is the keyboard'])));

        $caption = Caption::where('project_id', $this->runPipeline()->id)->sole();

        $this->assertSame('මේ කීබෝඩ් එක', $caption->text);
    }

    public function test_openai_failure_keeps_the_gemini_captions(): void
    {
        $this->fakeApis(Http::response(['error' => ['code' => 'credit_balance_exhausted', 'message' => 'You have no credits remaining.']], 429));

        $project = $this->runPipeline();

        $this->assertSame('මේ කීබෝඩ් එක', Caption::where('project_id', $project->id)->sole()->text);
        $this->assertFalse(UsageRecord::where('project_id', $project->id)->where('metadata->provider', 'openai-correction')->exists());
    }

    public function test_correction_is_off_without_a_key_and_with_the_fake_provider(): void
    {
        $factory = app(AIProviderFactory::class);
        $this->assertNotNull($factory->captionCorrector());

        config(['ai.openai.api_key' => '']);
        $this->assertNull($factory->captionCorrector());

        config(['ai.openai.api_key' => 'sk-test', 'ai.provider' => 'fake']);
        $this->assertNull($factory->captionCorrector());
    }
}
