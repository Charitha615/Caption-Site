<?php

namespace App\Services\AI;

interface AIProviderInterface
{
    /**
     * Transcribe audio file to text and normalized segments.
     *
     * @param string $audioFilePath Absolute path to audio file
     * @param string $language ISO language code ('si', 'en', 'auto')
     * @return array{text: string, language: string, segments: array<array{text: string, language: string, start: float, end: float, words?: array<array{word: string, start: float, end: float}>}>}
     */
    public function transcribeAudio(string $audioFilePath, string $language = 'auto'): array;

    /**
     * Generate structured, timed captions from audio.
     *
     * @param string $audioFilePath Absolute path to audio file
     * @param string $language 'si', 'en', or 'auto'
     * @param array $options Configuration options (max_words, max_chars, etc.)
     * @return array<array{text: string, language: string, start: float, end: float, words?: array<array{word: string, start: float, end: float}>}>
     */
    public function generateCaptions(string $audioFilePath, string $language = 'auto', array $options = []): array;

    /**
     * Translate caption segments from one language to another.
     *
     * @param array<array{text: string, start: float, end: float}> $captions
     * @param string $targetLanguage 'si', 'en', etc.
     * @return array<array{text: string, language: string, start: float, end: float}>
     */
    public function translateCaptions(array $captions, string $targetLanguage): array;

    /**
     * Detect spoken language from audio file.
     *
     * @param string $audioFilePath Absolute path to audio file
     * @return string e.g. 'si' or 'en'
     */
    public function detectLanguage(string $audioFilePath): string;

    /**
     * Improve caption text readability, spelling, and punctuation (especially for Sinhala Unicode).
     *
     * @param string $text
     * @param string $language
     * @return string
     */
    public function improveCaptionText(string $text, string $language = 'si'): string;
}
