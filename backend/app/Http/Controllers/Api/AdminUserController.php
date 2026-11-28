<?php

namespace App\Http\Controllers\Api;

use App\Actions\Projects\DeleteProjectAction;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Admins: everyone who has registered, their plan, and account resets.
 *
 * The admin can give any plan in config/plans.php, including `unlimited`, which is never
 * sold: it is only given here, to special users.
 */
class AdminUserController extends Controller
{
    use ApiResponseTrait;

    public function __construct(protected UsageService $usage) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'plan' => ['nullable', Rule::in(array_keys(config('plans.plans')))],
        ]);

        $users = User::query()
            ->withCount('projects')
            ->withMax('tokens as last_active_at', 'last_used_at')
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('signup_source', $search)->orWhere('signup_campaign', $search));
            })
            ->when($filters['plan'] ?? null, function ($query, string $plan) {
                $default = config('plans.default');
                $query->where(function ($q) use ($plan, $default) {
                    if ($plan === $default) {
                        // Free also covers paid plans whose end date has passed.
                        $q->where('plan', $default)->orWhereNull('plan')
                            ->orWhere(fn ($e) => $e->whereNotNull('plan_expires_at')->where('plan_expires_at', '<=', now()));
                    } else {
                        $q->where('plan', $plan)->where(fn ($e) => $e->whereNull('plan_expires_at')->orWhere('plan_expires_at', '>', now()));
                    }
                });
            })
            ->latest()
            ->paginate(30);

        return $this->successResponse([
            'users' => $users->getCollection()->map(fn (User $user) => $this->present($user)),
            'plans' => collect(config('plans.plans'))->map(fn ($plan, $key) => ['key' => $key, 'label' => $plan['label']])->values(),
            'meta' => ['current_page' => $users->currentPage(), 'last_page' => $users->lastPage(), 'total' => $users->total()],
        ], 'Users retrieved');
    }

    public function show(User $user): JsonResponse
    {
        $user->loadCount('projects')->loadMax('tokens as last_active_at', 'last_used_at');

        return $this->successResponse([
            'user' => $this->present($user) + ['usage' => $this->usage->summary($user)],
        ], 'User retrieved');
    }

    /** Sets the plan. No end date = the plan never ends (always so for Free). */
    public function updatePlan(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'plan' => ['required', Rule::in(array_keys(config('plans.plans')))],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);
        $isDefault = $data['plan'] === config('plans.default');

        $user->switchPlan($data['plan'], $isDefault || empty($data['expires_at']) ? null : Carbon::parse($data['expires_at'])->endOfDay());
        $this->usage->forget($user->id);
        AppLog::info('admin.user_plan_changed', ['admin' => $request->user()->uuid, 'user' => $user->uuid, 'plan' => $data['plan'], 'until' => $user->plan_expires_at?->toDateString()]);

        return $this->show($user->refresh());
    }

    /** Sets a new password the admin gives the user, and signs them out everywhere. */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $password = $request->validate([
            'password' => ['required', 'string', 'max:255', Password::min(8)->letters()->numbers()],
        ])['password'];

        $user->update(['password' => $password]);
        $user->tokens()->delete();
        AppLog::info('admin.user_password_reset', ['admin' => $request->user()->uuid, 'user' => $user->uuid]);

        return $this->successResponse(null, 'Password changed. The user was signed out of every device.');
    }

    /** A fresh month: usage so far stops counting against this month's and today's limits. */
    public function resetUsage(Request $request, User $user): JsonResponse
    {
        $user->forceFill(['usage_reset_at' => now()])->save();
        $this->usage->forget($user->id);
        AppLog::info('admin.user_usage_reset', ['admin' => $request->user()->uuid, 'user' => $user->uuid]);

        return $this->show($user->refresh());
    }

    public function signOutEverywhere(Request $request, User $user): JsonResponse
    {
        $count = $user->tokens()->delete();
        AppLog::info('admin.user_signed_out', ['admin' => $request->user()->uuid, 'user' => $user->uuid, 'sessions' => $count]);

        return $this->successResponse(['sessions' => $count], 'Signed out of every device.');
    }

    /** Deletes every project with its videos, captions and exports. The account stays. */
    public function deleteProjects(Request $request, User $user, DeleteProjectAction $deleteProject): JsonResponse
    {
        $count = 0;
        Project::where('user_id', $user->id)->each(function (Project $project) use ($deleteProject, &$count) {
            $deleteProject->execute($project);
            $count++;
        });
        $this->usage->forget($user->id);
        AppLog::info('admin.user_projects_deleted', ['admin' => $request->user()->uuid, 'user' => $user->uuid, 'projects' => $count]);

        return $this->successResponse(['projects' => $count], "Deleted {$count} projects.");
    }

    /**
     * @return array{uuid: string, name: string, email: string, role: string, avatar_url: ?string, plan: string, plan_label: string, stored_plan: ?string, plan_expires_at: ?string, projects_count: int, last_active_at: ?string, usage_reset_at: ?string, created_at: ?string, signup: array{source: ?string, medium: ?string, campaign: ?string}}
     */
    private function present(User $user): array
    {
        $plan = $user->planKey();

        return [
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'avatar_url' => $user->avatar_url,
            'plan' => $plan,
            'plan_label' => config("plans.plans.{$plan}.label"),
            'stored_plan' => $user->plan,
            'plan_expires_at' => $plan !== config('plans.default') ? $user->plan_expires_at?->toISOString() : null,
            'projects_count' => (int) $user->projects_count,
            'last_active_at' => $user->last_active_at ? Carbon::parse($user->last_active_at)->toISOString() : null,
            'usage_reset_at' => $user->usage_reset_at?->toISOString(),
            'created_at' => $user->created_at?->toISOString(),
            'signup' => ['source' => $user->signup_source, 'medium' => $user->signup_medium, 'campaign' => $user->signup_campaign],
        ];
    }
}
