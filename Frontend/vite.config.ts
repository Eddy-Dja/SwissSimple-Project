import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // ============================================================
    // CODE-SPLITTING VENDOR (Vite 8 / Rolldown)
    // ⚠️ manualChunks (méthode Rollup) est IGNORÉ silencieusement
    // dans Vite 8 — on utilise codeSplitting (cf. warning du build).
    // ============================================================
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Noyau React — segments EXACTS (react|react-dom|scheduler),
              // sinon react-router-* serait capturé ici aussi.
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-router',
              test: /[\\/]node_modules[\\/]react-router(-dom)?[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/serpapi': {
        target: 'https://serpapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/serpapi/, ''),
      },
      '/api/jina': {
        target: 'https://r.jina.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jina/, ''),
      },
      // NOUVEAU PROXY POUR GOOGLE GEMINI
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
      }
    }
  }
})