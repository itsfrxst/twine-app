import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// served at https://<owner>.github.io/twine-app/ by the GitHub Pages workflow
export default defineConfig({
  base: "/twine-app/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Twine",
        short_name: "Twine",
        description:
          "Twin threads of time, intertwined. A checklist, calendar, and timeline built around Kronos and Kairos.",
        theme_color: "#06b6d4",
        background_color: "#0b1120",
        display: "standalone",
        start_url: "/twine-app/",
        scope: "/twine-app/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
