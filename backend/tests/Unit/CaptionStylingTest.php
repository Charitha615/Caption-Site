<?php

namespace Tests\Unit;

use App\Services\Caption\CaptionStyleNormalizer;
use App\Services\Rendering\AssCaptionRenderer;
use App\Services\Rendering\FontRegistry;
use Tests\TestCase;

/**
 * Caption styling: style validation/normalisation and the ASS caption renderer.
 */
class CaptionStylingTest extends TestCase
{
    private CaptionStyleNormalizer $normalizer;

    private AssCaptionRenderer $renderer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->normalizer = new CaptionStyleNormalizer;
        // Empty fonts dir → deterministic default size factor.
        $this->renderer = new AssCaptionRenderer($this->normalizer, new FontRegistry(sys_get_temp_dir().'/no-fonts-here'));
    }

    public function test_normalizer_fills_defaults_and_drops_unknown_keys(): void
    {
        $style = $this->normalizer->normalize(['fontSize' => 72, 'evil' => '<script>']);

        $this->assertSame(72, $style['fontSize']);
        $this->assertArrayNotHasKey('evil', $style);
        $this->assertSame(array_keys(CaptionStyleNormalizer::DEFAULTS), array_keys($style));
    }

    public function test_normalizer_clamps_ranges_and_validates_enums_colors_fonts(): void
    {
        $style = $this->normalizer->normalizePartial([
            'fontSize' => 10_000,
            'fontWeight' => 655,
            'positionY' => -40,
            'textAlign' => 'justify',
            'fontStyle' => 'italic',
            'textColor' => 'rgb(255, 128, 0)',
            'outlineColor' => '#abc',
            'shadowColor' => 'red; drop table',
            'englishFontFamily' => '"Comic Sans", cursive',
            'fontFamily' => '"Abhaya Libre", serif',
        ]);

        $this->assertSame(300, $style['fontSize']);
        $this->assertSame(700, $style['fontWeight']);
        $this->assertSame(0, $style['positionY']);
        $this->assertArrayNotHasKey('textAlign', $style);
        $this->assertSame('italic', $style['fontStyle']);
        $this->assertSame('#FF8000', $style['textColor']);
        $this->assertSame('#AABBCC', $style['outlineColor']);
        $this->assertArrayNotHasKey('shadowColor', $style);
        $this->assertArrayNotHasKey('englishFontFamily', $style, 'only configured fonts are allowed');
        $this->assertSame('"Abhaya Libre", serif', $style['fontFamily']);
        $this->assertNotEmpty($this->normalizer->errors(['textAlign' => 'justify']));
        $this->assertSame([], $this->normalizer->errors(['textAlign' => 'left', 'unknown' => 1]));
    }

    public function test_override_wins_over_global_style(): void
    {
        $resolved = $this->normalizer->resolve(['textColor' => '#FFFFFF', 'fontSize' => 40], ['textColor' => '#FF0000']);

        $this->assertSame('#FF0000', $resolved['textColor']);
        $this->assertSame(40, $resolved['fontSize']);
    }

    public function test_system_presets_are_valid_and_match_the_editor_copy(): void
    {
        $backend = json_decode(file_get_contents(resource_path('captions/presets.json')), true);
        $keys = array_column($backend['presets'], 'key');
        $this->assertSame(['spotlight', 'modern', 'bold', 'minimal', 'cinema', 'youtube', 'tiktok', 'classic'], $keys);
        foreach ($backend['presets'] as $preset) {
            $this->assertSame([], $this->normalizer->errors($preset['style']), "preset {$preset['key']}");
        }

        $frontendPath = base_path('../frontend/src/features/editor/model/presets.json');
        if (! is_file($frontendPath)) {
            $this->markTestSkipped('Frontend not present in this checkout.');
        }
        $this->assertSame($backend, json_decode(file_get_contents($frontendPath), true), 'presets.json copies have drifted');
    }

    public function test_renderer_converts_colors_alpha_and_time(): void
    {
        $this->assertSame('&H0080FF&', $this->renderer->color('#FF8000'));
        $this->assertSame('&H00&', $this->renderer->alpha(100));
        $this->assertSame('&HFF&', $this->renderer->alpha(0));
        $this->assertSame('&H80&', $this->renderer->alpha(50));
        $this->assertSame('1:01:01.25', $this->renderer->time(3661.25));
    }

    public function test_renderer_positions_scales_and_layers_a_caption(): void
    {
        $ass = $this->renderer->render(
            [['start' => 1, 'end' => 3, 'text' => 'Hello']],
            ['fontSize' => 54, 'padding' => 10, 'alignMatrix' => 'bottom-center', 'positionX' => 50, 'positionY' => 90,
                'maxWidth' => 80, 'animation' => 'fade', 'outlineWidth' => 3, 'backgroundOpacity' => 50, 'shadowOpacity' => 0],
            1920, 1080,
        );

        $this->assertStringContainsString("PlayResX: 1920\nPlayResY: 1080", $ass);
        $events = array_values(array_filter(explode("\n", $ass), fn ($l) => str_starts_with($l, 'Dialogue:')));
        $this->assertCount(2, $events, 'box + text, no shadow layer when shadow is off');

        [$box, $text] = $events;
        $this->assertStringStartsWith('Dialogue: 0,0:00:01.00,0:00:03.00,Box,', $box);
        $this->assertStringContainsString('\4a&H80&', $box);
        // bottom-center anchor at 90% height, lifted by vertical padding (10 × 0.6 at 1080p).
        $this->assertStringContainsString('{\an2\pos(960,966)\fad(280,0)', $text);
        $this->assertStringContainsString('\bord3', $text);
        // Font size = 54px × size factor (no font files → default factor).
        $this->assertStringContainsString('\fs'.rtrim(rtrim(number_format(54 * FontRegistry::DEFAULT_SIZE_FACTOR, 2, '.', ''), '0'), '.'), $text);
        // Wrap width 80% of frame minus padding → margins on both sides.
        $this->assertStringContainsString(',0202,0202,0000,', $text);
    }

    public function test_mixed_sinhala_english_switches_fonts_per_script_run(): void
    {
        $runs = $this->renderer->scriptRuns('ශ්‍රී ලංකාව AI, 2026 සිංහල');

        // Mirrors CSS fallback: spaces/digits/punctuation come from the (first) Latin font.
        $this->assertSame([
            ['script' => 'sinhala', 'text' => "ශ්\u{200D}රී"],
            ['script' => 'latin', 'text' => ' '],
            ['script' => 'sinhala', 'text' => 'ලංකාව'],
            ['script' => 'latin', 'text' => ' AI, 2026 '],
            ['script' => 'sinhala', 'text' => 'සිංහල'],
        ], $runs);

        $ass = $this->renderer->render([['start' => 0, 'end' => 1, 'text' => 'ලංකාව AI']], ['englishFontFamily' => '"Inter", sans-serif', 'fontWeight' => 600, 'animation' => 'none', 'backgroundOpacity' => 0, 'shadowOpacity' => 0], 1280, 720);
        $this->assertMatchesRegularExpression('/\{\\\\fnNoto Sans Sinhala\\\\fs[\d.]+\\\\b600\\\\i0\}ලංකාව\{\\\\fnInter\\\\fs[\d.]+\\\\b600\\\\i0\} AI$/m', $ass);
    }

    public function test_text_is_escaped_so_user_input_cannot_inject_override_tags(): void
    {
        $this->assertSame('\{\\b1\}x', str_replace("\u{2060}", '', $this->renderer->escape('{\b1}x')));
        $this->assertSame('a\Nb', $this->renderer->escape("a\nb"));

        $ass = $this->renderer->render([['start' => 0, 'end' => 1, 'text' => '{\pos(0,0)\fs500}hack']], ['backgroundOpacity' => 0, 'shadowOpacity' => 0], 1280, 720);
        $this->assertStringNotContainsString('{\pos(0,0)', $ass);
    }

    public function test_karaoke_creates_one_event_per_word_with_highlight(): void
    {
        $ass = $this->renderer->render(
            [['start' => 0, 'end' => 3, 'text' => 'එක දෙක තුන', 'words' => [
                ['text' => 'එක', 'start' => 0, 'end' => 1], ['text' => 'දෙක', 'start' => 1, 'end' => 2], ['text' => 'තුන', 'start' => 2, 'end' => 3],
            ]]],
            ['animation' => 'karaoke', 'highlightColor' => '#F97316', 'backgroundOpacity' => 0, 'shadowOpacity' => 0],
            1280, 720,
        );
        $textEvents = array_values(array_filter(explode("\n", $ass), fn ($l) => str_starts_with($l, 'Dialogue: 2,')));

        $this->assertCount(3, $textEvents);
        $this->assertStringContainsString('0:00:01.00,0:00:02.00', $textEvents[1]);
        $this->assertMatchesRegularExpression('/\{\\\\1c&H1673F9&\}\{[^}]*\}දෙක/u', $textEvents[1]);
    }

    public function test_font_weight_resolves_to_installed_face_like_css(): void
    {
        $dir = sys_get_temp_dir().'/fonts-'.bin2hex(random_bytes(3));
        mkdir($dir);
        $fonts = new FontRegistry($dir);
        // No files installed: fall back to family + requested weight.
        $this->assertSame(['name' => 'Poppins', 'weight' => 600, 'italic' => true], $fonts->face('Poppins', 600, true));
    }

    public function test_typewriter_keeps_sinhala_conjuncts_whole(): void
    {
        $this->assertSame(['ශ්‍රී', ' ', 'ක'], $this->renderer->graphemes("ශ්\u{200D}රී ක"));

        $ass = $this->renderer->render([['start' => 0, 'end' => 2, 'text' => 'ශ්‍රී ක']], ['animation' => 'typewriter', 'backgroundOpacity' => 0, 'shadowOpacity' => 0], 1280, 720);
        $this->assertCount(3, array_filter(explode("\n", $ass), fn ($l) => str_starts_with($l, 'Dialogue: 2,')));
        $this->assertStringContainsString('{\alpha&HFF&}', $ass);
    }
}
