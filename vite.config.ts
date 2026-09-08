import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,

    // Rust/Tauri generates executables in here while Vite is running.
    // Watching them on Windows/OneDrive causes EBUSY / file-lock errors.
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/target/**',
      ],
    },
  },

  envPrefix: ['VITE_', 'TAURI_'],
})