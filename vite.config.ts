import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev and preview servers fall back to index.html, so deep links like /assets/a_innova survive refresh.
// GitHub Pages serves each app under /<repo>/ — CI sets PAGES_BASE; local dev and the Capacitor APK use '/'.
export default defineConfig({
  base: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PAGES_BASE || '/',
  plugins: [react()],
  server: { port: 5103, host: true },
  preview: { port: 5103, host: true },
});
