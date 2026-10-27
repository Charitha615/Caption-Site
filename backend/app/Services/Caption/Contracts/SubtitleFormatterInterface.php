<?php

namespace App\Services\Caption\Contracts;

use Illuminate\Support\Collection;

interface SubtitleFormatterInterface
{
    /**
     * Format captions into SRT standard format.
     */
    public function toSrt(Collection|array $captions): string;

    /**
     * Format captions into WebVTT standard format.
     */
    public function toVtt(Collection|array $captions): string;

    /**
     * Format captions into plain transcript TXT format.
     */
    public function toTxt(Collection|array $captions): string;

    /**
     * Format captions into JSON format.
     */
    public function toJson(Collection|array $captions): string;
}
