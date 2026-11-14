# SampleCap web app

React 19 + TypeScript + Vite single-page app. See the [root README](../README.md) and [docs/](../docs).

```bash
npm install
cp .env.example .env     # VITE_API_URL, VITE_BRAND_*
npm run dev              # http://localhost:5173
npm test                 # Vitest + Testing Library
npm run typecheck && npm run lint && npm run build
```

Code map: `src/pages` (routes, each lazy-loaded) · `src/components` (shared UI kit) · `src/features/editor` (studio editor) · `src/services` (API client, chunked uploads, error normalisation) · `src/stores` (Zustand). Details in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#6-frontend-layout).
