import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run api` serves the PHP backend; the dev server forwards /api to it.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'ts',
    lib: {
      entry: 'src/main.tsx',
      formats: ['iife'],
      name: 'ChoreTracker',
      fileName: () => 'choretracker-main.js',
      cssFileName: 'choretracker-main',
    },
  },
})
