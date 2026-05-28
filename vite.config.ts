import { defineConfig } from "vite";

// GitHub Pages project site: https://laim-1.github.io/CBZReader/
export default defineConfig({
  base: "/CBZReader/",
  root: ".",
  publicDir: "public",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
});
