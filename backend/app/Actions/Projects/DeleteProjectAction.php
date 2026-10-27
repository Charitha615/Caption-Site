<?php

namespace App\Actions\Projects;

use App\Models\Project;

class DeleteProjectAction
{
    /**
     * Soft delete project and associated resources.
     *
     * @param Project $project
     * @return bool
     */
    public function execute(Project $project): bool
    {
        return (bool) $project->delete();
    }
}
