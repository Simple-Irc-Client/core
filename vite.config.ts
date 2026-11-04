import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { execSync } from "node:child_process";
import { publicSiteMetadata } from "./build/publicSiteMetadata";

const gitRef = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
})();

const pwa = VitePWA({
  registerType: "autoUpdate",
  // Registration lives in src/runtime/serviceWorker.ts: the injected script
  // registers unconditionally, which throws inside Tauri (tauri://localhost).
  injectRegister: false,
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,ico,png,webp,woff2}"],
    globIgnores: ["**/*.map"],
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
export default defineConfig(({ command, mode }) => {
  if (command === "serve") {
    return {
      define: { __GIT_REF__: JSON.stringify(gitRef) },
      plugins: [react(), tailwindcss(), pwa],
      resolve: {
        alias: {
          "@": path.resolve(import.meta.dirname, "./src"),
          "@features": path.resolve(import.meta.dirname, "./src/features"),
          "@shared": path.resolve(import.meta.dirname, "./src/shared"),
        },
      },
      // The e2e servers serve the code as it was when they started: edits made while tests run don't reload their pages
      server: process.env.SIC_E2E === '1'
        ? { host: true, hmr: false, watch: null }
        : { host: true, hmr: true },
    }
  } else {
    // Public address of a hosted web chat (e.g. in .env.gateway); without it the build gets no canonical URL or llms.txt.
    const { PUBLIC_SITE_URL } = loadEnv(mode, import.meta.dirname, "PUBLIC_SITE_URL");
    return {
      define: { __GIT_REF__: JSON.stringify(gitRef) },
      plugins: [react(), tailwindcss(), pwa, publicSiteMetadata(PUBLIC_SITE_URL)],
      resolve: {
        alias: {
          "@": path.resolve(import.meta.dirname, "./src"),
          "@features": path.resolve(import.meta.dirname, "./src/features"),
          "@shared": path.resolve(import.meta.dirname, "./src/shared"),
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
