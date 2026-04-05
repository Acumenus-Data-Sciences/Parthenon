/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { chmodSync, readdirSync, statSync } from "fs";

/**
 * Normalize dist/ permissions after build so Apache can serve files.
 * Host umask 0007 (from USERGROUPS_ENAB + UMASK 027 in login.defs)
 * creates files as 660 — www-data gets no access → 403.
 */
function fixDistPermissions(): Plugin {
  return {
    name: "fix-dist-permissions",
    apply: "build",
    writeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      try {
        fixPerms(distDir);
      } catch {
        // Non-fatal: Windows or permission-restricted environments
      }
    },
  };
}

function fixPerms(dir: string): void {
  chmodSync(dir, 0o755);
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      fixPerms(full);
    } else {
      chmodSync(full, 0o644);
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fixDistPermissions()],
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
      "/storage": {
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
