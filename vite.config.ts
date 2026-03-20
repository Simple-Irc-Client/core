import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { execSync } from "node:child_process";

const gitRef = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
})();

const pwa = VitePWA({
  registerType: "autoUpdate",
  injectRegister: "script-defer",
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,ico,png,webp,woff2}"],
    globIgnores: ["**/*.map"],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|gif|webp|svg)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "images",
          expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
  manifest: {
    name: "Simple IRC Client",
    short_name: "IRC",
    description: "A modern IRC client for the web",
    theme_color: "#000000",
    background_color: "#ffffff",
    display: "standalone",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    screenshots: [
      {
        src: "screenshot-wide.png",
        sizes: "2559x1270",
        type: "image/png",
        form_factor: "wide",
        label: "Simple IRC Client - Desktop",
      },
      {
        src: "screenshot-narrow.png",
        sizes: "377x812",
        type: "image/png",
        form_factor: "narrow",
        label: "Simple IRC Client - Mobile",
      },
    ],
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      define: { __GIT_REF__: JSON.stringify(gitRef) },
      plugins: [react(), tailwindcss(), pwa],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
          "@features": path.resolve(__dirname, "./src/features"),
          "@shared": path.resolve(__dirname, "./src/shared"),
        },
      },
      server: {
        host: true,
        hmr: true,
      },
    }
  } else {
    return {
      define: { __GIT_REF__: JSON.stringify(gitRef) },
      plugins: [react(), tailwindcss(), pwa],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
          "@features": path.resolve(__dirname, "./src/features"),
          "@shared": path.resolve(__dirname, "./src/shared"),
        },
      },
      server: {
        host: true,
        hmr: false,
      },
      base: './',
    }
  }
});
