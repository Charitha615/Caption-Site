<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\AI\AIProviderFactory;
use App\Services\AI\SpeechPartTranscriber;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use App\Support\Wav;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * AI tools for the in-browser video editor. The editor keeps media on the user's computer, so it
 * sends only what each tool needs: short WAV parts of the timeline's sound, or text.
 */
class VideoEditorAiController extends Controller
{
    use ApiResponseTrait;

    /** Longest audio part accepted in one request; the editor sends ~30 s parts. */
    public const MAX_PART_SECONDS = 180;

    /** Lines sent to the text model in one request. */
    private const TEXT_BATCH = 150;

    public function __construct(
        private AIProviderFactory $providers,
        private UsageService $usage,
    ) {}

    /**
     * Captions for one part of the timeline's sound, with the same Sinhala clean-up as uploaded videos.
     * Times in the answer are relative to the start of the part (after the lead-in silence).
     */
    public function transcribe(Request $request, SpeechPartTranscriber $transcriber): JsonResponse
    {
        $validated = $request->validate([
            'audio' => ['required', 'file', 'mimes:wav', 'max:12288'],
            'language' => ['required', 'string', Rule::in(['si', 'en', 'mixed', 'auto'])],
            'part' => ['required', 'integer', 'min:1', 'max:10000'],
            'lead_in' => ['nullable', 'numeric', 'min:0', 'max:3'],
        ]);
        $user = $request->user();
        $leadIn = (float) ($validated['lead_in'] ?? 0);

        $path = sys_get_temp_dir().'/editor-part-'.Str::uuid().'.wav';
        $request->file('audio')->move(dirname($path), basename($path));
        try {
            $duration = Wav::duration($path);
            if ($duration <= 0 || $duration > self::MAX_PART_SECONDS) {
                return $this->errorResponse('This audio part could not be read.', 422, ['audio' => ['Send a WAV part of up to '.self::MAX_PART_SECONDS.' seconds.']]);
            }
            $speech = max(0.0, $duration - $leadIn);

            $this->providers->ensureCanCaption($user);
            $this->usage->ensureCaptionMinutesRemain($user, $speech);

            $stats = [];
            $done = $transcriber->transcribe(
                $this->providers->forUser($user),
                $this->providers->refinerForUser($user),
                $this->providers->mixedTranscriberForUser($user),
                $user,
                null,
                ['path' => $path, 'duration' => $duration],
                $validated['language'],
                (int) $validated['part'],
                stats: $stats,
            );
            $this->usage->record($user, UsageRecord::ACTION_CAPTION_GENERATION, $speech, 'seconds', null, ['source' => 'video-editor', 'part' => (int) $validated['part']]);
            AppLog::info('editor.transcribed', ['user' => $user->id, 'part' => (int) $validated['part'], 'seconds' => round($speech, 1), 'lines' => count($done['lines'])] + $stats);
        } finally {
            @unlink($path);
        }

        $shift = fn (float $t) => round(max(0.0, $t - $leadIn), 3);
        $lines = [];
        foreach ($done['lines'] as $line) {
            if ($line['end'] - $leadIn <= 0 || trim($line['text']) === '') {
                continue;
            }
            $lines[] = [
                'start' => $shift($line['start']),
                'end' => $shift($line['end']),
                'text' => $line['text'],
                'language' => $line['language'],
                'words' => array_map(fn ($w) => ['word' => $w['word'], 'start' => $shift($w['start']), 'end' => $shift($w['end'])], $line['words']),
            ];
        }

        return $this->successResponse(['lines' => $lines, 'language' => $done['result']['language']], 'Part transcribed');
    }

    /** Writing tools: Singlish → Sinhala, translation, scripts, titles and highlights. */
    public function text(Request $request): JsonResponse
    {
        $task = $request->validate(['task' => ['required', Rule::in(['singlish', 'translate', 'script', 'titles', 'highlights'])]])['task'];
        $user = $request->user();
        if ($task !== 'singlish') {
            // Singlish → Sinhala is a typing aid for subtitles (free); the other writing tools are Pro.
            $this->usage->ensureCanUseEditorAi($user);
        }

        $validated = $request->validate(match ($task) {
            'singlish', 'translate' => [
                'lines' => ['required', 'array', 'min:1', 'max:2000'],
                'lines.*' => ['present', 'nullable', 'string', 'max:1000'],
                'to' => [$task === 'translate' ? 'required' : 'nullable', Rule::in(['si', 'en', 'ta'])],
            ],
            'script' => [
                'topic' => ['required', 'string', 'max:2000'],
                'language' => ['required', Rule::in(['si', 'en', 'ta'])],
                'seconds' => ['required', 'integer', 'min:10', 'max:900'],
                'tone' => ['nullable', 'string', 'max:100'],
            ],
            'titles' => [
                'context' => ['required', 'string', 'max:20000'],
                'language' => ['required', Rule::in(['si', 'en', 'ta'])],
            ],
            'highlights' => [
                'transcript' => ['required', 'array', 'min:1', 'max:3000'],
                'transcript.*.start' => ['required', 'numeric', 'min:0'],
                'transcript.*.end' => ['required', 'numeric', 'min:0'],
                'transcript.*.text' => ['required', 'string', 'max:1000'],
                'count' => ['nullable', 'integer', 'min:1', 'max:10'],
            ],
        });

        $assistant = $this->providers->textAssistantForUser($user);
        $ask = function (callable $call) use ($user, $assistant, $task) {
            $this->usage->ensureCanRequestAI($user);
            $answer = $call();
            $this->usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', null, ['provider' => 'editor-'.$task, 'model' => $assistant->model()]);

            return $answer;
        };

        $result = match ($task) {
            'singlish', 'translate' => $this->batched(
                array_map(fn ($l) => (string) $l, $validated['lines']),
                fn (array $batch) => $ask(fn () => $task === 'singlish' ? $assistant->singlishToSinhala($batch) : $assistant->translate($batch, $validated['to'])),
            ),
            'script' => $ask(fn () => $assistant->script($validated['topic'], $validated['language'], (int) $validated['seconds'], (string) ($validated['tone'] ?? ''))),
            'titles' => $ask(fn () => $assistant->titles($validated['context'], $validated['language'])),
            'highlights' => $ask(fn () => $assistant->highlights(
                array_map(fn ($l) => ['start' => (float) $l['start'], 'end' => (float) $l['end'], 'text' => (string) $l['text']], $validated['transcript']),
                (int) ($validated['count'] ?? 5),
            )),
        };

        return $this->successResponse($task === 'highlights' ? ['moments' => $result] : ['lines' => $result], 'Done');
    }

    /** AI voice-over: speech for a text, as a WAV file. */
    public function speech(Request $request): Response|JsonResponse
    {
        $validated = $request->validate([
            'text' => ['required', 'string', 'max:3000'],
            // A prebuilt voice name from the voice list (the live catalogue can hold more than the built-in 30).
            'voice' => ['required', 'string', 'regex:/^[A-Za-z0-9_\-]{1,80}$/'],
            'style' => ['nullable', 'string', 'max:120'],
        ]);
        /** @var User $user */
        $user = $request->user();
        $this->usage->ensureCanUseEditorAi($user);
        $synth = $this->providers->speechForUser($user);
        $this->usage->ensureCanRequestAI($user);
        $wav = $synth->speak($validated['text'], $validated['voice'], (string) ($validated['style'] ?? ''));
        $this->usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', null, ['provider' => 'editor-speech', 'model' => $synth->model(), 'characters' => mb_strlen($validated['text'])]);

        return response($wav, 200, ['Content-Type' => 'audio/wav', 'Cache-Control' => 'no-store']);
    }

    /** The voices for AI voice-overs (AI Studio's catalogue, or the built-in list). */
    public function voices(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return $this->successResponse(['voices' => $this->providers->speechForUser($user)->voices()], 'Voices');
    }

    /**
     * Runs `$call` over the lines in batches, skipping empty lines (they stay empty).
     *
     * @param  list<string>  $lines
     * @param  callable(list<string>): list<string>  $call
     * @return list<string>
     */
    private function batched(array $lines, callable $call): array
    {
        $out = $lines;
        $filled = array_filter($lines, fn ($l) => trim($l) !== '');
        foreach (array_chunk($filled, self::TEXT_BATCH, true) as $batch) {
            $answer = $call(array_values($batch));
            foreach (array_keys($batch) as $n => $index) {
                $out[$index] = $answer[$n];
            }
        }

        return array_values($out);
    }
}
