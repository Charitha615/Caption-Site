<?php

namespace App\Actions\Projects;

use App\Models\Project;

class UpdateProjectAction
{
    /**
     * Update project attributes.
     *
     * @param Project $project
     * @param array $data
     * @return Project
     */
    public function execute(Project $project, array $data): Project
    {
        $fillable = array_intersect_key($data, array_flip([
            'name',
            'description',
            'status',
            'language',
            'duration',
            'width',
            'height',
            'fps',
            'thumbnail',
            'settings',
        ]));

        $project->update($fillable);

        return $project->fresh();
    }
}
