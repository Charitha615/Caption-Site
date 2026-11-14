<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\UploadSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UploadSession>
 */
class UploadSessionFactory extends Factory
{
    protected $model = UploadSession::class;

    public function definition(): array
    {
        $project = Project::factory();

        return [
            'project_id' => $project,
            'user_id' => fn (array $attrs) => Project::find($attrs['project_id'])->user_id,
            'original_name' => 'clip.mp4',
            'extension' => 'mp4',
            'file_size' => 10,
            'chunk_size' => 4,
            'total_chunks' => 3,
            'received_chunks' => [],
            'language' => 'si',
            'status' => UploadSession::STATUS_PENDING,
            'expires_at' => now()->addDay(),
        ];
    }
}
