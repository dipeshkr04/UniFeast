import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backendTarget = env.VITE_BACKEND_URL || 'http://localhost:5000'

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            const packagePath = id.replace(/\\/g, '/').split('/node_modules/').pop() || ''
            const parts = packagePath.split('/')
            const packageName = packagePath.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]

            if (['react', 'react-dom', 'react-is', 'scheduler'].includes(packageName)) return 'vendor-react'
            if (packageName === 'react-icons') return 'vendor-icons'
            if (packageName === 'recharts' || packageName.startsWith('d3-') || packageName === 'victory-vendor') return 'vendor-charts'
            if (['framer-motion', 'motion-dom', 'motion-utils'].includes(packageName)) return 'vendor-motion'
            if (['socket.io-client', 'engine.io-client', '@socket.io/component-emitter'].includes(packageName)) return 'vendor-socket'

            return undefined
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendTarget,
          ws: true,
        },
      },
    },
  }
})
