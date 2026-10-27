# SampleCap (AI Video Captioning SaaS)

> **Centralized Branding Notice:**  
> The product name is currently set to **SampleCap** and is configured centrally. To rebrand the platform at any time (e.g., to **පේළිCap**), update the single configuration file in `frontend/src/config/brand.ts` and `backend/config/brand.php`. The product name is never hardcoded across components or templates.

A modern, production-grade AI-powered SaaS web application designed for high-accuracy video transcription, timed caption generation, and subtitle styling for **Sinhala (සිංහල)** and **English**.

---

## 🚀 Key Capabilities (Step 1 Foundation)

- **Centralized Branding Engine**: Change product name, logo text, tagline, and colors from one configuration without file-by-file search and replace.
- **Full Sinhala & Unicode Support**: Native UTF8MB4 database encoding, Zero-Width Joiner (ZWJ) normalization, and Google Noto Sans Sinhala font typography.
- **Decoupled Modern Architecture**:
  - **Frontend**: React 19, TypeScript, Vite, React Router, Zustand, Axios, Pure CSS Design System (**NO Tailwind CSS**).
  - **Backend**: Laravel 11/13, Sanctum Token Authentication, Thin Controllers, Action/Service pattern, MySQL, Redis, Laravel Queue.
  - **Video & AI Architecture**: Contracts and services ready for Google Gemini Multimodal Audio API and FFmpeg/FFprobe video manipulation.
- **SaaS Dashboard & Workspace**: Usage quota metrics, filterable project lists, video upload preview, and dark video-editing studio workspace.
- **RESTful API Foundation**: Fully tested Sanctum authentication, authorization policies, and consistent JSON responses.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, React Router, Zustand, Axios, Pure Vanilla CSS System |
| **Backend** | PHP 8.3+, Laravel, Laravel Sanctum, MySQL, Redis, Laravel Horizon/Queues |
| **Video Engine** | FFmpeg, FFprobe (Process abstraction) |
| **AI Engine** | Google Gemini / Google AI API (`gemini-1.5-flash`) |
| **Storage** | Laravel Filesystem Abstraction (Local for Dev, S3-compatible for Prod) |

---

## 📂 Project Structure

```text
├── frontend/                  # React + TypeScript + Vite Single Page Application
│   ├── src/
│   │   ├── components/        # Reusable UI (Button, Input, Modal, Toast, Badge, etc.)
│   │   ├── config/            # Centralized brand config (brand.ts) & constants
│   │   ├── features/          # Project cards and domain features
│   │   ├── hooks/             # useBrand, useDocumentTitle
│   │   ├── layouts/           # AppLayout (Sidebar + Navbar), AuthLayout
│   │   ├── pages/             # Dashboard, Projects, Create, Editor, Settings, Profile
│   │   ├── services/          # Axios API clients & endpoints
│   │   ├── stores/            # Zustand stores (Auth, Projects, Toast)
│   │   ├── styles/            # CSS tokens (variables.css) & global styles (NO Tailwind)
│   │   └── types/             # Strict TypeScript models
├── backend/                   # Laravel 13 REST API Application
│   ├── app/
│   │   ├── Actions/           # Single-responsibility business actions
│   │   ├── Services/          # Brand, Gemini AI, FFmpeg, Caption formatter services
│   │   ├── Http/Controllers/  # Thin API Controllers
│   │   ├── Http/Requests/     # Form validation requests
│   │   ├── Http/Resources/    # JSON serialization resources
│   │   ├── Models/            # Eloquent models (UUIDs, soft deletes, relations)
│   │   ├── Policies/          # Authorization policies (ProjectPolicy)
│   │   └── Traits/            # Consistent ApiResponseTrait
│   ├── config/brand.php       # Centralized backend branding config
│   ├── database/migrations/   # 8 core domain tables + indexes + foreign keys
│   └── tests/Feature/         # 100% passing Feature test suite
├── docs/                      # Comprehensive technical documentation
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   └── ENVIRONMENT.md
```

---

## ⚡ Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env database details (Mac port 8889 configured by default)
composer install
php artisan migrate --seed
php artisan test
php artisan serve
```

*Demo Login:* `demo@samplecap.com` / `password123`

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173).

---

## 📖 Documentation

- [Setup Guide](docs/SETUP.md): Detailed installation and environment configuration.
- [Architecture Guide](docs/ARCHITECTURE.md): Deep-dive into Clean Architecture, contracts, and Step 2 roadmap.
- [Environment Variables](docs/ENVIRONMENT.md): Configuration variables for local development and cloud production.
