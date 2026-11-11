import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  publicDir: "../public",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true, target: "es2022" },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000", "/media": "http://localhost:3000" },
  },
});
