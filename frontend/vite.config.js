import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // keep the port fixed so the Codespaces URL pattern stays predictable
    host: true, // listen on all interfaces, required for GitHub Codespaces port forwarding
  },
});
