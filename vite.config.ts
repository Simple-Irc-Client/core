import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      plugins: [react()],
      server: {
        hmr: false,
      },
    }
  } else {
    return {
      plugins: [react()],
      server: {
        hmr: false,
      },
      base: './'
    }
  }
});
