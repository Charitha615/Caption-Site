<?php

namespace App\Actions\Projects;

use App\Models\Project;

class UpdateProjectAction
{
    /**
     * Update project attributes.
     */
    public function execute(Project $project, array $data): Project
    {
        $fillable = array_intersect_key($data, array_flip([
            'name',
            'description',
            'language',
            'settings',
        ]));

        $project->update($fillable);

        return $project->fresh();
    }
}
