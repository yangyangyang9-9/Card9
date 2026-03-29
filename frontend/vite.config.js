import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: ['.monkeycode-ai.online'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  define: {
    'process.env': {
      CONTRACT_ADDRESS: '0x487bb9Df042f31d28B881F0C2E65095B31a0127d',
      BSC_TESTNET_CHAIN_ID: '0x61',
    },
  },
})
