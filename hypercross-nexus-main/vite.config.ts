import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor';
          }

          if (id.includes('/@rainbow-me/')) {
            return 'rainbowkit-vendor';
          }

          if (id.includes('/@walletconnect/') || id.includes('/@reown/') || id.includes('/@base-org/') || id.includes('/@coinbase/') || id.includes('/@safe-global/') || id.includes('/@gemini-wallet/')) {
            return 'walletconnect-vendor';
          }

          if (id.includes('/wagmi') || id.includes('/viem')) {
            return 'wagmi-vendor';
          }

          if (id.includes('/@tanstack/')) {
            return 'query-vendor';
          }

          if (id.includes('/zod/')) {
            return 'schema-vendor';
          }

          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory')) {
            return 'chart-vendor';
          }

          if (
            id.includes('/lucide-react/') ||
            id.includes('/clsx') ||
            id.includes('/class-variance-authority') ||
            id.includes('/tailwind')
          ) {
            return 'ui-vendor';
          }

          if (id.includes('/node_modules/')) {
            return 'vendor';
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
