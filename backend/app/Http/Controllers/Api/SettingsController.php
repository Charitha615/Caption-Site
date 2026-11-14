<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Per-user preferences, stored as key/value rows in `settings`. Only whitelisted keys exist. */
class SettingsController extends Controller
{
    use ApiResponseTrait;

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return [
            'default_language' => config('brand.locale.default_language', 'si'),
            'default_export_resolution' => '1080',
            'default_export_quality' => 'standard',
        ];
    }

    public function show(Request $request): JsonResponse
    {
        return $this->successResponse(['settings' => $this->current($request->user()->id)], 'Settings retrieved');
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'default_language' => ['sometimes', 'string', Rule::in(['si', 'en', 'auto'])],
            'default_export_resolution' => ['sometimes', 'string', Rule::in(['source', ...array_keys(config('captions.resolutions'))])],
            'default_export_quality' => ['sometimes', 'string', Rule::in(array_keys(config('captions.qualities')))],
        ]);

        $userId = $request->user()->id;
        foreach ($validated as $key => $value) {
            Setting::updateOrCreate(['user_id' => $userId, 'key' => $key], ['value' => ['v' => $value]]);
        }

        return $this->successResponse(['settings' => $this->current($userId)], 'Settings saved');
    }

    /** @return array<string, mixed> */
    private function current(int $userId): array
    {
        $stored = Setting::where('user_id', $userId)
            ->whereIn('key', array_keys(self::defaults()))
            ->get()
            ->mapWithKeys(fn (Setting $s) => [$s->key => $s->value['v'] ?? null]);

        return array_merge(self::defaults(), $stored->filter(fn ($v) => $v !== null)->all());
    }
}
