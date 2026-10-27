<?php

namespace App\Services\Caption;

use App\Services\Caption\Contracts\SubtitleFormatterInterface;
use Illuminate\Support\Collection;

class SubtitleFormatterService implements SubtitleFormatterInterface
{
    public function toSrt(Collection|array $captions): string
    {
        $captions = collect($captions);
        $output = [];
        $index = 1;

        foreach ($captions as $caption) {
            $start = $this->formatSrtTimestamp((float) ($caption['start_time'] ?? $caption->start_time));
            $end = $this->formatSrtTimestamp((float) ($caption['end_time'] ?? $caption->end_time));
            $text = trim((string) ($caption['text'] ?? $caption->text));

            $output[] = "{$index}\n{$start} --> {$end}\n{$text}\n";
            $index++;
        }

        return implode("\n", $output);
    }

    public function toVtt(Collection|array $captions): string
    {
        $captions = collect($captions);
        $output = ["WEBVTT\n"];

        foreach ($captions as $caption) {
            $start = $this->formatVttTimestamp((float) ($caption['start_time'] ?? $caption->start_time));
            $end = $this->formatVttTimestamp((float) ($caption['end_time'] ?? $caption->end_time));
            $text = trim((string) ($caption['text'] ?? $caption->text));

            $output[] = "{$start} --> {$end}\n{$text}\n";
        }

        return implode("\n", $output);
    }

    public function toTxt(Collection|array $captions): string
    {
        $captions = collect($captions);
        $lines = [];

        foreach ($captions as $caption) {
            $text = trim((string) ($caption['text'] ?? $caption->text));
            if (!empty($text)) {
                $lines[] = $text;
            }
        }

        return implode("\n\n", $lines);
    }

    public function toJson(Collection|array $captions): string
    {
        $captions = collect($captions)->map(function ($caption, $idx) {
            return [
                'sequence' => (int) ($caption['sequence'] ?? $caption->sequence ?? ($idx + 1)),
                'start_time' => (float) ($caption['start_time'] ?? $caption->start_time),
                'end_time' => (float) ($caption['end_time'] ?? $caption->end_time),
                'text' => (string) ($caption['text'] ?? $caption->text),
            ];
        })->values()->all();

        return json_encode($captions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    protected function formatSrtTimestamp(float $seconds): string
    {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = floor($seconds % 60);
        $milliseconds = round(($seconds - floor($seconds)) * 1000);

        return sprintf('%02d:%02d:%02d,%03d', $hours, $minutes, $secs, $milliseconds);
    }

    protected function formatVttTimestamp(float $seconds): string
    {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = floor($seconds % 60);
        $milliseconds = round(($seconds - floor($seconds)) * 1000);

        return sprintf('%02d:%02d:%02d.%03d', $hours, $minutes, $secs, $milliseconds);
    }
}
