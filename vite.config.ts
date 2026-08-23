import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import shopSeoPlugin from "./scripts/vite-plugin-shop-seo";
import prerenderLocalesPlugin from "./scripts/vite-plugin-prerender-locales";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      usePolling: true,
      interval: 300,
      ignored: [
        "/app/.lovable-sync-test.txt",
        "/app/.lovable-sync-*.txt",
        "**/.lovable-sync-test.txt",
        "**/.lovable-sync-*.txt",
        "**/.git/**",
        "**/node_modules/**",
      ],
    },
    hmr: {
      overlay: false,
    },
  },
  // Allow Emergent preview host so preview requests are not blocked
  preview: {
    allowedHosts: [
      'complete-site-build-1.cluster-5.preview.emergentcf.cloud',
      'complete-site-build-1.emergent.host',
      '*.preview.emergentcf.cloud',
      '*.emergentcf.cloud',
      '*.emergent.host',
      'complete-site-build-1.*.emergent.host',
    ],
  },
  plugins: [
    react(),
    shopSeoPlugin(),
    prerenderLocalesPlugin(),
    mcpPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Pas de navigateFallback precache : les navigations passent par la
        // regle runtime NetworkFirst ci-dessous, sinon un index.html en cache
        // peut pointer vers des chunks supprimes (ecran bloque au lancement).
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "lovanet-pages",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && ["style", "script", "worker", "font"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "lovanet-assets" },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "lovanet-images",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" && /supabase\.co\/(rest|functions)\//.test(url.href),
            handler: "NetworkFirst",
            options: {
              cacheName: "lovanet-data",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
