<?php

namespace App\Services\Brand;

/**
 * Read access to config/brand.php — the single backend source of product naming.
 * Rename the product with BRAND_NAME (and friends) in .env; nothing else changes.
 */
class BrandService
{
    /** @return array<string, mixed> */
    public function getBrandConfig(): array
    {
        return config('brand');
    }

    public function getName(): string
    {
        return (string) config('brand.name');
    }
}
