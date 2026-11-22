<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Transcript;
use App\Services\Caption\ScriptAligner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Importing a written script and lining it up with the AI transcript's speech timings. */
class ScriptAlignmentTest extends TestCase
{
    use RefreshDatabase;

    /** What the AI heard: one word per second, with a misspelling and an imagined word. */
    private function speech(): array
    {
        $heard = ['මේ', 'තමයි', 'ටොයෝටා', 'ඇක්වා', 'අම්මෝ', 'ට්‍රැෆික්', 'එකේ', 'යන්න', 'හොඳයි'];

        return array_map(fn ($w, $i) => ['word' => $w, 'start' => (float) $i, 'end' => $i + 0.8], $heard, array_keys($heard));
    }

    public function test_sound_keys_match_across_sinhala_and_english_spelling(): void
    {
        $this->assertGreaterThanOrEqual(0.8, ScriptAligner::similarity(ScriptAligner::key('ටොයොටා'), ScriptAligner::key('Toyota')));
        $this->assertGreaterThanOrEqual(0.8, ScriptAligner::similarity(ScriptAligner::key('ට්‍රැෆික්'), ScriptAligner::key('traffic')));
        $this->assertLessThan(0.55, ScriptAligner::similarity(ScriptAligner::key('ගෙදර'), ScriptAligner::key('traffic')));
    }

    public function test_script_words_take_speech_timings_and_missing_words_are_placed_between(): void
    {
        // Script: correct spelling, English words in English, one word the AI missed ("නගරබද"),
        // and the AI's imagined "අම්මෝ" is not in the script.
        $result = (new ScriptAligner)->align('මේ තමයි Toyota Aqua. නගරබද traffic එකේ යන්න හොඳයි', $this->speech(), 10.0, 'si');

        $words = collect($result['segments'])->flatMap(fn ($s) => $s['words'])->keyBy('word');
        $this->assertSame(2.0, $words['Toyota']['start'], 'Toyota ← ටොයෝටා');
        $this->assertSame(3.0, $words['Aqua.']['start']);
        $this->assertSame(5.0, $words['traffic']['start'], 'traffic ← ට්‍රැෆික්');
        $this->assertSame(8.0, $words['හොඳයි']['start']);
        // Missed word sits between "Aqua." (ends 3.8) and "traffic" (starts 5.0).
        $this->assertGreaterThanOrEqual(3.8, $words['නගරබද']['start']);
        $this->assertLessThanOrEqual(5.0, $words['නගරබද']['end']);
        $this->assertStringNotContainsString('අම්මෝ', implode(' ', array_column($result['segments'], 'text')), 'AI-only words are dropped');
        $this->assertSame(['script_words' => 9, 'matched' => 8, 'placed' => 1], $result['stats']);
        $this->assertSame('මේ තමයි Toyota Aqua.', $result['segments'][0]['text'], 'line breaks after a sentence');
    }

    public function test_timings_always_move_forward(): void
    {
        $result = (new ScriptAligner)->align('හොඳයි මේ තමයි', $this->speech(), 10.0, 'si');
        $starts = collect($result['segments'])->flatMap(fn ($s) => $s['words'])->pluck('start')->all();

        $sorted = $starts;
        sort($sorted);
        $this->assertSame($sorted, $starts);
    }

    public function test_endpoint_aligns_script_for_the_owner_only(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id, 'duration' => 10]);
        Transcript::create(['project_id' => $project->id, 'language' => 'si', 'raw_text' => '', 'status' => 'completed', 'words_json' => [['text' => 'x', 'start' => 0, 'end' => 9, 'words' => $this->speech()]]]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/captions/align", ['text' => 'මේ තමයි Toyota Aqua.'])
            ->assertOk()
            ->assertJsonPath('data.captions.0.text', 'මේ තමයි Toyota Aqua.')
            ->assertJsonPath('data.captions.0.start_time', 0)
            ->assertJsonPath('data.stats.matched', 4)
            ->assertJsonPath('data.english_applied', false);

        $this->app['auth']->forgetGuards();
        [, $intruder] = $this->userWithToken();
        $this->withHeaders($intruder)->postJson("/api/projects/{$project->uuid}/captions/align", ['text' => 'x'])->assertForbidden();
    }

    public function test_endpoint_explains_when_there_are_no_speech_timings_yet(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/captions/align", ['text' => 'මේ තමයි'])
            ->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'no_transcript');
    }
}
