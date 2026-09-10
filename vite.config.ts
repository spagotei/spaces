import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,

  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom)[\\/]/,
              priority: 30,
            },
            {
              name: 'tauri-vendor',
              test: /node_modules[\\/]@tauri-apps[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },

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