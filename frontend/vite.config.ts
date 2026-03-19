/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Cornerstone3D DICOM image loader has web workers that need special handling
    exclude: ["@cornerstonejs/dicom-image-loader"],
  },
  worker: {
    // Use ES module format for web workers (required by Cornerstone3D in Vite)
    format: "es",
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://nginx:80",
        changeOrigin: true,
      },
      "/sanctum": {
        target: "http://nginx:80",
        changeOrigin: true,
      },
      "/jupyter": {
        target: "http://nginx:80",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
