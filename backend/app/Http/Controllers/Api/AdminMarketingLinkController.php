<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketingLink;
use App\Models\Payment;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Admins: campaign links for posts, ads and creators. Each link has a name and notes about the
 * marketing, and counts the sign-ups (and Pro upgrades) that came through it.
 */
class AdminMarketingLinkController extends Controller
{
    use ApiResponseTrait;

    public function index(): JsonResponse
    {
        $links = MarketingLink::query()->latest()->get();

        return $this->successResponse(['links' => $links->map(fn (MarketingLink $link) => $this->present($link))], 'Campaign links retrieved');
    }

    public function store(Request $request): JsonResponse
    {
        $link = new MarketingLink($this->validated($request));
        $this->ensureUnique($link);
        $link->created_by = $request->user()->id;
        $link->save();

        return $this->successResponse(['link' => $this->present($link)], 'Campaign link created', 201);
    }

    public function update(Request $request, MarketingLink $link): JsonResponse
    {
        $link->fill($this->validated($request));
        $this->ensureUnique($link);
        $link->save();

        return $this->successResponse(['link' => $this->present($link)], 'Campaign link updated');
    }

    /** Removes the link from the list. Users who signed up through it keep their source. */
    public function destroy(MarketingLink $link): JsonResponse
    {
        $link->delete();

        return $this->successResponse(null, 'Campaign link deleted');
    }

    /** @return array{name: string, source: ?string, medium: ?string, campaign: ?string, path: string, notes: ?string} */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'source' => ['required', 'string', 'max:100'],
            'medium' => ['nullable', 'string', 'max:100'],
            'campaign' => ['nullable', 'string', 'max:100'],
            'path' => ['nullable', 'string', 'max:255', 'regex:/^\/[^\s?#]*$/'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], ['path.regex' => 'The page must start with "/", like / or /si.']);

        $source = MarketingLink::tag($data['source']);
        if ($source === null) {
            throw ValidationException::withMessages(['source' => 'Use letters or numbers for the source, like facebook.']);
        }

        return [
            'name' => trim($data['name']),
            'source' => $source,
            'medium' => MarketingLink::tag($data['medium'] ?? null),
            'campaign' => MarketingLink::tag($data['campaign'] ?? null),
            'path' => ($data['path'] ?? null) ?: '/',
            'notes' => isset($data['notes']) && trim($data['notes']) !== '' ? trim($data['notes']) : null,
        ];
    }

    /** Two links with the same tags would count the same sign-ups. */
    private function ensureUnique(MarketingLink $link): void
    {
        $taken = MarketingLink::query()
            ->where('source', $link->source)
            ->where(fn ($q) => $link->medium === null ? $q->whereNull('medium') : $q->where('medium', $link->medium))
            ->where(fn ($q) => $link->campaign === null ? $q->whereNull('campaign') : $q->where('campaign', $link->campaign))
            ->when($link->exists, fn ($q) => $q->whereKeyNot($link->getKey()))
            ->value('name');

        if ($taken !== null) {
            throw ValidationException::withMessages(['campaign' => "The link “{$taken}” already uses these tags. Pick a different campaign name."]);
        }
    }

    /**
     * @return array{uuid: string, name: string, source: string, medium: ?string, campaign: ?string, path: string, notes: ?string, signups: int, paid: int, last_signup_at: ?string, created_at: ?string}
     */
    private function present(MarketingLink $link): array
    {
        $signups = $link->signups();
        $paid = Payment::query()->where('status', Payment::STATUS_APPROVED)->select('user_id');

        return [
            'uuid' => $link->uuid,
            'name' => $link->name,
            'source' => $link->source,
            'medium' => $link->medium,
            'campaign' => $link->campaign,
            'path' => $link->path,
            'notes' => $link->notes,
            'signups' => (clone $signups)->count(),
            'paid' => (clone $signups)->whereIn('id', $paid)->count(),
            'last_signup_at' => ($last = (clone $signups)->max('created_at')) ? Carbon::parse($last)->toISOString() : null,
            'created_at' => $link->created_at?->toISOString(),
        ];
    }
}
