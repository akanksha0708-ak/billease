import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API and logo requests are forwarded to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5050',
      '/uploads': 'http://localhost:5050',
    },
  },
});
