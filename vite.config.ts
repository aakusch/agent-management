import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { relayFilesystem } from './vite-plugin-relay-fs.mjs'

export default defineConfig({
  plugins: [react(), relayFilesystem()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-flow': ['@xyflow/react'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
