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
    // split large/duplicated dependency trees into separate chunks to ease build memory pressure
    rollupOptions: {
      output: {
        manualChunks: {
          ethers: ['ethers'],
          wagmi: ['wagmi', '@rainbow-me/rainbowkit', 'viem'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
