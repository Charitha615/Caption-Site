<?php

namespace Tests\Feature;

use App\Exceptions\AIProviderException;
use App\Models\UsageRecord;
use App\Services\AI\GeminiSpeechSynthesizer;
use App\Services\AI\GeminiTextAssistant;
use App\Services\Usage\UsageService;
use App\Support\Wav;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VideoEditorAiTest extends TestCase
{
    use RefreshDatabase;

    private function wavPart(float $seconds, int $rate = 8000): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'part');
        file_put_contents($path, Wav::fromPcm16(str_repeat("\0\0", (int) ($seconds * $rate)), $rate));

        return new UploadedFile($path, 'part.wav', 'audio/wav', null, true);
    }

    public function test_a_part_is_transcribed_with_times_after_the_lead_in_and_counted_as_caption_minutes(): void
    {
        [$user, $headers] = $this->userWithToken();

        $response = $this->withHeaders($headers)->post('/api/video-editor/ai/transcribe', [
            'audio' => $this->wavPart(12),
            'language' => 'si',
            'part' => 1,
            'lead_in' => 1,
        ], ['Accept' => 'application/json']);

        $response->assertOk()
            ->assertJsonPath('data.language', 'si')
            ->assertJsonPath('data.lines.0.start', 0)
            ->assertJsonPath('data.lines.0.end', 2.2)
            ->assertJsonCount(3, 'data.lines');
        $this->assertStringContainsString('ආයුබෝවන්', $response->json('data.lines.0.text'));
        $this->assertEqualsWithDelta(11.0, (float) UsageRecord::where('user_id', $user->id)->where('action', UsageRecord::ACTION_CAPTION_GENERATION)->sum('quantity'), 0.01);
        $this->assertSame(1, UsageRecord::where('user_id', $user->id)->where('action', UsageRecord::ACTION_AI_REQUEST)->count());
    }

    public function test_parts_that_are_not_short_wav_files_or_exceed_the_plan_are_refused(): void
    {
        [$user, $headers] = $this->userWithToken();
        $post = fn (array $data) => $this->withHeaders($headers)->post('/api/video-editor/ai/transcribe', $data + ['language' => 'si', 'part' => 1], ['Accept' => 'application/json']);

        $post(['audio' => UploadedFile::fake()->create('a.mp3', 10, 'audio/mpeg')])->assertStatus(422)->assertJsonValidationErrors('audio');
        $post(['audio' => $this->wavPart(181)])->assertStatus(422);

        config(['plans.plans.free.caption_minutes_per_month' => 1]);
        app(UsageService::class)->record($user, UsageRecord::ACTION_CAPTION_GENERATION, 60, 'seconds');
        $post(['audio' => $this->wavPart(5)])->assertStatus(402);
    }

    public function test_the_tools_need_a_signed_in_user(): void
    {
        $this->postJson('/api/video-editor/ai/transcribe')->assertUnauthorized();
        $this->postJson('/api/video-editor/ai/text', ['task' => 'titles'])->assertUnauthorized();
    }

    public function test_text_tools_keep_lines_one_to_one_and_return_highlights(): void
    {
        [, $headers] = $this->userWithToken();
        $text = fn (array $data) => $this->withHeaders($headers)->postJson('/api/video-editor/ai/text', $data);

        $text(['task' => 'singlish', 'lines' => ['kohomada', '', 'oyata']])
            ->assertOk()->assertJsonPath('data.lines', ['[සිංහල] kohomada', '', '[සිංහල] oyata']);
        $text(['task' => 'translate', 'lines' => ['Hello'], 'to' => 'ta'])
            ->assertOk()->assertJsonPath('data.lines', ['[ta] Hello']);
        $text(['task' => 'translate', 'lines' => ['Hello'], 'to' => 'fr'])->assertStatus(422);
        $text(['task' => 'script', 'topic' => 'Kandy food', 'language' => 'si', 'seconds' => 60])->assertOk()->assertJsonCount(3, 'data.lines');
        $text(['task' => 'titles', 'context' => 'A trip to Ella', 'language' => 'en'])->assertOk()->assertJsonCount(3, 'data.lines');
        $text(['task' => 'highlights', 'transcript' => [['start' => 1, 'end' => 6, 'text' => 'The best part']], 'count' => 3])
            ->assertOk()->assertJsonPath('data.moments.0.start', 1);
    }

    public function test_speech_comes_back_as_a_wav_file(): void
    {
        [, $headers] = $this->userWithToken();

        $response = $this->withHeaders($headers)->post('/api/video-editor/ai/speech', ['text' => 'ආයුබෝවන්', 'voice' => 'Kore'], ['Accept' => 'application/json']);

        $response->assertOk()->assertHeader('Content-Type', 'audio/wav');
        $this->assertStringStartsWith('RIFF', $response->getContent());
    }

    public function test_gemini_text_assistant_reads_json_answers_and_rejects_mismatched_line_counts(): void
    {
        Http::fake([
            '*' => Http::sequence()
                ->push(['candidates' => [['content' => ['parts' => [['text' => json_encode(['lines' => ['ආයුබෝවන්']])]]]]]])
                ->push(['candidates' => [['content' => ['parts' => [['text' => json_encode(['lines' => ['a', 'b']])]]]]]]),
        ]);
        $assistant = new GeminiTextAssistant('test-key', 'gemini-test');

        $this->assertSame(['ආයුබෝවන්'], $assistant->singlishToSinhala(['ayubowan']));
        $this->assertSame('gemini-test', $assistant->model());

        $this->expectException(AIProviderException::class);
        $assistant->translate(['one'], 'en');
    }

    public function test_gemini_speech_wraps_the_returned_pcm_in_a_wav_header(): void
    {
        Http::fake(['*' => Http::response(['candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'audio/L16', 'data' => base64_encode(str_repeat("\1\0", 24000))]]]]]]])]);

        $wav = (new GeminiSpeechSynthesizer('test-key', 'tts-test'))->speak('Hello', 'Puck');

        $this->assertSame('RIFF', substr($wav, 0, 4));
        $path = tempnam(sys_get_temp_dir(), 'wav');
        file_put_contents($path, $wav);
        $this->assertEqualsWithDelta(1.0, Wav::duration($path), 0.001);
        Http::assertSent(fn ($request) => $request['generationConfig']['speechConfig']['voiceConfig']['prebuiltVoiceConfig']['voiceName'] === 'Puck');
    }
}
