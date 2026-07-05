import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'ts',
    lib: {
      entry: 'src/main.tsx',
      formats: ['iife'],
      name: 'ChoreTracker',
      fileName: () => 'choretracker-main.tsx'
    }
  }

})
