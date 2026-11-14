<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Any HTTP call a test didn't explicitly fake is a bug (e.g. a real AI request).
        Http::preventStrayRequests();
    }

    /** Bytes that libmagic identifies as video/mp4 (an ISO-BMFF `ftyp` box), padded to $bytes. */
    protected function mp4Bytes(int $bytes = 4096): string
    {
        $header = pack('N', 24).'ftypisom'.pack('N', 512).'isommp41';

        return $header.str_repeat("\0", max(0, $bytes - strlen($header)));
    }

    protected function fakeMp4(string $name = 'clip.mp4', int $bytes = 4096): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'mp4');
        file_put_contents($path, $this->mp4Bytes($bytes));

        return new UploadedFile($path, $name, 'video/mp4', null, true);
    }

    /** @return array{0: User, 1: array<string, string>} */
    protected function userWithToken(array $attributes = []): array
    {
        $user = User::factory()->create($attributes);

        return [$user, ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken]];
    }
}
