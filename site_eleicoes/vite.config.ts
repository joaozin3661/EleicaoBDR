import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento o site roda em :5173 e repassa /api para o servidor em :3001.
// No modo "estatico" (npm run build:estatico) o site não usa API: base relativa para abrir em qualquer pasta
// e publicDir "estatico", de onde saem os dados gravados (estatico/dados/*.json).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "estatico" ? "./" : "/",
  publicDir: mode === "estatico" ? "estatico" : "public",
  build: mode === "estatico" ? { outDir: "dist-estatico", emptyOutDir: true } : undefined,
  server: { port: 5173, open: true, proxy: { "/api": "http://localhost:3001" } },
}));
