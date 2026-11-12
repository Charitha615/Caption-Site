<?php

namespace App\Services\Rendering;

use Symfony\Component\Process\Process;

/**
 * Runs external commands as argv arrays (never through a shell). Swappable in
 * tests so the FFmpeg layer can be verified without FFmpeg installed.
 */
class ProcessRunner
{
    /**
     * @param list<string> $command
     * @param callable(string $chunk): void|null $onStdout called with stdout chunks as they arrive
     * @param callable(): bool|null $shouldStop polled while running; return true to abort
     * @return array{exitCode: int, stdout: string, stderr: string, stopped: bool}
     */
    public function run(array $command, ?callable $onStdout = null, ?callable $shouldStop = null, ?float $timeout = null): array
    {
        $process = new Process($command);
        $process->setTimeout($timeout);
        $process->start();

        $stdout = '';
        $stopped = false;
        while ($process->isRunning()) {
            $chunk = $process->getIncrementalOutput();
            if ($chunk !== '') {
                $stdout .= $chunk;
                if ($onStdout) {
                    $onStdout($chunk);
                }
            }
            if ($shouldStop && $shouldStop()) {
                $process->stop(3);
                $stopped = true;
                break;
            }
            $process->checkTimeout();
            usleep(200_000);
        }
        $rest = $process->getIncrementalOutput();
        if ($rest !== '' && $onStdout) {
            $onStdout($rest);
        }

        return [
            'exitCode' => (int) $process->getExitCode(),
            'stdout' => $stdout . $rest,
            'stderr' => $process->getErrorOutput(),
            'stopped' => $stopped,
        ];
    }
}
