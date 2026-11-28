<?php

namespace App\Services\Rendering;

use App\Models\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * "Captions behind the person" (Pro): the person's outline through a project's video, worked out in
 * the browser (MediaPipe) and uploaded once. The renderer turns it into greyscale mask frames that
 * FFmpeg uses to draw the person back over the captions.
 *
 * File format ("SSM1", little endian): width, height (uint16), frames per second × 100 and frame
 * count (uint32), then per frame a uint32 byte length and uint16 run lengths of alternating
 * background / person pixels, starting with background.
 */
class SubjectMaskStore
{
    public const MAX_BYTES = 40 * 1024 * 1024;

    public const MAX_FRAMES = 5000;

    public const MAX_SIDE = 1024;

    private const DISK = 'local';

    public function path(Project $project): string
    {
        return "subject-masks/{$project->uuid}.ssm";
    }

    private function metaPath(Project $project): string
    {
        return "subject-masks/{$project->uuid}.json";
    }

    /** Whether there is an outline for the project's current video. */
    public function isReady(Project $project): bool
    {
        $disk = Storage::disk(self::DISK);
        if (! $disk->exists($this->path($project)) || ! $disk->exists($this->metaPath($project))) {
            return false;
        }
        $meta = json_decode((string) $disk->get($this->metaPath($project)), true);

        return is_array($meta) && ($meta['media_id'] ?? null) === $project->primaryMediaFile?->id;
    }

    /**
     * Checks and stores an upload for the project's current video.
     *
     * @return array{width: int, height: int, fps: float, frames: int}
     */
    public function save(Project $project, string $bytes): array
    {
        $info = self::validate($bytes);
        $disk = Storage::disk(self::DISK);
        $disk->put($this->path($project), $bytes);
        $disk->put($this->metaPath($project), (string) json_encode($info + ['media_id' => $project->primaryMediaFile?->id]));

        return $info;
    }

    public function delete(Project $project): void
    {
        Storage::disk(self::DISK)->delete([$this->path($project), $this->metaPath($project)]);
    }

    public function absolutePath(Project $project): string
    {
        return Storage::disk(self::DISK)->path($this->path($project));
    }

    /**
     * Reads the header and checks every frame decodes to exactly width × height pixels.
     *
     * @return array{width: int, height: int, fps: float, frames: int}
     */
    public static function validate(string $bytes): array
    {
        $fail = fn (string $message) => throw ValidationException::withMessages(['mask' => $message]);
        if (strlen($bytes) > self::MAX_BYTES) {
            $fail('The person outline is too large.');
        }
        if (strlen($bytes) < 16 || substr($bytes, 0, 4) !== 'SSM1') {
            $fail('The person outline is not in the expected format.');
        }
        ['w' => $width, 'h' => $height, 'fps' => $fps100, 'n' => $frames] = unpack('vw/vh/Vfps/Vn', substr($bytes, 4, 12));
        if ($width < 8 || $height < 8 || $width > self::MAX_SIDE || $height > self::MAX_SIDE || $frames < 1 || $frames > self::MAX_FRAMES || $fps100 < 50 || $fps100 > 6000) {
            $fail('The person outline has an invalid size.');
        }

        $offset = 16;
        $pixels = $width * $height;
        for ($i = 0; $i < $frames; $i++) {
            $runs = self::frameRuns($bytes, $offset);
            if ($runs === null || array_sum($runs) !== $pixels) {
                $fail('The person outline is damaged.');
            }
        }
        if ($offset !== strlen($bytes)) {
            $fail('The person outline is damaged.');
        }

        return ['width' => $width, 'height' => $height, 'fps' => round($fps100 / 100, 2), 'frames' => $frames];
    }

    /**
     * Writes every frame as a greyscale PGM (mask_00000.pgm …): black background, white person.
     *
     * @return array{pattern: string, fps: float, frames: int}
     */
    public static function writeFrames(string $maskFile, string $dir): array
    {
        $bytes = (string) file_get_contents($maskFile);
        $info = self::validate($bytes);
        File::ensureDirectoryExists($dir, 0700);
        $header = "P5\n{$info['width']} {$info['height']}\n255\n";
        $offset = 16;
        for ($i = 0; $i < $info['frames']; $i++) {
            $runs = (array) self::frameRuns($bytes, $offset);
            $pixels = '';
            $person = false;
            foreach ($runs as $run) {
                if ($run > 0) {
                    $pixels .= str_repeat($person ? "\xFF" : "\x00", $run);
                }
                $person = ! $person;
            }
            file_put_contents(sprintf('%s/mask_%05d.pgm', $dir, $i), $header.$pixels);
        }

        return ['pattern' => $dir.'/mask_%05d.pgm', 'fps' => $info['fps'], 'frames' => $info['frames']];
    }

    /** @return list<int>|null run lengths of the frame at `$offset` (moved past it), or null if cut short */
    private static function frameRuns(string $bytes, int &$offset): ?array
    {
        if ($offset + 4 > strlen($bytes)) {
            return null;
        }
        $length = unpack('V', substr($bytes, $offset, 4))[1];
        $offset += 4;
        if ($length % 2 !== 0 || $offset + $length > strlen($bytes)) {
            return null;
        }
        $runs = $length > 0 ? array_values(unpack('v*', substr($bytes, $offset, $length))) : [];
        $offset += $length;

        return $runs;
    }
}
