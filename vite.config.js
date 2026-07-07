import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// served at https://<owner>.github.io/extra/ by the GitHub Pages workflow
export default defineConfig({
  base: "/extra/",
  plugins: [react()],
});
