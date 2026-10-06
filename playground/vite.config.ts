import { defineConfig } from "vite";

// GitHub Pages serves a project site under `/<repository>/`.
export default defineConfig({
  base: process.env.PLAYGROUND_BASE ?? "/",
  build: { outDir: "dist", emptyOutDir: true },
});
