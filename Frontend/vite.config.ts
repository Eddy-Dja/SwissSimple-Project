import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// ============================================================
// ESTAMPILLE DE BUILD (anti « vieux code en prod »)
// Le commit Git + la date sont injectés dans le bundle.
// Vérifiable en production : F12 → console →
// « SwissSimple — build <sha> du <date> UTC »
// ============================================================
const gitSha = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev-local' }
})()
const buildDate = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(gitSha),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
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
              test: /[\\/]node_modules[\\/](react-router(-dom)?)[\\/]/,
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