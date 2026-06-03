import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/gtfs-rt': {
        target: 'https://open-data.rtd-denver.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/gtfs-rt/, '/files/gtfs-rt'),
      },
      '/api/geocode': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/geocode/, ''),
        headers: { 'User-Agent': 'DenverRTD-App/1.0 (educational project)' },
      },
    },
  },
})
