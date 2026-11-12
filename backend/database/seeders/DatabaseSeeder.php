<?php

namespace Database\Seeders;

use App\Models\Caption;
use App\Models\CaptionStyle;
use App\Models\Project;
use App\Models\Transcript;
use App\Models\UsageRecord;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        \App\Models\CaptionTemplate::syncSystemTemplates();

        $user = User::firstOrCreate(
            ['email' => 'demo@samplecap.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Charitha Wickramarathne',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'role' => 'admin',
            ]
        );

        // 1. Completed Sinhala Project
        $sinhalaProject = Project::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => 'සිංහල තාක්ෂණික සමාලෝචනය #1',
            'description' => 'නවීන AI මෙවලම් සහ වීඩියෝ උපසිරැසි නිර්මාණය පිළිබඳ පූර්ණ විස්තරයක්.',
            'status' => 'completed',
            'duration' => 145.5,
            'width' => 1920,
            'height' => 1080,
            'fps' => 30.0,
            'language' => 'si',
            'thumbnail' => 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
            'settings' => ['caption_style' => 'default', 'max_chars' => 40],
        ]);

        $sinhalaTranscript = Transcript::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $sinhalaProject->id,
            'language' => 'si',
            'raw_text' => 'ආයුබෝවන් යාලුවනේ! අද අපි කතා කරන්න යන්නේ AI මඟින් ඕනෑම වීඩියෝවකට නිවැරදි සිංහල උපසිරැසි ලබාගන්නේ කෙසේද යන්නයි.',
            'status' => 'completed',
            'confidence' => 0.98,
        ]);

        Caption::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $sinhalaProject->id,
            'transcript_id' => $sinhalaTranscript->id,
            'sequence' => 1,
            'start_time' => 0.000,
            'end_time' => 2.800,
            'text' => 'ආයුබෝවන් යාලුවනේ!',
        ]);

        Caption::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $sinhalaProject->id,
            'transcript_id' => $sinhalaTranscript->id,
            'sequence' => 2,
            'start_time' => 2.900,
            'end_time' => 6.500,
            'text' => 'අද අපි කතා කරන්න යන්නේ AI මඟින් වීඩියෝ වලට',
        ]);

        Caption::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $sinhalaProject->id,
            'transcript_id' => $sinhalaTranscript->id,
            'sequence' => 3,
            'start_time' => 6.600,
            'end_time' => 10.400,
            'text' => 'නිවැරදි සිංහල උපසිරැසි ලබාගන්නේ කෙසේද යන්නයි.',
        ]);

        // 2. Completed English Project
        $englishProject = Project::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => 'AI Video Captioning Platform Overview',
            'description' => 'Walkthrough of caption styles, export presets, and timing editor.',
            'status' => 'completed',
            'duration' => 210.0,
            'width' => 1920,
            'height' => 1080,
            'fps' => 60.0,
            'language' => 'en',
            'thumbnail' => 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80',
            'settings' => ['caption_style' => 'pop', 'max_chars' => 35],
        ]);

        $enTranscript = Transcript::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $englishProject->id,
            'language' => 'en',
            'raw_text' => 'Welcome to the platform overview. Generate captions with superhuman accuracy in seconds.',
            'status' => 'completed',
            'confidence' => 0.99,
        ]);

        Caption::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $englishProject->id,
            'transcript_id' => $enTranscript->id,
            'sequence' => 1,
            'start_time' => 0.000,
            'end_time' => 3.200,
            'text' => 'Welcome to the platform overview.',
        ]);

        Caption::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $englishProject->id,
            'transcript_id' => $enTranscript->id,
            'sequence' => 2,
            'start_time' => 3.300,
            'end_time' => 7.000,
            'text' => 'Generate captions with superhuman accuracy in seconds.',
        ]);

        // 3. Processing Project
        Project::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => 'ඇල්ල සංචාරය - Travel Reel #4',
            'description' => 'Instagram reel audio transcription in progress.',
            'status' => 'processing',
            'duration' => 45.0,
            'width' => 1080,
            'height' => 1920,
            'fps' => 30.0,
            'language' => 'si',
            'thumbnail' => 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
        ]);

        // 4. Draft Project
        Project::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => 'Podcast Episode 12: Future of Content',
            'description' => 'Awaiting video upload and language selection.',
            'status' => 'draft',
            'duration' => 0.0,
            'width' => 1920,
            'height' => 1080,
            'fps' => 30.0,
            'language' => 'en',
        ]);

        // Caption Styles
        CaptionStyle::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => 'Modern Minimalist',
            'is_default' => true,
            'font_family' => 'Inter',
            'font_size' => 32,
            'primary_color' => '#FFFFFF',
            'outline_color' => '#000000',
            'background_color' => 'rgba(0, 0, 0, 0.65)',
            'position' => 'bottom',
            'alignment' => 'center',
            'animation_effect' => 'none',
        ]);

        CaptionStyle::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => 'Sinhala Bold Yellow (Reels)',
            'is_default' => false,
            'font_family' => 'Noto Sans Sinhala',
            'font_size' => 38,
            'primary_color' => '#FBBF24',
            'outline_color' => '#171717',
            'background_color' => 'transparent',
            'position' => 'middle',
            'alignment' => 'center',
            'animation_effect' => 'pop',
        ]);

        // Usage records
        UsageRecord::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'project_id' => $sinhalaProject->id,
            'action' => 'caption_generation',
            'quantity' => 145.5,
            'unit' => 'seconds',
        ]);

        UsageRecord::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'project_id' => $englishProject->id,
            'action' => 'caption_generation',
            'quantity' => 210.0,
            'unit' => 'seconds',
        ]);
    }
}
