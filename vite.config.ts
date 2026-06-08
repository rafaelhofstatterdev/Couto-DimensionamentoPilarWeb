import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // base relativo: permite hospedar o build em qualquer subpasta de um
  // servidor local (file paths relativos em vez de absolutos)
  base: "./",
  plugins: [react(), tailwindcss()],
});
