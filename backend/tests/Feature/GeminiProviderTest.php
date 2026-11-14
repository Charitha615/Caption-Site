<?php

namespace Tests\Feature;

use App\Exceptions\AIProviderException;
use App\Services\AI\GeminiAIProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Tests\TestCase;

class GeminiProviderTest extends TestCase
{
    private string $audio;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'ai.gemini.base_url' => 'https://gemini.test/v1beta',
            'ai.gemini.upload_url' => 'https://gemini.test/upload/v1beta',
            'ai.gemini.model' => 'test-model',
            'ai.gemini.fallback_models' => [],
        ]);
        Sleep::fake(); // retry backoff must not slow the suite
        $this->audio = tempnam(sys_get_temp_dir(), 'aud').'.mp3';
        file_put_contents($this->audio, str_repeat('a', 2048));
    }

    protected function tearDown(): void
    {
        @unlink($this->audio);
        parent::tearDown();
    }

    private function provider(): GeminiAIProvider
    {
        return new GeminiAIProvider(apiKey: 'AIzaTEST_KEY_12345678901234567890');
    }

    private function candidate(array $payload, string $finish = 'STOP'): array
    {
        return [
            'candidates' => [['content' => ['parts' => [['text' => json_encode($payload, JSON_UNESCAPED_UNICODE)]]], 'finishReason' => $finish]],
            'usageMetadata' => ['promptTokenCount' => 120, 'candidatesTokenCount' => 80],
        ];
    }

    public function test_transcribes_sinhala_with_key_in_header_never_in_url(): void
    {
        Http::fake(['gemini.test/*' => Http::response($this->candidate([
            'language' => 'si',
            'captions' => [
                ['text' => 'ශ්‍රී ලංකාව', 'language' => 'si', 'start' => 0.4, 'end' => 1.9],
                ['text' => '  ', 'start' => 2, 'end' => 3],                  // dropped: empty
                ['text' => 'past the end', 'start' => 99, 'end' => 100],    // dropped: beyond duration
            ],
        ]))]);

        $result = $this->provider()->transcribe($this->audio, 'si', ['duration' => 10.0]);

        $this->assertSame('si', $result['language']);
        $this->assertCount(1, $result['segments']);
        $this->assertSame('ශ්‍රී ලංකාව', $result['segments'][0]['text'], 'ZWJ conjunct preserved');
        $this->assertNotEmpty($result['segments'][0]['words']);
        $this->assertSame(120, $result['usage']['input_tokens']);

        Http::assertSent(function (Request $request) {
            return $request->hasHeader('x-goog-api-key', 'AIzaTEST_KEY_12345678901234567890')
                && ! str_contains($request->url(), 'AIza')
                && str_contains($request->url(), 'models/test-model:generateContent')
                && isset($request['contents'][0]['parts'][0]['inlineData']);
        });
    }

    public function test_large_audio_uses_the_files_api_and_cleans_up(): void
    {
        config(['ai.gemini.inline_max_bytes' => 100]);
        Http::fake([
            'gemini.test/upload/v1beta/files' => Http::response(['ok' => true], 200, ['x-goog-upload-url' => 'https://gemini.test/session/abc']),
            'gemini.test/session/abc' => Http::response(['file' => ['name' => 'files/f1', 'uri' => 'https://gemini.test/v1beta/files/f1', 'state' => 'ACTIVE']]),
            'gemini.test/v1beta/models/*' => Http::response($this->candidate(['captions' => [['text' => 'Hello', 'start' => 0, 'end' => 1]]])),
            'gemini.test/v1beta/files/f1' => Http::response([], 200),
        ]);

        $result = $this->provider()->transcribe($this->audio, 'en');

        $this->assertSame('Hello', $result['segments'][0]['text']);
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'models/') && ($r['contents'][0]['parts'][0]['fileData']['fileUri'] ?? null) === 'https://gemini.test/v1beta/files/f1');
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && str_ends_with($r->url(), 'files/f1'));
    }

    public function test_provider_errors_become_safe_exceptions_without_fake_captions(): void
    {
        Http::fake(['gemini.test/*' => Http::response(['error' => ['message' => 'API key not valid']], 403)]);

        try {
            $this->provider()->transcribe($this->audio, 'si');
            $this->fail('Expected AIProviderException');
        } catch (AIProviderException $e) {
            $this->assertStringNotContainsString('API key', $e->getMessage());
            $this->assertStringContainsString('unavailable', $e->getMessage());
        }
    }

    public function test_malformed_and_truncated_responses_are_rejected(): void
    {
        Http::fakeSequence('gemini.test/*')
            ->push(['candidates' => [['content' => ['parts' => [['text' => 'not json']]], 'finishReason' => 'STOP']]])
            ->push($this->candidate(['captions' => []], 'MAX_TOKENS'));

        foreach (['unexpected response', 'too much speech'] as $expected) {
            try {
                $this->provider()->transcribe($this->audio, 'en');
                $this->fail('Expected AIProviderException');
            } catch (AIProviderException $e) {
                $this->assertStringContainsString($expected, $e->getMessage());
            }
        }
    }

    public function test_missing_api_key_fails_instead_of_inventing_text(): void
    {
        $this->expectException(AIProviderException::class);
        (new GeminiAIProvider(apiKey: ''))->transcribe($this->audio, 'si');
    }

    public function test_word_timings_are_not_requested_by_default_but_are_estimated(): void
    {
        Http::fake(['gemini.test/*' => Http::response($this->candidate(['captions' => [['text' => 'ආයුබෝවන් මිතුරනි', 'start' => 0, 'end' => 2]]]))]);

        $result = $this->provider()->transcribe($this->audio, 'si');

        $this->assertCount(2, $result['segments'][0]['words'], 'estimated from the line');
        Http::assertSent(fn (Request $r) => ! isset($r['generationConfig']['responseSchema']['properties']['captions']['items']['properties']['words']));
    }

    public function test_a_timed_out_request_is_not_sent_again(): void
    {
        $attempts = 0;
        Http::fake(function () use (&$attempts) {
            $attempts++;
            throw new ConnectionException('cURL error 28: Operation timed out after 600000 milliseconds');
        });

        try {
            $this->provider()->transcribe($this->audio, 'si');
            $this->fail('Expected AIProviderException');
        } catch (AIProviderException $e) {
            $this->assertStringContainsString('took too long', $e->getMessage());
        }
        $this->assertSame(1, $attempts, 'a timed-out transcription is never re-sent');
    }

    public function test_overloaded_model_falls_back_to_the_next_model(): void
    {
        config(['ai.gemini.fallback_models' => ['backup-model']]);
        Http::fake([
            'gemini.test/v1beta/models/test-model:*' => Http::response(['error' => ['message' => 'This model is currently experiencing high demand.']], 503),
            'gemini.test/v1beta/models/backup-model:*' => Http::response($this->candidate(['captions' => [['text' => 'ආයුබෝවන්', 'start' => 0, 'end' => 1]]])),
        ]);

        $result = $this->provider()->transcribe($this->audio, 'si');

        $this->assertSame('ආයුබෝවන්', $result['segments'][0]['text']);
        $this->assertSame('backup-model', $result['usage']['model']);
    }

    public function test_when_every_model_is_overloaded_the_user_is_told_so(): void
    {
        config(['ai.gemini.fallback_models' => ['backup-model']]);
        Http::fake(['gemini.test/*' => Http::response(['error' => ['message' => 'high demand']], 503)]);

        $this->expectExceptionMessage('overloaded right now');
        $this->provider()->transcribe($this->audio, 'si');
    }

    public function test_thinking_is_kept_low_for_gemini_3_models(): void
    {
        config(['ai.gemini.model' => 'gemini-3.8-flash']);
        Http::fake(['gemini.test/*' => Http::response($this->candidate(['captions' => [['text' => 'Hi', 'start' => 0, 'end' => 1]]]))]);

        (new GeminiAIProvider(apiKey: 'AIzaTEST_KEY_12345678901234567890'))->transcribe($this->audio, 'en');

        Http::assertSent(fn (Request $r) => ($r['generationConfig']['thinkingConfig']['thinkingLevel'] ?? null) === 'low');
    }
}
