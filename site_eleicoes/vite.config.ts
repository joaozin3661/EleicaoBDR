import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento o site roda em :5173 e repassa /api para o servidor em :3001.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true, proxy: { "/api": "http://localhost:3001" } },
});
