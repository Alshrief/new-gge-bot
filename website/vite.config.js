import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
    target: 'esnext' // Allow top-level await in esbuild
  },
  build: {
    target: 'esnext', // Allow top-level await in the final bundle
    outDir: 'build', // Output to the existing build directory so the backend server serves it
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  }
})
