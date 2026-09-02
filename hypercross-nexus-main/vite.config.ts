import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // Let Rollup dynamically trace and split files naturally to reduce peak memory usage
    // Avoid restrictive/circular manual chunk configuration under memory-limited systems.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
