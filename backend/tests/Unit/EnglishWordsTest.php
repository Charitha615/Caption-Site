<?php

namespace Tests\Unit;

use App\Services\Caption\EnglishWords;
use Tests\TestCase;

class EnglishWordsTest extends TestCase
{
    public function test_english_words_in_sinhala_speech_are_written_in_english(): void
    {
        $english = new EnglishWords;

        $this->assertSame('මේ Toyota Aqua එකේ hybrid system එක', $english->apply('මේ ටොයොටා ඇක්වා එකේ හයිබ්‍රිඩ් සිස්ටම් එක'));
        $this->assertSame('phone එක, charge කරන්න!', $english->apply('ෆෝන් එක, චාජ් කරන්න!'), 'punctuation kept');
        $this->assertSame('traffic', $english->apply('ට්රැෆික්'), 'works with or without ZWJ');
        $this->assertSame('ආයුබෝවන් ඔයාලට', $english->apply('ආයුබෝවන් ඔයාලට'), 'Sinhala words untouched');
        $this->assertSame('කාර්යය', $english->apply('කාර්යය'), 'never part of a longer Sinhala word');
    }

    public function test_word_timings_follow_the_replacement(): void
    {
        $words = [
            ['word' => 'ඒ', 'start' => 1.0, 'end' => 1.2], ['word' => 'අයි', 'start' => 1.2, 'end' => 1.6],
            ['word' => 'ෆෝන්', 'start' => 1.7, 'end' => 2.0], ['word' => 'එක', 'start' => 2.0, 'end' => 2.2],
        ];

        $line = (new EnglishWords)->applyToLine('ඒ අයි ෆෝන් එක', $words);

        $this->assertTrue($line['changed']);
        $this->assertSame('AI phone එක', $line['text']);
        $this->assertSame(['AI', 'phone', 'එක'], array_column($line['words'], 'word'));
        $this->assertEquals([[1.0, 1.6], [1.7, 2.0], [2.0, 2.2]], array_map(fn ($w) => [$w['start'], $w['end']], $line['words']), 'merged phrase spans both spoken words');
    }
}
