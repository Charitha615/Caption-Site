<?php

namespace Tests\Unit;

use App\Services\Caption\SinhalaScriptRepair;
use PHPUnit\Framework\TestCase;

class SinhalaScriptRepairTest extends TestCase
{
    /** Real lines returned by Gemini 3.5 Transcribe for Sinhala speech. */
    public function test_wrong_script_letters_become_sinhala(): void
    {
        $repair = new SinhalaScriptRepair;

        $this->assertSame('2026 දී ලංකාවේ බයික් ෂෝරූම් එකකට ගියොත් FZ', $repair->repair('2026 දී ලංਕාවේ බයික් ෂෝරූම් එකකට ගියොත් FZ')); // Gurmukhi
        $this->assertSame('හැබැයි එතකොට FZ V3 එකට මොකද වුණේ?', $repair->repair('හැබැයි එතකොට FZ V3 එකට මොకද වුණේ?')); // Telugu
        $this->assertSame('V2 එකෙන් කෙලින්ම V4 එකට ගිය යමහා V3', $repair->repair('V2 එකෙන් කෙලින්ම V4 එකට ගിയ යമഹാ V3')); // Malayalam
        $this->assertSame('එක මග හැරියේ ඇයි?', $repair->repair('එක මഗ හැരിയേ ඇයි?'));
        $this->assertSame('මේකේ ලොකු ලෙඩක් තිබ්බද?', $repair->repair('මේකේ ලොකු ලെഡක් තිබ්ബද?'));
    }

    public function test_malayalam_tta_conjuncts_and_strays_are_handled(): void
    {
        $repair = new SinhalaScriptRepair;

        $this->assertSame('FI සිස්ටං එක', $repair->repair('FI සිസ്റ്റം එක'), 'റ്റ → ට');
        $this->assertSame('ලීටර් 13', $repair->repair('ලීറ്റർ 13'));
        $this->assertSame("හාඩ් බ\u{0DCA}\u{200D}\u{0DBB}ේක්ක්", $repair->repair('හාඩ් බ്രേക്ക്'), 'rakaransaya keeps ZWJ');
        $this->assertSame('ට්‍රැෆික් එකේ', $repair->repair('ට්‍රැෆꯤක් එකේ'));
        $this->assertSame('හම්බ වුණොත්', $repair->repair('හම්ب වුණොත්'));
    }

    public function test_text_without_sinhala_or_without_foreign_letters_is_untouched(): void
    {
        $repair = new SinhalaScriptRepair;

        $this->assertSame('नमस्ते दुनिया', $repair->repair('नमस्ते दुनिया'), 'real Hindi stays Hindi');
        $this->assertSame("ශ්\u{200D}රී ලංකාව", $repair->repair("ශ්\u{200D}රී ලංකාව"), 'ZWJ conjunct kept');
        $this->assertSame('Hello', $repair->repair('Hello'));
    }

    public function test_segments_repair_word_texts_and_keep_timings(): void
    {
        [$segments, $changed] = (new SinhalaScriptRepair)->repairSegments([[
            'text' => 'ගിയ යമഹാ',
            'words' => [['word' => 'ගിയ', 'start' => 1.0, 'end' => 1.4], ['word' => 'യമഹാ', 'start' => 1.5, 'end' => 2.0]],
        ]]);

        $this->assertSame(1, $changed);
        $this->assertSame('ගිය යමහා', $segments[0]['text']);
        $this->assertSame(['ගිය', 'යමහා'], array_column($segments[0]['words'], 'word'));
        $this->assertSame([1.0, 1.5], array_column($segments[0]['words'], 'start'));
    }
}
