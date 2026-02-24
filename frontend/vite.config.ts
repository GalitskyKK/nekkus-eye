import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Локально: outDir ../ui/frontend/dist. В CI: VITE_OUT_DIR=dist → frontend/dist, потом копируем в ui/frontend/dist.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: process.env.VITE_OUT_DIR || '../ui/frontend/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:9002', changeOrigin: true },
      '/ws': { target: 'http://127.0.0.1:9002', ws: true },
    },
  },
})
