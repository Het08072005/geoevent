import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: true,
      port: 5175,
      allowedHosts: [
        'app.34.235.32.139.nip.io',
        'deal.34.226.92.16.nip.io'
      ],
      // Local dev proxy: forwards /api calls to the backend so no CORS issues
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      // Ensure assets are referenced with relative paths (works behind Nginx)
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    }
  }
})
