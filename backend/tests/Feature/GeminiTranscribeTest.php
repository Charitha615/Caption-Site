<?php

namespace Tests\Feature;

use App\Exceptions\AIProviderException;
use App\Jobs\ProcessUploadedVideoJob;
use App\Models\Caption;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\Transcript;
use App\Models\User;
use App\Services\AI\CaptionLineBuilder;
use App\Services\AI\FallbackTranscriber;
use App\Services\AI\GeminiAIProvider;
use App\Services\AI\GeminiCaptionRefiner;
use App\Services\AI\GeminiKeyVerifier;
use App\Services\AI\GeminiTranscribeProvider;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Sleep;
use Tests\TestCase;

/** Gemini 3.5 Transcribe (speech → timed words) + Gemini Flash clean-up. */
class GeminiTranscribeTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'AIzaSyTEST_user_key_1234567890abcd';

    private string $audio;

    protected function setUp(): void
    {
        parent::setUp();
        Sleep::fake();
        config([
            'ai.provider' => 'gemini',
            'ai.gemini.base_url' => 'https://gemini.test/v1beta',
            'ai.gemini.upload_url' => 'https://gemini.test/upload/v1beta',
            'ai.gemini.transcribe_model' => 'gemini-3.5-transcribe',
            'ai.gemini.model' => 'gemini-3.8-flash',
            'ai.gemini.fallback_models' => [],
        ]);
        $this->audio = tempnam(sys_get_temp_dir(), 'aud').'.mp3';
        file_put_contents($this->audio, str_repeat('a', 2048));
    }

    protected function tearDown(): void
    {
        @unlink($this->audio);
        parent::tearDown();
    }

    /** Files API + Interactions fakes; $words = [[text, start, end, speaker], …] */
    private function fakeTranscribe(array $words, int $status = 200, ?array $cleanup = null): void
    {
        $annotations = array_map(fn ($w) => ['type' => 'word_info', 'text' => $w[0], 'start_offset' => $w[1].'s', 'end_offset' => $w[2].'s', 'speaker' => $w[3] ?? 'spk_1'], $words);
        Http::fake([
            'gemini.test/upload/v1beta/files' => Http::response([], 200, ['x-goog-upload-url' => 'https://gemini.test/session/1']),
            'gemini.test/session/1' => Http::response(['file' => ['name' => 'files/a1', 'uri' => 'https://gemini.test/v1beta/files/a1', 'state' => 'ACTIVE']]),
            'gemini.test/v1beta/interactions' => $status === 200
                ? Http::response(['id' => 'interactions/x', 'status' => 'completed', 'steps' => [['type' => 'model_output', 'content' => [['type' => 'text', 'text' => implode(' ', array_column($words, 0)), 'annotations' => $annotations]]]]])
                : Http::response(['error' => ['message' => 'Model not found']], $status),
            'gemini.test/v1beta/models/gemini-3.8-flash:generateContent' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($cleanup ?? ['captions' => [['text' => 'fallback line', 'start' => 0, 'end' => 1]]], JSON_UNESCAPED_UNICODE)]]], 'finishReason' => 'STOP']]]),
            'gemini.test/v1beta/files/a1' => Http::response([]),
        ]);
    }

    public function test_transcribe_model_returns_exact_word_timings_grouped_into_lines(): void
    {
        $this->fakeTranscribe([
            ['ආයුබෝවන්', 0.10, 0.80], ['මිතුරනි.', 0.85, 1.40], ['අද', 1.45, 1.60], ['අපි', 1.62, 1.90],
            ['AI', 3.00, 3.20, 'spk_2'], ['captions', 3.25, 3.90, 'spk_2'], // pause + new speaker → new line
        ]);

        $result = (new GeminiTranscribeProvider(apiKey: self::KEY, isUserKey: true))->transcribe($this->audio, 'si', ['duration' => 10.0]);

        $this->assertCount(2, $result['segments']);
        $this->assertSame('ආයුබෝවන් මිතුරනි. අද අපි', $result['segments'][0]['text']);
        $this->assertSame('si', $result['segments'][0]['language']);
        $this->assertSame([0.1, 0.85, 1.45, 1.62], array_column($result['segments'][0]['words'], 'start'), 'timestamps preserved exactly');
        $this->assertSame('en', $result['segments'][1]['language']);
        $this->assertSame('spk_2', $result['segments'][1]['speaker']);

        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/interactions')
            && $r['model'] === 'models/gemini-3.5-transcribe'
            && $r['generation_config']['transcription_config']['mode']['timestamp_granularities'] === ['word']
            && $r['generation_config']['transcription_config']['language_codes'] === ['si-LK']
            && $r['input'][0] === ['type' => 'audio', 'uri' => 'https://gemini.test/v1beta/files/a1', 'mime_type' => 'audio/mpeg']
            && $r->hasHeader('x-goog-api-key', self::KEY));
    }

    public function test_auto_and_mixed_speech_use_language_auto_detection(): void
    {
        $this->fakeTranscribe([['මේක', 0.1, 0.4], ['really', 0.5, 0.9], ['හොඳයි', 1.0, 1.5]]);

        $result = (new GeminiTranscribeProvider(apiKey: self::KEY))->transcribe($this->audio, 'auto');

        $this->assertSame('si', $result['language']);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/interactions') && ! isset($r['generation_config']['transcription_config']['language_codes']));
    }

    public function test_rejected_sinhala_hint_is_retried_with_auto_detection(): void
    {
        $calls = 0;
        Http::fake([
            'gemini.test/upload/v1beta/files' => Http::response([], 200, ['x-goog-upload-url' => 'https://gemini.test/session/1']),
            'gemini.test/session/1' => Http::response(['file' => ['name' => 'files/a1', 'uri' => 'u', 'state' => 'ACTIVE']]),
            'gemini.test/v1beta/interactions' => function (Request $r) use (&$calls) {
                $calls++;

                return isset($r['generation_config']['transcription_config']['language_codes'])
                    ? Http::response(['error' => ['message' => 'Unsupported language code si-LK']], 400)
                    : Http::response(['status' => 'completed', 'steps' => [['content' => [['type' => 'text', 'text' => 'හරි', 'annotations' => [['type' => 'word_info', 'text' => 'හරි', 'start_offset' => '0.2s', 'end_offset' => '0.6s']]]]]]]);
            },
            'gemini.test/v1beta/files/a1' => Http::response([]),
        ]);

        $result = (new GeminiTranscribeProvider(apiKey: self::KEY))->transcribe($this->audio, 'si');

        $this->assertSame(2, $calls);
        $this->assertSame('හරි', $result['segments'][0]['text']);
    }

    public function test_falls_back_to_the_text_model_when_the_transcribe_model_is_unavailable(): void
    {
        $this->fakeTranscribe([], 404);
        $chain = new FallbackTranscriber(new GeminiTranscribeProvider(apiKey: self::KEY), new GeminiAIProvider(apiKey: self::KEY));

        $result = $chain->transcribe($this->audio, 'si');

        $this->assertSame('fallback line', $result['segments'][0]['text']);
        $this->assertSame('gemini', $chain->name());
    }

    public function test_refiner_accepts_cleanup_but_rejects_translation_and_mismatches(): void
    {
        $this->assertTrue(GeminiCaptionRefiner::acceptable('ආයුබෝවන් මිතුරනි', 'ආයුබෝවන්, මිතුරනි!'));
        $this->assertTrue(GeminiCaptionRefiner::acceptable('ලංකාවේ බයික් ෂෝරූම් එකකට ගියොත්', 'ලංකාවේ bike showroom එකකට ගියොත්'), 'loanwords to English');
        $this->assertFalse(GeminiCaptionRefiner::acceptable('මම අද ගෙදර යනවා', 'I am going home today'), 'full translation');
        $this->assertFalse(GeminiCaptionRefiner::acceptable('ආයුබෝවන් මිතුරනි', 'Hello friends'), 'translation');
        $this->assertFalse(GeminiCaptionRefiner::acceptable('hello there friends', 'hi'), 'rewrite');
        $this->assertFalse(GeminiCaptionRefiner::acceptable('hello', ''));

        Http::fake(['gemini.test/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => '{"lines":["only one"]}']]]]]])]);
        $out = (new GeminiCaptionRefiner(self::KEY))->refine([['text' => 'a b', 'language' => 'en'], ['text' => 'c d', 'language' => 'en']], 'en');
        $this->assertSame(['a b', 'c d'], $out, 'count mismatch keeps originals');
    }

    public function test_line_builder_splits_long_runs_and_sentences(): void
    {
        $words = [];
        foreach (range(0, 11) as $i) {
            $words[] = ['word' => $i === 4 ? 'end.' : 'word', 'start' => $i * 0.3, 'end' => $i * 0.3 + 0.25];
        }

        $lines = CaptionLineBuilder::build($words, 'en');

        $this->assertSame('word word word word end.', $lines[0]['text']);
        $this->assertLessThanOrEqual(CaptionLineBuilder::MAX_WORDS, count($lines[1]['words']));
    }

    public function test_pipeline_transcribes_and_reviews_each_part_keeping_the_original(): void
    {
        Storage::fake('local');
        config(['ai.gemini.transcribe_chunk_seconds' => 60, 'ai.gemini.mixed_transcription' => false]);
        $this->app->instance(VideoServiceInterface::class, new class implements VideoServiceInterface
        {
            public function getMetadata(string $filePath): array
            {
                return ['duration' => 100.0, 'width' => 720, 'height' => 1280, 'fps' => 30.0, 'codec' => 'h264', 'audio_codec' => 'aac', 'sample_rate' => 48000, 'channels' => 1, 'has_audio' => true];
            }

            public function extractAudio(string $videoPath, string $outputPath, float $leadInSeconds = 0.0): string
            {
                file_put_contents($outputPath, 'audio');

                return $outputPath;
            }

            public function splitAudio(string $audioPath, float $totalSeconds, int $seconds, string $outputDir): array
            {
                @mkdir($outputDir, 0700, true);
                file_put_contents("{$outputDir}/0.mp3", 'a');
                file_put_contents("{$outputDir}/1.mp3", 'a');

                return [['path' => "{$outputDir}/0.mp3", 'offset' => 0.0, 'duration' => 60.0], ['path' => "{$outputDir}/1.mp3", 'offset' => 60.0, 'duration' => 40.0]];
            }

            public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): bool
            {
                return false;
            }
        });
        // The listening review hears a word the transcriber missed ("මගේ").
        $this->fakeTranscribe([['ආයුබෝවන්', 1.0, 1.6], ['මිතුරනි', 2.0, 2.4]], cleanup: ['lines' => ['ආයුබෝවන් මගේ මිතුරනි']]);

        $owner = User::factory()->create();
        $owner->forceFill(['gemini_api_key' => self::KEY, 'gemini_key_hint' => 'abcd', 'gemini_key_status' => 'valid'])->save();
        $project = Project::factory()->create(['user_id' => $owner->id, 'status' => Project::STATUS_UPLOADED]);
        Storage::disk('local')->put('media/v.mp4', 'v');
        $media = MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/v.mp4', 'file_name' => 'v.mp4', 'original_name' => 'v.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 1]);

        ProcessUploadedVideoJob::dispatchSync($project, $media, 'si');

        $this->assertSame(Project::STATUS_READY, $project->fresh()->status, (string) $project->fresh()->processing_error);
        $captions = Caption::where('project_id', $project->id)->orderBy('sequence')->get();
        $this->assertCount(2, $captions, 'one line per 60 s chunk');
        $this->assertSame(60.0, (float) $captions[1]->start_time, 'second chunk shifted by its offset, minus the 1 s lead-in');

        $first = $captions[0];
        $this->assertSame('ආයුබෝවන් මගේ මිතුරනි', $first->text);
        $this->assertSame('ආයුබෝවන් මිතුරනි', $first->metadata['original_text']);
        $this->assertTrue($first->metadata['cleaned']);
        $this->assertTrue($first->metadata['reviewed']);
        $this->assertSame(['ආයුබෝවන්', 'මගේ', 'මිතුරනි'], array_column($first->metadata['words'], 'word'));
        $this->assertEquals([0.0, 0.6, 1.0], array_column($first->metadata['words'], 'start'), 'heard words keep their time; the added word fills the gap; lead-in removed');
        $this->assertSame('gemini-transcribe', $first->metadata['source']['transcriber']);
        $this->assertSame('gemini-3.8-flash', $first->metadata['source']['cleanup']);

        $transcript = Transcript::where('project_id', $project->id)->first();
        $this->assertStringContainsString('ආයුබෝවන් මිතුරනි', $transcript->raw_text);
        $this->assertSame('ආයුබෝවන් මිතුරනි', $transcript->words_json[0]['text'], 'original transcript is not cleaned');
        $this->assertSame(['ආයුබෝවන්', 'මිතුරනි'], array_column($transcript->words_json[0]['words'], 'word'), 'original word timestamps kept');

        // Each part was reviewed against its own audio, in order.
        $reviews = Http::recorded(fn (Request $r) => str_contains($r->url(), 'gemini-3.8-flash:generateContent'))->values();
        $this->assertCount(2, $reviews);
        $this->assertSame('audio/mpeg', $reviews[0][0]['contents'][0]['parts'][0]['inline_data']['mime_type']);
        $this->assertStringContainsString('"time":"1.0-2.4"', $reviews[0][0]['contents'][0]['parts'][1]['text'], 'line times relative to the part');
    }

    public function test_verify_reports_whether_the_key_can_use_the_transcribe_model(): void
    {
        Http::fake([
            'gemini.test/v1beta/models/gemini-3.8-flash' => Http::response(['name' => 'models/gemini-3.8-flash']),
            'gemini.test/v1beta/models/gemini-3.5-transcribe' => Http::response(['error' => ['message' => 'not found']], 404),
        ]);

        $check = app(GeminiKeyVerifier::class)->verify(self::KEY);

        $this->assertSame('valid', $check['result']);
        $this->assertStringContainsString("can't use gemini-3.5-transcribe", $check['message']);
    }

    public function test_an_unrelated_bad_request_does_not_trigger_the_language_retry(): void
    {
        $calls = 0;
        Http::fake([
            'gemini.test/upload/v1beta/files' => Http::response([], 200, ['x-goog-upload-url' => 'https://gemini.test/session/1']),
            'gemini.test/session/1' => Http::response(['file' => ['name' => 'files/a1', 'uri' => 'u', 'state' => 'ACTIVE']]),
            'gemini.test/v1beta/interactions' => function () use (&$calls) {
                $calls++;

                return Http::response(['error' => ['message' => "The value 'x' is not supported for 'type' at 'input[0]'."]], 400);
            },
            'gemini.test/v1beta/files/a1' => Http::response([]),
        ]);

        try {
            (new GeminiTranscribeProvider(apiKey: self::KEY))->transcribe($this->audio, 'si');
        } catch (AIProviderException) {
        }

        $this->assertSame(1, $calls);
    }

    public function test_lead_in_silence_is_removed_and_first_word_starts_at_zero(): void
    {
        $result = ProcessUploadedVideoJob::shiftTimeline(['segments' => [
            ['text' => '2026 දී', 'start' => 1.02, 'end' => 2.1, 'words' => [['word' => '2026', 'start' => 1.02, 'end' => 1.6], ['word' => 'දී', 'start' => 1.6, 'end' => 2.1]]],
            ['text' => 'after the end', 'start' => 31.5, 'end' => 32.0, 'words' => []],
        ]], -1.0, 30.0);

        $this->assertCount(1, $result['segments'], 'lines beyond the video are dropped');
        $this->assertSame(0.02, $result['segments'][0]['start']);
        $this->assertSame([0.02, 0.6], array_column($result['segments'][0]['words'], 'start'));
    }

    public function test_listening_review_may_fix_and_add_words_but_not_translate_or_drop_the_line(): void
    {
        $this->assertTrue(GeminiCaptionRefiner::reviewAcceptable('මේ ටොයොටා අක්වා', 'මේ තමයි Toyota Aqua'), 'fixes and added words');
        $this->assertFalse(GeminiCaptionRefiner::reviewAcceptable('මේ තමයි අපේ අලුත් වාහනය', 'This is our new vehicle'), 'translation');
        $this->assertFalse(GeminiCaptionRefiner::reviewAcceptable('මේ තමයි අපේ අලුත් වාහනය', ''), 'emptied');
        $this->assertFalse(GeminiCaptionRefiner::reviewAcceptable('එක දෙක', 'එක දෙක තුන හතර පහ හය සත අට නවය'), 'ballooned');
    }

    public function test_busy_text_model_falls_back_to_the_backup_model(): void
    {
        Sleep::fake();
        config(['ai.gemini.fallback_models' => ['gemini-flash-latest']]);
        Http::fake([
            'gemini.test/v1beta/models/gemini-3.8-flash:generateContent' => Http::response(['error' => ['message' => 'This model is currently experiencing high demand.']], 503),
            'gemini.test/v1beta/models/gemini-flash-latest:generateContent' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode(['lines' => ['මේ Toyota Aqua එක']], JSON_UNESCAPED_UNICODE)]]]]]]),
        ]);
        $audio = tempnam(sys_get_temp_dir(), 'a');
        file_put_contents($audio, 'mp3');

        $refiner = new GeminiCaptionRefiner(self::KEY, 'gemini-3.8-flash', 'https://gemini.test/v1beta');
        $lines = $refiner->refine([['text' => 'මේ ටොයොටා අක්වා එක', 'language' => 'si', 'start' => 0.0, 'end' => 2.0]], 'si', $audio);

        $this->assertSame(['මේ Toyota Aqua එක'], $lines);
        $this->assertSame('gemini-flash-latest', $refiner->model());
        @unlink($audio);
    }

    public function test_flash_writes_mixed_script_words_timed_by_the_transcribe_model(): void
    {
        Storage::fake('local');
        config(['ai.gemini.mixed_models' => ['gemini-3.5-flash']]);
        $this->app->instance(VideoServiceInterface::class, new class implements VideoServiceInterface
        {
            public function getMetadata(string $filePath): array
            {
                return ['duration' => 12.0, 'width' => 720, 'height' => 1280, 'fps' => 30.0, 'codec' => 'h264', 'audio_codec' => 'aac', 'sample_rate' => 48000, 'channels' => 1, 'has_audio' => true];
            }

            public function extractAudio(string $videoPath, string $outputPath, float $leadInSeconds = 0.0): string
            {
                file_put_contents($outputPath, 'audio');

                return $outputPath;
            }

            public function splitAudio(string $audioPath, float $totalSeconds, int $seconds, string $outputDir): array
            {
                return [];
            }

            public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): bool
            {
                return false;
            }
        });
        // The transcribe model hears 3 words and writes the English brand in Sinhala letters;
        // it also misses "මගේ" and "hybrid".
        $this->fakeTranscribe([['ආයුබෝවන්', 1.0, 1.6], ['ටොයොටා', 2.0, 2.4], ['මිතුරනි', 3.0, 3.6]]);
        Http::fake([
            'gemini.test/v1beta/models/gemini-3.5-flash:generateContent' => Http::response(['candidates' => [['content' => ['parts' => [
                ['text' => 'thinking…', 'thought' => true],
                ['text' => "ආයුබෝවන් මගේ Toyota hybrid මිතුරනි\n"],
            ]]]]]),
        ]);

        $owner = User::factory()->create();
        $owner->forceFill(['gemini_api_key' => self::KEY, 'gemini_key_hint' => 'abcd', 'gemini_key_status' => 'valid'])->save();
        $project = Project::factory()->create(['user_id' => $owner->id, 'status' => Project::STATUS_UPLOADED, 'vocabulary' => 'Toyota Aqua, Talk and Tune']);
        Storage::disk('local')->put('media/v.mp4', 'v');
        $media = MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/v.mp4', 'file_name' => 'v.mp4', 'original_name' => 'v.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 1]);

        ProcessUploadedVideoJob::dispatchSync($project, $media, 'auto');

        $this->assertSame(Project::STATUS_READY, $project->fresh()->status, (string) $project->fresh()->processing_error);
        $captions = Caption::where('project_id', $project->id)->orderBy('sequence')->get();
        $this->assertSame('ආයුබෝවන් මගේ Toyota hybrid මිතුරනි', $captions->pluck('text')->implode(' '));

        $words = collect($captions)->flatMap(fn ($c) => $c->metadata['words'])->keyBy('word');
        $this->assertEquals(0.0, $words['ආයුබෝවන්']['start'], 'heard word keeps its time (minus the 1 s lead-in)');
        $this->assertEquals(1.0, $words['Toyota']['start'], '"Toyota" matched to the heard "ටොයොටා"');
        $this->assertEquals(2.0, $words['මිතුරනි']['start']);
        $this->assertTrue($words['hybrid']['start'] >= 1.4 && $words['hybrid']['end'] <= 2.0, 'missed word placed in the gap');
        $this->assertSame('gemini-3.5-flash', $captions[0]->metadata['source']['transcriber']);

        $this->assertSame('ආයුබෝවන් ටොයොටා මිතුරනි', Transcript::where('project_id', $project->id)->value('raw_text'), 'what the transcribe model heard is kept');
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'gemini-3.5-flash:generateContent')
            && str_contains($r['contents'][0]['parts'][1]['text'], 'මට Door එක අරගන්න ඕන')
            && str_contains($r['contents'][0]['parts'][1]['text'], 'Toyota Aqua, Talk and Tune'));
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'gemini-3.8-flash'), 'no separate review needed');
    }
}
