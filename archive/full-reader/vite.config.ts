import { resolve } from "node:path";
import { defineConfig } from "vite";

// Relative paths so CSS/JS load on GitHub Pages from the /docs folder.
export default defineConfig({
  base: "./",
  root: ".",
  publicDir: "public",
  build: {
    outDir: "docs",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.src.html"),
      },
    },
  },
  server: {
    open: "/index.src.html",
  },
});
