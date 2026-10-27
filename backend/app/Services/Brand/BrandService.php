<?php

namespace App\Services\Brand;

class BrandService
{
    /**
     * Get the full brand configuration.
     */
    public function getBrandConfig(): array
    {
        return config('brand', [
            'name' => 'SampleCap',
            'short_name' => 'SampleCap',
            'logo_text' => 'SampleCap',
            'tagline' => 'AI-powered video captions',
            'description' => 'Create, edit and export captions with AI.',
            'colors' => [
                'primary' => '#5B21B6',
                'accent' => '#F97316',
                'dark' => '#171717',
                'background' => '#F8FAFC',
                'light_purple' => '#F5F3FF',
            ],
            'locale' => [
                'default_language' => 'si',
            ],
        ]);
    }

    /**
     * Get the product name.
     */
    public function getName(): string
    {
        return config('brand.name', 'SampleCap');
    }

    /**
     * Get the product short name.
     */
    public function getShortName(): string
    {
        return config('brand.short_name', 'SampleCap');
    }

    /**
     * Get the logo display text.
     */
    public function getLogoText(): string
    {
        return config('brand.logo_text', 'SampleCap');
    }

    /**
     * Get the brand tagline.
     */
    public function getTagline(): string
    {
        return config('brand.tagline', 'AI-powered video captions');
    }

    /**
     * Get the brand description.
     */
    public function getDescription(): string
    {
        return config('brand.description', 'Create, edit and export captions with AI.');
    }

    /**
     * Get brand color palette.
     */
    public function getColors(): array
    {
        return config('brand.colors', []);
    }
}
