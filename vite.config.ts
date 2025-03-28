import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      plugins: [react(), tailwindcss()],
      server: {
        host: true,
        hmr: false,
      },
    }
  } else {
    return {
      plugins: [react(), tailwindcss()],
      server: {
        host: true,
        hmr: false,
      },
      base: './'
    }
  }
});
