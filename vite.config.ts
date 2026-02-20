import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      plugins: [react(), tailwindcss()],
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
      plugins: [react(), tailwindcss()],
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