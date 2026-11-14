import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // index.html uses %VITE_BRAND_*% placeholders; give them defaults so the title is never blank.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  process.env.VITE_BRAND_NAME ||= env.VITE_BRAND_NAME || 'SampleCap'
  process.env.VITE_BRAND_TAGLINE ||= env.VITE_BRAND_TAGLINE || 'AI-powered video captions'
  process.env.VITE_BRAND_DESCRIPTION ||= env.VITE_BRAND_DESCRIPTION || 'Create, edit and export captions with AI.'

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          // Long-lived vendor chunk; app routes are split with React.lazy.
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
              if (id.includes('lucide-react')) return 'icons'
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
