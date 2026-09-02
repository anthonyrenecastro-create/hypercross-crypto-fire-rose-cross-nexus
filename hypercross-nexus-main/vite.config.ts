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
    // let Rollup dynamically trace and split files naturally to reduce peak memory usage
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('viem')) {
              return 'viem';
            }
            if (id.includes('@rainbow-me') || id.includes('wagmi')) {
              return 'wagmi';
            }
            if (id.includes('ethers')) {
              return 'ethers';
            }
            return 'vendor';
          }
        }
      },
    },
  },
})
