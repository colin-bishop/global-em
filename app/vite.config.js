import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Read .env from project root (one level up from app/)
  envDir: path.resolve(__dirname, '..'),
  // Set VITE_BASE_PATH=/global-em/ in .env when deploying to GitHub Pages or a subdirectory.
  // Leave unset (or set to /) for root deployment (em4.fish).
  base: process.env.VITE_BASE_PATH ?? '/',
})
