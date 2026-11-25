import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  // index.html uses %VITE_BRAND_*% placeholders; give them defaults so the title is never blank.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  process.env.VITE_BRAND_NAME ||= env.VITE_BRAND_NAME || 'Sinsub'
  process.env.VITE_BRAND_TAGLINE ||= env.VITE_BRAND_TAGLINE || 'Sinhala & English video captions'
  process.env.VITE_BRAND_DESCRIPTION ||= env.VITE_BRAND_DESCRIPTION || 'Create, edit and export Sinhala and English captions for your videos.'

  return {
    plugins: [react()],
    build: isSsrBuild ? { sourcemap: false } : {
      sourcemap: false,
      // scripts/prerender.mjs reads it to link each prerendered page's CSS and scripts (then deletes it).
      manifest: true,
      rollupOptions: {
        output: {
          // Long-lived vendor chunk; app routes are split with React.lazy.
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
              if (id.includes('lucide-react')) return 'icons'
              // Spline (3D runtime) is huge — keep it out of vendor so only the dashboard hero loads it.
              if (id.includes('@splinetool')) return 'spline'
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
