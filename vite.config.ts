import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)
    ),
  },
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
})
