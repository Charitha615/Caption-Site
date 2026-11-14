<?php

namespace App\Services\Media;

use App\Models\MediaFile;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Private media storage that works with local disks and object storage (S3, R2, …).
 *
 * FFmpeg needs a local file; for remote disks withLocalCopy() streams the object to a
 * temporary file and removes it afterwards, so jobs never assume a local disk.
 */
class MediaStorage
{
    public function diskName(): string
    {
        return (string) config('captions.media_disk', 'local');
    }

    public function disk(?string $name = null): FilesystemAdapter|Filesystem
    {
        return Storage::disk($name ?? $this->diskName());
    }

    public function isLocal(?string $disk = null): bool
    {
        return config('filesystems.disks.'.($disk ?? $this->diskName()).'.driver') === 'local';
    }

    /**
     * @template T
     *
     * @param  callable(string $absolutePath): T  $callback
     * @return T
     */
    public function withLocalCopy(string $disk, string $path, callable $callback): mixed
    {
        if ($this->isLocal($disk)) {
            return $callback(Storage::disk($disk)->path($path));
        }

        $tmp = $this->tempPath(pathinfo($path, PATHINFO_EXTENSION) ?: 'bin');
        $in = Storage::disk($disk)->readStream($path);
        $out = fopen($tmp, 'wb');
        stream_copy_to_stream($in, $out);
        fclose($out);
        if (is_resource($in)) {
            fclose($in);
        }

        try {
            return $callback($tmp);
        } finally {
            @unlink($tmp);
        }
    }

    public function withMediaCopy(MediaFile $media, callable $callback): mixed
    {
        return $this->withLocalCopy($media->disk, $media->file_path, $callback);
    }

    /** Copies a local file onto a disk without loading it into memory. */
    public function putLocalFile(string $localPath, string $targetPath, ?string $disk = null): void
    {
        $stream = fopen($localPath, 'rb');
        try {
            $this->disk($disk)->writeStream($targetPath, $stream);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    /**
     * Moves a local file onto a disk: a cheap rename for local disks, a streamed
     * upload (then delete) for object storage.
     */
    public function moveLocalFile(string $localPath, string $targetPath, ?string $disk = null): void
    {
        $disk ??= $this->diskName();
        if ($this->isLocal($disk)) {
            $absolute = Storage::disk($disk)->path($targetPath);
            File::ensureDirectoryExists(dirname($absolute), 0700);
            if (@rename($localPath, $absolute)) {
                return;
            }
        }
        $this->putLocalFile($localPath, $targetPath, $disk);
        @unlink($localPath);
    }

    /** A unique scratch file path under storage/app/tmp (created directories are private). */
    public function tempPath(string $extension): string
    {
        $dir = storage_path('app/tmp');
        File::ensureDirectoryExists($dir, 0700);

        return $dir.'/'.Str::uuid().'.'.ltrim($extension, '.');
    }

    public function delete(?string $disk, ?string $path): void
    {
        if ($disk && $path) {
            Storage::disk($disk)->delete($path);
        }
    }
}
