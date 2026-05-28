import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 64111,
    proxy: {
      '/v1': {
        target: 'http://localhost:64100',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
