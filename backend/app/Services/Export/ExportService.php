<?php

namespace App\Services\Export;

use App\Jobs\RenderVideoJob;
use App\Models\CaptionTemplate;
use App\Models\Export;
use App\Models\Project;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\Caption\CaptionStyleNormalizer;
use App\Services\Caption\Contracts\SubtitleFormatterInterface;
use App\Services\Rendering\VideoRendererService;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Export orchestration: Project → captions → selected style → file → export record.
 *
 * Text formats (srt, vtt, txt, json) are generated immediately — they are cheap.
 * MP4 is never rendered during the HTTP request: a queued RenderVideoJob does it.
 */
class ExportService
{
    public const LAYOUT_KEYS = ['alignMatrix', 'positionX', 'positionY', 'maxWidth', 'textAlign'];

    public function __construct(
        protected SubtitleFormatterInterface $formatter,
        protected CaptionStyleNormalizer $normalizer,
        protected UsageService $usage,
    ) {}

    /**
     * @param  array{type: string, resolution?: ?string, quality?: ?string, template?: ?string}  $data
     */
    public function create(Project $project, User $user, array $data): Export
    {
        $type = $data['type'];
        $this->usage->ensureCanExport($user, $type);

        if ($type !== 'mp4') {
            $export = Export::create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'type' => $type,
                'status' => Export::STATUS_QUEUED,
                'metadata' => ['caption_count' => $project->captions()->count()],
            ]);
            $this->generateText($export);
            $this->usage->record($user, UsageRecord::ACTION_EXPORT, 1, 'files', $project, ['type' => $type]);
            AppLog::info('export.completed', ['export' => $export->uuid, 'project' => $project->uuid, 'type' => $type]);

            return $export->refresh();
        }

        $media = $project->primaryMediaFile;
        if (! $media) {
            throw ValidationException::withMessages(['type' => 'Upload a video to this project before exporting an MP4.']);
        }

        $active = Export::where('user_id', $user->id)
            ->where('type', 'mp4')
            ->whereIn('status', [Export::STATUS_QUEUED, Export::STATUS_PROCESSING])
            ->count();
        if ($active >= $this->usage->maxConcurrentRenders($user)) {
            throw ValidationException::withMessages(['type' => 'You already have videos rendering. Please wait for them to finish.']);
        }

        [$sourceW, $sourceH] = $this->sourceDimensions($project);
        $resolution = $data['resolution'] ?? '1080';
        $shortSide = $resolution === 'source' ? null : (int) config("captions.resolutions.{$resolution}");
        if ($shortSide && $shortSide > 1080 && $shortSide > min($sourceW, $sourceH)) {
            $label = $shortSide >= 2160 ? '4K' : '2K';
            throw ValidationException::withMessages(['resolution' => "{$label} export needs a source video that is at least {$shortSide}p."]);
        }

        $quality = $data['quality'] ?? 'standard';
        $aspect = $this->editorSettings($project)['canvas']['aspect'] ?? 'source';
        [$width, $height] = VideoRendererService::outputSize($sourceW, $sourceH, $aspect, $shortSide);

        $template = null;
        if (! empty($data['template'])) {
            $template = CaptionTemplate::visibleTo($user->id)->where('uuid', $data['template'])->first();
            if (! $template) {
                throw ValidationException::withMessages(['template' => 'That caption template does not exist.']);
            }
        }

        $export = Export::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'type' => 'mp4',
            'status' => Export::STATUS_QUEUED,
            'progress' => 0,
            'metadata' => [
                'resolution' => $resolution,
                'quality' => $quality,
                'aspect' => $aspect,
                'width' => $width,
                'height' => $height,
                'source_width' => $sourceW,
                'source_height' => $sourceH,
                'duration' => (float) ($media->duration ?: $project->duration ?: 0),
                'template' => $template ? ['uuid' => $template->uuid, 'name' => $template->name] : null,
                // Snapshot so later edits don't change a render already in the queue.
                'style' => $this->styleFor($project, $template),
            ],
        ]);

        RenderVideoJob::dispatch($export)->onQueue(config('captions.render_queue', 'default'));
        AppLog::info('render.queued', ['export' => $export->uuid, 'project' => $project->uuid, 'width' => $width, 'height' => $height, 'quality' => $quality]);

        return $export;
    }

    public function generateText(Export $export): void
    {
        $project = $export->project;
        $captions = $project->captions()->orderBy('sequence')->orderBy('start_time')->get();
        $export->update(['status' => Export::STATUS_PROCESSING, 'started_at' => now()]);

        $content = match ($export->type) {
            'srt' => $this->formatter->toSrt($captions),
            'vtt' => $this->formatter->toVtt($captions),
            'txt' => $this->formatter->toTxt($captions),
            'json' => $this->formatter->toJson($captions, [
                'project' => ['name' => $project->name, 'language' => $project->language, 'duration' => $project->duration],
                'style' => $this->styleFor($project),
                'canvas' => $this->editorSettings($project)['canvas'] ?? ['aspect' => 'source'],
            ]),
            default => throw new \InvalidArgumentException("Unsupported export type: {$export->type}"),
        };

        $path = $this->storagePath($export);
        Storage::disk($this->disk())->put($path, $content);

        $export->update([
            'status' => Export::STATUS_COMPLETED,
            'progress' => 100,
            'file_path' => $path,
            'file_size' => strlen($content),
            'completed_at' => now(),
        ]);
    }

    public function delete(Export $export): void
    {
        if ($export->file_path) {
            Storage::disk($this->disk())->delete($export->file_path);
        }
        // Soft delete; a running render notices and stops (see RenderVideoJob).
        $export->delete();
        $this->usage->forget($export->user_id);
    }

    /** Captions in renderer shape. */
    public function captionsFor(Project $project): array
    {
        return $project->captions()->orderBy('sequence')->orderBy('start_time')->get()
            ->map(fn ($c) => [
                'start' => (float) $c->start_time,
                'end' => (float) $c->end_time,
                'text' => (string) $c->text,
                'language' => $c->language,
                'words' => $c->metadata['words'] ?? null,
                'style_override' => $c->style_override,
            ])->all();
    }

    /** Style used for rendering: a chosen template, else the project's editor style. */
    public function styleFor(Project $project, ?CaptionTemplate $template = null): array
    {
        $projectStyle = $this->editorSettings($project)['style'] ?? [];
        if ($template) {
            $templateStyle = $template->style ?? [];
            if ($template->is_system) {
                // Presets are a "look" only — like the editor's preset buttons, they keep the project's layout.
                $templateStyle = array_diff_key($templateStyle, array_flip(self::LAYOUT_KEYS));
            }

            return $this->normalizer->normalize(array_merge($this->normalizer->normalize($projectStyle), $templateStyle));
        }

        return $this->normalizer->normalize($projectStyle);
    }

    public function editorSettings(Project $project): array
    {
        $editor = $project->settings['editor'] ?? [];

        return is_array($editor) ? $editor : [];
    }

    /** @return array{0: int, 1: int} */
    public function sourceDimensions(Project $project): array
    {
        $media = $project->primaryMediaFile;
        $w = (int) ($media?->width ?: $project->width ?: 1920);
        $h = (int) ($media?->height ?: $project->height ?: 1080);

        return [$w, $h];
    }

    public function storagePath(Export $export): string
    {
        return "exports/{$export->project->uuid}/{$export->uuid}.{$export->type}";
    }

    public function disk(): string
    {
        return (string) config('captions.export_disk', 'local');
    }
}
