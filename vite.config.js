import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// served at https://<owner>.github.io/twine-app/ by the GitHub Pages workflow
export default defineConfig({
  base: "/twine-app/",
  plugins: [react()],
});
